import { EventEmitter } from 'events';
import { Socket } from 'net';
import { connect as tlsConnect, TLSSocket } from 'tls';

import { ConnectOptions } from '@options';
import { CryptoHelper } from '@helper';
import { Request } from '@dto';

export class Connection {
  private eventEmitter: EventEmitter;
  private options: ConnectOptions;
  private socket: Socket;
  private activeSocket: Socket | TLSSocket;
  private _connected: boolean;
  private _connecting: boolean;
  private _started: boolean;
  private rawDataString: string;

  constructor(options: ConnectOptions) {
    this.eventEmitter = new EventEmitter();
    this.options = options;
    this.rawDataString = '';
  }

  public get connected() {
    return this._connected;
  }

  public async connect(connectTimeoutValue: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this._started = true;
      const connectTimeout = setTimeout(() => {
        reject(new Error(`Connect timeout exceeded for ${this.options.host}:${this.options.port}`));
      }, connectTimeoutValue);
      this.setupSocket(() => {
        clearTimeout(connectTimeout);
        resolve();
      });
      this.socket.connect({ host: this.options.host, port: this.options.port });
    });
  }

  public disconnect() {
    this._started = false;
    this.activeSocket?.removeAllListeners();
    this.activeSocket?.destroy();
    this.socket.removeAllListeners();
    this.socket.destroy();
  }

  private setupSocket(callback?: () => void) {
    this._connecting = true;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.activeSocket?.removeAllListeners();
      this.socket.end();
    }
    this.socket = new Socket();

    this.socket.addListener('connect', () => {
      if (this.options.secureServer) {
        const tlsSocket = tlsConnect(
          {
            socket: this.socket,
            rejectUnauthorized: false,
            requestCert: true,
            ...(this.options.tls || {}),
          },
          () => {
            this.onSecureReady(tlsSocket, callback);
          },
        );
        this.activeSocket = tlsSocket;
        this.activeSocket.on('data', (data: string) => this.onData(data));
        this.activeSocket.on('error', (error: Error) => {
          this.options.logger.error(error);
          this.activeSocket.end();
        });
      } else {
        this.activeSocket = this.socket;
        this.activeSocket.on('data', (data: string) => this.onData(data));
        this.onSecureReady(this.activeSocket, callback);
      }
    });

    this.socket.on('error', (error: Error) => {
      this.options.logger.error(error);
      this.socket.end();
    });

    this.socket.addListener('close', () => {
      this._connected = false;
      if (this._started && !this._connecting) {
        setTimeout(() => {
          this.setupSocket();
        }, this.options.reconnectTimeoutValue);
      }
    });
  }

  private onSecureReady(socket: Socket | TLSSocket, callback?: () => void) {
    this._connected = true;
    this._connecting = false;
    const firstMessage = this.options.isSubscriber
      ? `user:${this.options.user}:subscriber\n`
      : `user:${this.options.user}\n`;
    socket.write(firstMessage);
    if (callback) {
      callback();
    }
  }

  private onData(data: string): void {
    let response: any;
    const dataString: string = data.toString();
    let dataStringGroup: string[] = [];
    if (dataString.match('\n')) {
      dataStringGroup = dataString.split('\n');
    }
    for (let i = 0; i < dataStringGroup.length; i = i + 1) {
      try {
        if (dataStringGroup[i]) {
          const decryptedData: string = this.rawDataString.length
            ? CryptoHelper.decrypt(this.options.password, this.rawDataString + dataStringGroup[i])
            : CryptoHelper.decrypt(this.options.password, dataStringGroup[i]);
          this.rawDataString = '';
          response = JSON.parse(decryptedData);
          this.options.connectionManager.controller.processResponse(response).catch(console.error);
        }
      } catch (e) {
        this.rawDataString += dataStringGroup[i];
      }
    }
  }

  public makeRequest(request: Request<any>): void {
    request.requestGroupId = this.options.requestGroupId;
    this.write(request);
  }

  private write(request: Request<any>): void {
    const data = CryptoHelper.encrypt(this.options.password, JSON.stringify(request));
    this.activeSocket.write(data + '\n');
  }
}
