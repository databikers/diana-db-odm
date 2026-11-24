import { CONNECT_EVENT, DEFAULT_CONNECTION_PULL_SIZE, DEFAULT_RECONNECT_TIMEOUT_VALUE } from '@const';
import { DianaDbOptions } from '@options';
import { eventEmitter } from '@event-emitter';
import { ErrorFactory } from '@error';
import { Request } from '@dto';
import { Connection } from './connection';
import { randomId } from '@helper';

export class ConnectionManager {
  private options: DianaDbOptions;
  private connections: Connection[];
  private connectionIndex: number;
  private started: boolean = false;
  // Requests issued while every pooled connection is reconnecting. Sent as soon as one is back, or failed
  // by their own timeout.
  private queue: Request<any>[] = [];
  // authentication protocol of the server: 2 until a connection finds a server older than 4.6.5
  public protocol: 1 | 2 = 2;

  constructor(options: DianaDbOptions) {
    this.options = options;
    this.connections = [];
    this.connectionIndex = 0;
    this.setupConnections();
  }

  public get connection(): Connection | undefined {
    this.connectionIndex = this.connectionIndex + 1;
    const activeConnections = this.connections.filter((connection: Connection) => connection.connected);
    if (activeConnections.length) {
      return activeConnections[this.connectionIndex % activeConnections.length];
    }
  }

  public get controller() {
    return this.options.dianaDb?.controller;
  }

  private setupConnections() {
    const requestGroupId = randomId();
    const { user, password, host, port, logger } = this.options;
    const connectionPoolSize: number = this.options.connectionPoolSize || DEFAULT_CONNECTION_PULL_SIZE;
    for (let i = 0; i < connectionPoolSize; i = i + 1) {
      const connection = new Connection({
        user,
        password,
        host,
        port,
        logger,
        reconnectTimeoutValue: this.options.reconnectTimeoutValue || DEFAULT_RECONNECT_TIMEOUT_VALUE,
        requestGroupId,
        connectionManager: this,
        secureServer: this.options.secureServer,
        tls: this.options.tls,
        legacyAuth: this.options.legacyAuth,
      });
      this.connections.push(connection);
    }
  }

  /** Resolves as soon as one pooled connection is up; the others keep connecting in the background. */
  public async connect(connectTimeoutValue: number): Promise<void> {
    await Promise.all(this.connections.map((connection: Connection) => connection.disconnect()));
    this.connections = [];
    this.protocol = 2;
    this.setupConnections();
    this.started = true;
    try {
      await Promise.any(this.connections.map((connection: Connection) => connection.connect(connectTimeoutValue)));
    } catch (e) {
      await this.disconnect(false);
      const reasons: Error[] = e instanceof AggregateError ? e.errors : [];
      const refused: Error | undefined = reasons.find((reason: Error) => /^Authentication with /.test(reason?.message));
      throw ErrorFactory.connectionError(
        refused
          ? refused.message
          : `Connection to the DianaDb Server ${this.options.host}:${this.options.port} was rejected by timeout (${connectTimeoutValue} ms).`,
      );
    }
    eventEmitter.emit(CONNECT_EVENT);
  }

  /** Sends now, queues while reconnecting, or throws when the client is not connected at all. */
  public send(request: Request<any>): void {
    if (!this.started) {
      throw ErrorFactory.connectionError(
        `Not connected to ${this.options.host}:${this.options.port}: call connect() before sending requests`,
      );
    }
    const connection: Connection = this.connection;
    if (connection) {
      connection.makeRequest(request);
    } else {
      this.queue.push(request);
    }
  }

  /** Drops a queued request that timed out before any connection came back. */
  public dropQueued(clientRequestId: string): void {
    const index: number = this.queue.findIndex((request: Request<any>) => request.clientRequestId === clientRequestId);
    if (index !== -1) {
      this.queue.splice(index, 1);
    }
  }

  public onConnectionReady(connection: Connection): void {
    if (connection.isSubscriber || !this.queue.length) {
      return;
    }
    const queued: Request<any>[] = this.queue;
    this.queue = [];
    for (const request of queued) {
      // Spread the backlog over every connection that is up by now.
      (this.connection || connection).makeRequest(request);
    }
  }

  public async disconnect(log: boolean = true): Promise<void> {
    this.started = false;
    const queued: Request<any>[] = this.queue;
    this.queue = [];
    for (const request of queued) {
      this.controller?.failRequest(request.clientRequestId, 'the client was disconnected', 'CONNECTION');
    }
    await Promise.all(this.connections.map((connection: Connection) => connection.disconnect()));
    if (log) {
      this.options.logger.log(`Connection to ${this.options.host}:${this.options.port} was closed`);
    }
  }
}
