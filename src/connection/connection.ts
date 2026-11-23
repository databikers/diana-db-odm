import { isIP, Socket } from 'net';
import { connect as tlsConnect, TLSSocket } from 'tls';

import { ConnectOptions } from '@options';
import { CryptoHelper, parseJson } from '@helper';
import { Request } from '@dto';

// Largest response line accepted from the server (base64). Protects memory from a line that never ends.
const MAX_LINE_LENGTH: number = 256 * 1024 * 1024;
// A close this soon after the handshake, before any response arrived, almost always means rejected credentials.
const EARLY_CLOSE_MS: number = 2000;

/**
 * One TCP (or TLS) connection to a DianaDB server.
 *
 * Wire format, both directions: one line per message, terminated by "\n".
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

  public connect(connectTimeoutValue: number): Promise<void> {
    this.started = true;
    return new Promise<void>((resolve, reject) => {
      const connectTimeout = setTimeout(() => {
        this.onReady = undefined;
        reject(new Error(`Connect timeout exceeded for ${this.options.host}:${this.options.port}`));
      }, connectTimeoutValue);
      this.onReady = () => {
        clearTimeout(connectTimeout);
        resolve();
      };
      this.open();
    });
  }

  /** Closes the connection for good: no reconnect. Requests still waiting on it are failed immediately. */
  public disconnect(): Promise<void> {
    this.started = false;
    this.onReady = undefined;
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
    this.activeSocket.write(CryptoHelper.encrypt(this.options.password, JSON.stringify(request)) + '\n');
  }

  private open() {
    const socket: Socket = new Socket();
    this.socket = socket;
    this.parts = [];
    this.partsLength = 0;
    this.receivedResponse = false;
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
    socket.write(this.handshake() + '\n');
    this._connected = true;
    this.readyAt = Date.now();
    const onReady = this.onReady;
    this.onReady = undefined;
    onReady?.();
    this.options.connectionManager?.onConnectionReady(this);
  }

  /** "user:<name>" for requests; subscribers add a token that proves they know the password. */
  private handshake(): string {
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
    this._connected = false;
    this.parts = [];
    this.partsLength = 0;
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
    } else if (wasConnected && !this.receivedResponse && Date.now() - this.readyAt < EARLY_CLOSE_MS) {
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
    let response: any;
    try {
      // same hardening as the server: prototype keys dropped, nesting limited to 256 levels
      response = parseJson(CryptoHelper.decrypt(this.options.password, line));
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
