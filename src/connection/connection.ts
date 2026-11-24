import { isIP, Socket } from 'net';
import { connect as tlsConnect, TLSSocket } from 'tls';

import { ConnectOptions } from '@options';
import { Challenge, clientNonce, CryptoHelper, parseChallenge, parseJson, Proof, prove } from '@helper';
import { Request } from '@dto';

// Largest response line accepted from the server (base64). Protects memory from a line that never ends.
const MAX_LINE_LENGTH: number = 256 * 1024 * 1024;
// A close this soon after the handshake, before any response arrived, almost always means rejected credentials.
const EARLY_CLOSE_MS: number = 2000;

/**
 * One TCP (or TLS) connection to a DianaDB server.
 *
 * Wire format, both directions: one line per message, terminated by "\n".
 *
 * Protocol 2 (server 4.6.5+): a challenge-response handshake (helpers/scram), then every line is
 * base64(AES-256-GCM(session key, JSON)) with a key of its own per connection:
 *   client "hello:2:<user>:<nonce>[:subscriber]"  server "challenge:2:..."  client "proof:..."  server "ok:2:..."
 *
 * Protocol 1 (older servers, used only when `legacyAuth` allows it):
 *   - first client line: "user:<name>" or "user:<name>:subscriber:<token>"
 *   - every other line: base64(AES-256-GCM(sha256(password), JSON))
 */
export class Connection {
  private readonly options: ConnectOptions;
  private socket: Socket;
  private activeSocket: Socket | TLSSocket;
  private _connected: boolean = false;
  private started: boolean = false;
  // Pieces of the current, not yet terminated line. Kept as a list and joined once the "\n" arrives:
  // appending to one string and searching it on every chunk re-copies it each time (quadratic on big responses).
  private parts: string[] = [];
  private partsLength: number = 0;
  // clientRequestIds written to this socket and not answered yet; failed at once if the socket closes.
  private readonly inFlight: Set<string> = new Set<string>();
  private reconnectTimer: ReturnType<typeof setTimeout>;
  private readyAt: number = 0;
  private receivedResponse: boolean = false;
  private onReady: () => void;
  private onFailed: (error: Error) => void;
  // handshake progress of the current socket: protocol 2 goes hello -> proof -> ready, protocol 1 is ready at once
  private stage: 'hello' | 'proof' | 'ready' = 'hello';
  private nonce: string;
  private proof: Proof;
  private sessionKey: Buffer;
  private ownProtocol: 1 | 2 = 2;
  // "hello" was written to the current socket: only then a close without a challenge says anything about the server
  private helloSent: boolean = false;
  // the server has completed a protocol 2 handshake on this connection: it is never taken for an older one again
  private protocol2Proven: boolean = false;

  constructor(options: ConnectOptions) {
    this.options = options;
    if (!this.options.logger) {
      this.options.logger = console;
    }
  }

  public get connected(): boolean {
    return this._connected;
  }

  public get isSubscriber(): boolean {
    return Boolean(this.options.isSubscriber);
  }

  // Shared by the pool: once one connection finds an older server, the others don't try protocol 2 again.
  private get protocol(): 1 | 2 {
    return this.options.connectionManager?.protocol ?? this.ownProtocol;
  }

  private set protocol(value: 1 | 2) {
    this.ownProtocol = value;
    if (this.options.connectionManager) {
      this.options.connectionManager.protocol = value;
    }
  }

  public connect(connectTimeoutValue: number): Promise<void> {
    this.started = true;
    return new Promise<void>((resolve, reject) => {
      const connectTimeout = setTimeout(() => {
        this.onReady = undefined;
        this.onFailed = undefined;
        reject(new Error(`Connect timeout exceeded for ${this.options.host}:${this.options.port}`));
      }, connectTimeoutValue);
      this.onReady = () => {
        clearTimeout(connectTimeout);
        this.onFailed = undefined;
        resolve();
      };
      // authentication refused: fail now instead of waiting for the timeout
      this.onFailed = (error: Error) => {
        clearTimeout(connectTimeout);
        this.onReady = undefined;
        this.onFailed = undefined;
        reject(error);
      };
      this.open();
    });
  }

  /** Closes the connection for good: no reconnect. Requests still waiting on it are failed immediately. */
  public disconnect(): Promise<void> {
    this.started = false;
    this.onReady = undefined;
    this.onFailed = undefined;
    clearTimeout(this.reconnectTimer);
    const socket: Socket = this.socket;
    if (!socket || socket.destroyed) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      socket.once('close', () => resolve());
      this.activeSocket?.destroy();
      socket.destroy();
    });
  }

  public makeRequest(request: Request<any>): void {
    if (!this._connected) {
      throw new Error(`Connection to ${this.options.host}:${this.options.port} is not open`);
    }
    request.requestGroupId = this.options.requestGroupId;
    this.inFlight.add(request.clientRequestId);
    this.activeSocket.write(this.encrypt(JSON.stringify(request)) + '\n');
  }

  private open() {
    const socket: Socket = new Socket();
    this.socket = socket;
    this.parts = [];
    this.partsLength = 0;
    this.receivedResponse = false;
    this.stage = 'hello';
    this.helloSent = false;
    this.proof = undefined;
    this.sessionKey = undefined;
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 10000);

    socket.once('connect', () => {
      if (!this.options.secureServer) {
        this.onSocketReady(socket);
        return;
      }
      const { host } = this.options;
      const tlsSocket: TLSSocket = tlsConnect(
        {
          socket,
          host,
          // SNI and certificate hostname check. Without it node checks the certificate against "localhost".
          servername: isIP(host) ? undefined : host,
          rejectUnauthorized: false,
          ...(this.options.tls || {}),
        },
        () => this.onSocketReady(tlsSocket),
      );
      this.activeSocket = tlsSocket;
      tlsSocket.on('error', (error: Error) => {
        this.options.logger.error(error);
        socket.destroy();
      });
    });

    socket.on('error', (error: Error) => {
      // 'close' always follows, and that is where reconnecting happens.
      this.options.logger.error(error);
    });

    socket.once('close', () => this.onClose(socket));
    socket.connect({ host: this.options.host, port: this.options.port });
  }

  private onSocketReady(socket: Socket | TLSSocket) {
    this.activeSocket = socket;
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => this.onData(chunk));
    if (this.protocol === 1) {
      socket.write(this.legacyHandshake() + '\n');
      this.ready();
      return;
    }
    this.nonce = clientNonce();
    this.helloSent = true;
    socket.write(`hello:2:${this.options.user}:${this.nonce}${this.options.isSubscriber ? ':subscriber' : ''}\n`);
  }

  private ready() {
    this.stage = 'ready';
    this._connected = true;
    this.readyAt = Date.now();
    const onReady = this.onReady;
    this.onReady = undefined;
    onReady?.();
    this.options.connectionManager?.onConnectionReady(this);
  }

  private encrypt(text: string): string {
    return this.sessionKey
      ? CryptoHelper.encryptWithKey(this.sessionKey, text)
      : CryptoHelper.encrypt(this.options.password, text);
  }

  private decrypt(text: string): string {
    return this.sessionKey
      ? CryptoHelper.decryptWithKey(this.sessionKey, text)
      : CryptoHelper.decrypt(this.options.password, text);
  }

  /** Protocol 2 lines before the session starts: the challenge, then the server's signature. */
  private onHandshakeLine(line: string, socket: Socket): void {
    if (this.stage === 'hello') {
      const challenge: Challenge | undefined = parseChallenge(line);
      if (!challenge) {
        this.authenticationFailed(socket, `unexpected answer to the handshake from the DianaDB server`);
        return;
      }
      this.stage = 'proof';
      prove(this.options.user, this.options.password, this.nonce, challenge).then(
        (proof: Proof) => {
          if (socket !== this.socket || socket.destroyed) {
            return;
          }
          this.proof = proof;
          this.activeSocket.write(`proof:${proof.proof}\n`);
        },
        (error: Error) => this.authenticationFailed(socket, `could not compute the proof: ${error.message}`),
      );
      return;
    }
    if (!this.proof || line !== `ok:2:${this.proof.expectedSignature}`) {
      // the server doesn't know the user's record: it is not the server the client thinks it is
      this.authenticationFailed(
        socket,
        `the DianaDB server failed to prove that it knows the user "${this.options.user}"`,
      );
      return;
    }
    this.sessionKey = this.proof.key;
    this.protocol2Proven = true;
    this.proof = undefined;
    this.ready();
  }

  private authenticationFailed(socket: Socket, reason: string) {
    const error: Error = new Error(`Authentication with ${this.options.host}:${this.options.port} failed: ${reason}`);
    this.options.logger.error(error);
    const onFailed = this.onFailed;
    this.onFailed = undefined;
    onFailed?.(error);
    socket.destroy();
  }

  /** "user:<name>" for requests; subscribers add a token that proves they know the password. */
  private legacyHandshake(): string {
    const { user, password } = this.options;
    if (!this.options.isSubscriber) {
      return `user:${user}`;
    }
    // Generated on every (re)connect, so it is always dated today (UTC). The server accepts yesterday..tomorrow.
    const date: string = new Date().toISOString().slice(0, 10);
    const token: string = CryptoHelper.encrypt(password, `user:${user}:subscriber:${date}`);
    return `user:${user}:subscriber:${token}`;
  }

  private onClose(socket: Socket) {
    if (socket !== this.socket) {
      return;
    }
    const wasConnected: boolean = this._connected;
    const stage: 'hello' | 'proof' | 'ready' = this.stage;
    const helloSent: boolean = this.helloSent;
    this.helloSent = false;
    this._connected = false;
    this.parts = [];
    this.partsLength = 0;
    this.sessionKey = undefined;
    if (this.started && this.protocol === 2 && stage === 'hello' && helloSent && !this.protocol2Proven) {
      // Closed after "hello" without a challenge: a server before 4.6.5, which can't read the line.
      // A connection that was never established (the server is down or restarting) says nothing about its version.
      if (this.options.legacyAuth === false) {
        this.authenticationFailed(
          socket,
          'the server does not support authentication protocol 2 (server before 4.6.5) and legacyAuth is false',
        );
      } else {
        this.protocol = 1;
        this.options.logger.log(
          `DianaDB server ${this.options.host}:${this.options.port} is older than 4.6.5: using legacy authentication ` +
            '(upgrade the server, then set legacyAuth: false)',
        );
        this.open();
        return;
      }
    } else if (this.started && stage === 'proof') {
      this.authenticationFailed(socket, 'check the user name and password');
    }
    if (this.inFlight.size) {
      const rejectedEarly: boolean = !this.receivedResponse && Date.now() - this.readyAt < EARLY_CLOSE_MS;
      const reason: string = rejectedEarly
        ? `the server closed the connection without answering; check the user name and password ` +
          `(the server drops connections whose requests it cannot decrypt)`
        : `the connection to ${this.options.host}:${this.options.port} closed before the server answered; ` +
          `the request may or may not have been applied`;
      const ids: string[] = Array.from(this.inFlight);
      this.inFlight.clear();
      for (const id of ids) {
        this.options.connectionManager?.controller?.failRequest(id, reason, 'CONNECTION');
      }
    } else if (this.started && wasConnected && !this.receivedResponse && Date.now() - this.readyAt < EARLY_CLOSE_MS) {
      this.options.logger.error(
        new Error(
          `DianaDB server ${this.options.host}:${this.options.port} closed the connection right after the handshake: ` +
            (this.options.isSubscriber
              ? 'check the user name, password and the server version (subscriber tokens need server 2.x with token support)'
              : 'check the user name'),
        ),
      );
    }
    if (this.started) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        if (this.started) {
          this.open();
        }
      }, this.options.reconnectTimeoutValue);
    }
  }

  /** Line framing: collect chunks until "\n", then decrypt the complete line. Mirrors the server. */
  private onData(chunk: string): void {
    let lineStart: number = 0;
    let newline: number = chunk.indexOf('\n');
    while (newline !== -1) {
      const tail: string = chunk.slice(lineStart, newline);
      const line: string = (this.parts.length ? this.parts.join('') + tail : tail).replace(/\r$/, '');
      this.parts = [];
      this.partsLength = 0;
      lineStart = newline + 1;
      if (line && !this.processLine(line)) {
        return;
      }
      newline = chunk.indexOf('\n', lineStart);
    }
    if (lineStart < chunk.length) {
      const rest: string = lineStart ? chunk.slice(lineStart) : chunk;
      this.parts.push(rest);
      this.partsLength += rest.length;
      if (this.partsLength > MAX_LINE_LENGTH) {
        this.parts = [];
        this.partsLength = 0;
        this.options.logger.error(new Error(`Response line exceeds ${MAX_LINE_LENGTH} characters; reconnecting`));
        this.socket.destroy();
      }
    }
  }

  private processLine(line: string): boolean {
    if (this.stage !== 'ready') {
      this.onHandshakeLine(line, this.socket);
      return !this.socket.destroyed;
    }
    let response: any;
    try {
      // same hardening as the server: prototype keys dropped, nesting limited to 256 levels
      response = parseJson(this.decrypt(line));
    } catch (e) {
      // A complete line that does not decrypt means a wrong password or a corrupted stream. Buffering it would
      // poison every following response, so drop the connection and let it reconnect cleanly.
      this.options.logger.error(new Error(`Undecodable response from the DianaDB server (${e.message}); reconnecting`));
      this.socket.destroy();
      return false;
    }
    this.receivedResponse = true;
    if (response?.clientRequestId) {
      this.inFlight.delete(response.clientRequestId);
    }
    this.options.connectionManager?.controller?.processResponse(response).catch((error: Error) => {
      this.options.logger.error(error);
    });
    return true;
  }
}
