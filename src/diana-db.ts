import { v4 } from 'uuid';
import {
  ClientAction,
  DEFAULT_CONNECT_TIMEOUT_VALUE,
  DEFAULT_REQUEST_TIMEOUT_VALUE,
  INITIALIZE_EVENT,
  ServerAction,
} from '@const';
import { Request, TransactionInfo, Migration } from '@dto';
import { DatabaseUpdate, ManageTransactionParameters, ServerResponse, StartTransactionParameters } from '@parameters';
import { eventEmitter } from '@event-emitter';
import { DianaDbOptions } from '@options';
import { ConnectionManager } from '@connection';
import { ProcessController } from '@controller';
import { Validator } from '@validate';
import { ErrorFactory } from '@error';
import { eventKeyHelper } from '@helper';

export class DianaDb {
  private readonly options: DianaDbOptions;
  private readonly connectionManager: ConnectionManager;
  public readonly controller: ProcessController;
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
    this.connectionManager = new ConnectionManager({ ...this.options, dianaDb: this });
    this.controller = new ProcessController(this.connectionManager);
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
        reject(`Connection to the DianaDb Server was rejected by timeout.`);
      }, connectTimeoutValue);
      eventEmitter.on(INITIALIZE_EVENT, () => {
        clearTimeout(connectTimeout);
        this.options.logger.log(`ODM is ready`);
        resolve(true);
      });
      this.connectionManager.connect(this.options.connectTimeoutValue || DEFAULT_CONNECT_TIMEOUT_VALUE).catch(reject);
    });
  }

  public disconnect(): Promise<void> {
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
      this.controller.processRequest(request as Request<any>).catch(reject);
    });
  }
}
