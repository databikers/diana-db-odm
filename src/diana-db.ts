import {
  ClientAction,
  DEFAULT_CONNECT_TIMEOUT_VALUE,
  DEFAULT_REQUEST_TIMEOUT_VALUE,
  INITIALIZE_EVENT,
  ServerAction,
} from '@const';
import { Request, TransactionInfo } from '@dto';
import { DianaDbOptions } from '@options';
import { Connection, ConnectionManager } from '@connection';
import { QueueProcessor, requestQueue, responseQueue } from '@queue';
import { processController } from '@controller';
import { ManageTransactionParameters, ServerResponse, StartTransactionParameters } from '@parameters';
import { Validator } from '@validate';
import { eventEmitter } from '@vent-emitter';
import { Migration } from './dto/migration';
import { ErrorFactory } from '@error';
import { v4 } from 'uuid';
import { eventKeyHelper } from '@helper';
import * as console from 'console';
import { DatabaseUpdate } from '@parameters';

export class DianaDb {
  private options: DianaDbOptions;
  private connectionManager: ConnectionManager;
  private requestProcessor: QueueProcessor<any>;
  private responseProcessor: QueueProcessor<any>;
  private migrations: Map<number, Migration>;
  private subscribers: Map<string, (DatabaseUpdate: DatabaseUpdate) => void>;

  constructor(options: DianaDbOptions) {
    Validator.clientOptions(options);
    this.options = options;
    if (!this.options.logger) {
      this.options.logger = console;
    }
    this.migrations = new Map<number, Migration>();
    this.subscribers = new Map<string, (data: any) => {}>();
    this.connectionManager = new ConnectionManager(this.options);
    this.requestProcessor = new QueueProcessor({
      queue: requestQueue,
      connectionManager: this.connectionManager,
      processor: (request: Request<any>, connection: Connection) =>
        processController.processRequest(request, connection),
    });
    this.responseProcessor = new QueueProcessor({
      queue: responseQueue,
      connectionManager: this.connectionManager,
      processor: (response: ServerResponse<any>) => processController.processResponse(response),
    });
    eventEmitter.on(ServerAction.PUBLISH, (DatabaseUpdate: DatabaseUpdate) => this.onPublish(DatabaseUpdate));
  }

  private onPublish(DatabaseUpdate: DatabaseUpdate) {
    const { database, collection } = DatabaseUpdate.data;
    const keyDC = `${database}.${collection}`;
    const keyD = `${database}`;
    if (this.subscribers.has(keyD)) {
      this.subscribers.get(keyD)(DatabaseUpdate);
    }
    if (this.subscribers.has(keyDC)) {
      this.subscribers.get(keyDC)(DatabaseUpdate);
    }
  }

  public async connect(connectTimeoutValue: number): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      const connectTimeout = setTimeout(() => {
        eventEmitter.removeAllListeners(INITIALIZE_EVENT);
        reject(`ODM is ready now`);
      }, connectTimeoutValue);
      eventEmitter.on(INITIALIZE_EVENT, () => {
        clearTimeout(connectTimeout);
        this.options.logger.log(`ODM started`);
        resolve(true);
      });
      this.connectionManager.connect(this.options.connectTimeoutValue || DEFAULT_CONNECT_TIMEOUT_VALUE).catch(reject);
    });
  }

  public disconnect(): Promise<void> {
    this.requestProcessor.stopProcessing();
    this.responseProcessor.stopProcessing();
    return this.connectionManager.disconnect();
  }

  public addMigration(migration: Migration): void {
    const key = migration.index;
    if (this.migrations.has(key)) {
      throw ErrorFactory.migrationError(`Index should be unique, index ${key} is used already.`);
    }
    this.migrations.set(key, migration);
  }

  public async migrateUp(): Promise<void> {
    const request: Request<any> = {
      action: ClientAction.GET_MIGRATIONS,
    };
    const remoteMigrations: number[] = await this.request(request);
    const ownMigrations = Array.from(this.migrations.values()).sort((a, b) => a.index - b.index);
    for (let i = 0; i < ownMigrations.length; i++) {
      const migration: Migration = ownMigrations[i];
      if (!remoteMigrations.includes(migration.index)) {
        await migration.up();
        await this.request({
          migration: migration.index,
          action: ClientAction.MIGRATE_UP,
        });
      }
    }
  }

  public async migrateDown(): Promise<void> {
    const request: Request<any> = {
      action: ClientAction.GET_MIGRATIONS,
    };
    const remoteMigrations: number[] = await this.request(request);
    const ownMigrations = Array.from(this.migrations.values()).sort((a, b) => a.index - b.index);
    for (let i = 0; i < ownMigrations.length; i++) {
      const migration: Migration = ownMigrations[i];
      if (remoteMigrations.includes(migration.index)) {
        await migration.down();
        await this.request({
          migration: migration.index,
          action: ClientAction.MIGRATE_DOWN,
        });
      }
    }
  }

  public async startTransaction(startTransactionParameters: StartTransactionParameters): Promise<string> {
    const request: Partial<Request<any>> = {
      database: startTransactionParameters.database,
      autoRollbackAfterMS: startTransactionParameters.autoRollbackAfterMS,
      action: ClientAction.START_TRANSACTION,
    };
    return this.request(request);
  }

  public async commitTransaction(manageTransactionParameters: ManageTransactionParameters): Promise<TransactionInfo> {
    const request: Partial<Request<any>> = {
      database: manageTransactionParameters.database,
      action: ClientAction.COMMIT_TRANSACTION,
    };
    return this.request(request);
  }

  public async rollbackTransaction(manageTransactionParameters: ManageTransactionParameters): Promise<TransactionInfo> {
    const request: Partial<Request<any>> = {
      database: manageTransactionParameters.database,
      action: ClientAction.ROLLBACK_TRANSACTION,
    };
    return this.request(request);
  }

  public subscribe(key: string, subscriber: (DatabaseUpdate: DatabaseUpdate) => void): void {
    this.subscribers.set(key, subscriber);
  }

  protected request(request: Partial<Request<any>>): Promise<any> {
    const clientRequestId = v4();
    request.clientRequestId = clientRequestId;
    if (!request.timeoutValue) {
      request.timeoutValue = DEFAULT_REQUEST_TIMEOUT_VALUE;
    }
    const responseKey = eventKeyHelper(clientRequestId, 'response');
    const errorKey = eventKeyHelper(clientRequestId, 'error');
    return new Promise((resolve, reject) => {
      eventEmitter.addListener(responseKey, (response: ServerResponse<any>) => {
        eventEmitter.removeAllListeners(responseKey);
        eventEmitter.removeAllListeners(errorKey);
        const { data } = response;
        return resolve(data);
      });
      eventEmitter.addListener(errorKey, (error: string) => {
        eventEmitter.removeAllListeners(responseKey);
        eventEmitter.removeAllListeners(errorKey);
        return reject(new Error(error));
      });
      requestQueue.enqueue(request as Request<any>);
    });
  }
}
