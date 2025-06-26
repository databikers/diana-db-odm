import { DianaDbOptions } from '@options';
import { Connection } from './connection';
import { eventEmitter } from '@event-emitter';
import { CONNECT_EVENT } from '@const';
import { v4 } from 'uuid';

export class ConnectionManager {
  private options: DianaDbOptions;
  private connections: Connection[];
  private connectionIndex: number;

  constructor(options: DianaDbOptions) {
    this.options = options;
    this.connections = [];
    this.connectionIndex = 0;
    this.setupConnections();
  }

  public get connection() {
    this.connectionIndex = this.connectionIndex + 1;
    const activeConnections = this.connections.filter((connection: Connection) => connection.connected);
    if (activeConnections.length) {
      return activeConnections[this.connectionIndex % activeConnections.length];
    }
  }

  public get controller() {
    return this.options.dianaDb.controller;
  }

  private setupConnections() {
    const requestGroupId = v4();
    const { user, password, host, port, logger, connectionPoolSize } = this.options;
    for (let i = 0; i < connectionPoolSize; i = i + 1) {
      const connection = new Connection({
        user,
        password,
        host,
        port,
        logger,
        reconnectTimeout: 1000,
        requestGroupId,
        connectionManager: this,
      });
      this.connections.push(connection);
    }
  }

  public async connect(connectTimeoutValue: number): Promise<void> {
    await Promise.race(this.connections.map((connection: Connection) => connection.connect(connectTimeoutValue)));
    eventEmitter.emit(CONNECT_EVENT);
  }

  public async disconnect(): Promise<void> {
    await Promise.all(this.connections.map((connection: Connection) => connection.disconnect()));
    this.options.logger.log(`Connection to ${this.options.host}:${this.options.port} was closed`);
  }
}
