import {
  ClientAction,
  MigrationStatus,
  DEFAULT_CONNECT_TIMEOUT_VALUE,
  DEFAULT_CONNECTION_PULL_SIZE,
  DEFAULT_RECONNECT_TIMEOUT_VALUE,
  DEFAULT_REQUEST_TIMEOUT_VALUE,
  DEFAULT_SERVER_PORT,
} from '@const';
import { Request, TransactionInfo, Migration, MigrationInfo, TransformQuery } from '@dto';
import { DatabaseUpdate, ManageTransactionParameters, StartTransactionParameters } from '@parameters';
import { parseConnectionString } from '@helper';
import { DianaDbOptions } from '@options';
import { Connection, ConnectionManager } from '@connection';
import { ProcessController } from '@controller';
import { Validator } from '@validate';
import { ErrorFactory } from '@error';
import { Schema } from '@schema';

export type Subscriber = (databaseUpdate: DatabaseUpdate) => void;

export class DianaDb {
  private readonly options: DianaDbOptions;
  private readonly connectionManager: ConnectionManager;
  public readonly controller: ProcessController;
  private migrations: Map<number, Migration>;
  private subscribers: Map<string, Set<Subscriber>>;
  private subscribersConnection: Connection;
  private subscribersConnecting: Promise<void>;

  constructor(options: DianaDbOptions | string) {
    if (typeof options === 'string') {
      if (!options.startsWith('diana-db://') && !options.startsWith('diana-dbs://')) {
        throw ErrorFactory.configurationError(`invalid protocol`);
      }
      options = parseConnectionString(options);
    }
    Validator.clientOptions(options);
    this.options = {
      ...options,
      port: options.port || DEFAULT_SERVER_PORT,
      connectionPoolSize: options.connectionPoolSize || DEFAULT_CONNECTION_PULL_SIZE,
      reconnectTimeoutValue: options.reconnectTimeoutValue || DEFAULT_RECONNECT_TIMEOUT_VALUE,
      requestTimeoutValue: options.requestTimeoutValue || DEFAULT_REQUEST_TIMEOUT_VALUE,
      logger: options.logger || console,
    };
    this.migrations = new Map<number, Migration>();
    this.subscribers = new Map<string, Set<Subscriber>>();
    this.connectionManager = new ConnectionManager({ ...this.options, dianaDb: this });
    this.controller = new ProcessController(this.connectionManager, this.options.requestTimeoutValue);
    this.controller.onPublish = (databaseUpdate: DatabaseUpdate) => this.onPublish(databaseUpdate);
  }

  private onPublish(databaseUpdate: DatabaseUpdate) {
    if (!databaseUpdate) {
      return;
    }
    const { database, collection } = databaseUpdate;
    for (const key of [
      database,
      `${database}.${collection}`,
    ]) {
      for (const subscriber of this.subscribers.get(key) || []) {
        try {
          subscriber(databaseUpdate);
        } catch (error) {
          // One failing subscriber must not stop the others or the connection.
          this.options.logger.error(error);
        }
      }
    }
  }

  /** Resolves once the first pooled connection is up. Rejects with a CONNECTION error after the timeout. */
  public async connect(connectTimeoutValue?: number): Promise<boolean> {
    const timeout: number = connectTimeoutValue || this.options.connectTimeoutValue || DEFAULT_CONNECT_TIMEOUT_VALUE;
    await this.connectionManager.connect(timeout);
    if (this.subscribers.size) {
      // Reconnecting after disconnect(): restore the subscriptions as well.
      await this.ensureSubscribersConnection();
    }
    this.options.logger.log(`DianaDB ODM is ready`);
    return true;
  }

  /** Closes every connection, the subscriber connection included. Pending requests fail at once. */
  public async disconnect(): Promise<void> {
    const subscribersConnection: Connection = this.subscribersConnection;
    this.subscribersConnection = undefined;
    this.subscribersConnecting = undefined;
    await Promise.all([
      this.connectionManager.disconnect(),
      subscribersConnection?.disconnect(),
    ]);
  }

  public addMigration(migration: Migration): void {
    const key = migration.index;
    if (this.migrations.has(key)) {
      throw ErrorFactory.migrationError(`Index should be unique, index ${key} is used already.`);
    }
    if (Array.from(this.migrations.values()).some((item: Migration) => item.name === migration.name)) {
      throw ErrorFactory.migrationError(`Name should be unique, name ${migration.name} is used already.`);
    }
    this.migrations.set(key, migration);
  }

  /**
   * Runs every migration not applied yet, in ascending index order. Resolves with the server's record of each
   * one it ran (`{ name, status: 'up' }`).
   * The server keeps one global list of applied migrations but checks WRITE access on a database, so
   * a database is required: pass it here or set the `database` option.
   */
  public async migrateUp(database?: string): Promise<MigrationInfo[]> {
    const db: string = this.migrationDatabase(database);
    const remoteMigrations: string[] = await this.request({ action: ClientAction.GET_MIGRATIONS, database: db });
    const ownMigrations = Array.from(this.migrations.values()).sort((a, b) => a.index - b.index);
    const applied: MigrationInfo[] = [];
    for (const migration of ownMigrations) {
      if (!remoteMigrations.includes(migration.name)) {
        await migration.up();
        applied.push(await this.markMigration(migration.name, ClientAction.MIGRATE_UP, db));
      }
    }
    return applied;
  }

  /**
   * Reverts applied migrations in descending index order: all of them, or only the last `steps`.
   * Resolves with the server's record of each one it reverted (`{ name, status: 'down' }`).
   */
  public async migrateDown(database?: string, steps?: number): Promise<MigrationInfo[]> {
    const db: string = this.migrationDatabase(database);
    const remoteMigrations: string[] = await this.request({ action: ClientAction.GET_MIGRATIONS, database: db });
    const ownMigrations = Array.from(this.migrations.values())
      .filter((migration: Migration) => remoteMigrations.includes(migration.name))
      .sort((a, b) => b.index - a.index);
    const toRevert: Migration[] = steps === undefined ? ownMigrations : ownMigrations.slice(0, Math.max(0, steps));
    const reverted: MigrationInfo[] = [];
    for (const migration of toRevert) {
      await migration.down();
      reverted.push(await this.markMigration(migration.name, ClientAction.MIGRATE_DOWN, db));
    }
    return reverted;
  }

  /**
   * Records a migration as up/down on the server and checks the answer, `{ migration: { name, status } }`.
   * Throws if the server did not confirm it, so a migration whose code ran but which was not recorded is not
   * silently treated as applied (it would run again on the next migrateUp).
   */
  private async markMigration(
    name: string,
    action: ClientAction.MIGRATE_UP | ClientAction.MIGRATE_DOWN,
    database: string,
  ): Promise<MigrationInfo> {
    const expected: MigrationStatus = action === ClientAction.MIGRATE_UP ? MigrationStatus.UP : MigrationStatus.DOWN;
    const data: { migration?: MigrationInfo } = await this.request({ migration: name, action, database });
    const info: MigrationInfo = data?.migration;
    if (!info || info.name !== name || info.status !== expected) {
      throw ErrorFactory.migrationError(
        `the server did not confirm "${name}" as ${expected} (answer: ${JSON.stringify(data)}); ` +
          `its ${expected === MigrationStatus.UP ? 'up()' : 'down()'} has already run`,
      );
    }
    return info;
  }

  /** Names of the migrations the server has recorded as applied. */
  public getMigrations(database?: string): Promise<string[]> {
    return this.request({ action: ClientAction.GET_MIGRATIONS, database: this.migrationDatabase(database) });
  }

  private migrationDatabase(database?: string): string {
    const db: string = database || this.options.database;
    if (!db) {
      throw ErrorFactory.migrationError(
        `a database is required: the server checks WRITE access on it. ` +
          `Pass it to migrateUp/migrateDown or set the "database" option.`,
      );
    }
    return db;
  }

  public getDatabases(): Promise<string[]> {
    return this.request({ action: ClientAction.GET_DATABASE_NAMES });
  }

  public getVersion(): Promise<{ version: string }> {
    return this.request({ action: ClientAction.GET_VERSION });
  }

  public getCollections(database: string): Promise<string[]> {
    return this.request({ action: ClientAction.GET_COLLECTION_NAMES, database });
  }

  public getCollectionSchema<T>(database: string, collection: string): Promise<{ schema: Schema<T>; locked: boolean }> {
    return this.request({ action: ClientAction.GET_COLLECTION_SCHEMA, database, collection });
  }

  public getCollectionSchemaLock(
    database: string,
    collection: string,
  ): Promise<{ collection: string; locked: boolean }> {
    return this.request({ action: ClientAction.GET_COLLECTION_SCHEMA_LOCK, database, collection });
  }

  public lockCollectionSchema(database: string, collection: string): Promise<{ collection: string; locked: boolean }> {
    return this.request({ action: ClientAction.LOCK_COLLECTION_SCHEMA, database, collection });
  }

  public unlockCollectionSchema(
    database: string,
    collection: string,
  ): Promise<{ collection: string; locked: boolean }> {
    return this.request({ action: ClientAction.UNLOCK_COLLECTION_SCHEMA, database, collection });
  }

  public getCollectionViews<T>(
    database: string,
    collection: string,
  ): Promise<Record<string, { transformQueries: TransformQuery<T>[] }>> {
    return this.request({ action: ClientAction.GET_COLLECTION_VIEWS, database, collection });
  }

  public getHealth(): Promise<Record<'memory' | 'cpu' | 'gcp' | 'elu' | 'eld', number>> {
    return this.request({ action: ClientAction.GET_HEALTH });
  }

  /** Resolves with the transaction id (the server answers `{ transactionId }`). */
  public async startTransaction(startTransactionParameters: StartTransactionParameters): Promise<string> {
    const data: { transactionId: string } | string = await this.request({
      database: startTransactionParameters.database,
      autoRollbackAfterMS: startTransactionParameters.autoRollBackAfterMs,
      action: ClientAction.START_TRANSACTION,
    });
    return typeof data === 'string' ? data : data?.transactionId;
  }

  public commitTransaction(manageTransactionParameters: ManageTransactionParameters): Promise<TransactionInfo> {
    return this.request({
      database: manageTransactionParameters.database,
      action: ClientAction.COMMIT_TRANSACTION,
      transactionId: manageTransactionParameters.transactionId,
    });
  }

  public rollbackTransaction(manageTransactionParameters: ManageTransactionParameters): Promise<TransactionInfo> {
    return this.request({
      database: manageTransactionParameters.database,
      action: ClientAction.ROLLBACK_TRANSACTION,
      transactionId: manageTransactionParameters.transactionId,
    });
  }

  /**
   * `key` is "<database>" (every collection) or "<database>.<collection>". Several subscribers per key are
   * allowed. Resolves once the subscriber connection is open.
   */
  public async subscribe(key: string, subscriber: Subscriber): Promise<void> {
    if (!key || typeof key !== 'string') {
      throw ErrorFactory.argumentError(`subscription key should be "<database>" or "<database>.<collection>"`);
    }
    if (typeof subscriber !== 'function') {
      throw ErrorFactory.argumentError(`subscriber should be a function`);
    }
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set<Subscriber>());
    }
    this.subscribers.get(key).add(subscriber);
    await this.ensureSubscribersConnection();
  }

  /** Removes one subscriber, or every subscriber of `key`. Closes the subscriber connection when none are left. */
  public async unsubscribe(key: string, subscriber?: Subscriber): Promise<void> {
    if (subscriber) {
      this.subscribers.get(key)?.delete(subscriber);
      if (!this.subscribers.get(key)?.size) {
        this.subscribers.delete(key);
      }
    } else {
      this.subscribers.delete(key);
    }
    if (!this.subscribers.size && this.subscribersConnection) {
      const connection: Connection = this.subscribersConnection;
      this.subscribersConnection = undefined;
      this.subscribersConnecting = undefined;
      await connection.disconnect();
    }
  }

  private ensureSubscribersConnection(): Promise<void> {
    if (!this.subscribersConnecting) {
      const connection: Connection = new Connection({
        host: this.options.host,
        port: this.options.port,
        user: this.options.user,
        password: this.options.password,
        logger: this.options.logger,
        connectionManager: this.connectionManager,
        reconnectTimeoutValue: this.options.reconnectTimeoutValue,
        secureServer: this.options.secureServer,
        tls: this.options.tls,
        legacyAuth: this.options.legacyAuth,
        isSubscriber: true,
      });
      this.subscribersConnection = connection;
      this.subscribersConnecting = connection
        .connect(this.options.connectTimeoutValue || DEFAULT_CONNECT_TIMEOUT_VALUE)
        .catch(async (error: Error) => {
          this.subscribersConnection = undefined;
          this.subscribersConnecting = undefined;
          await connection.disconnect();
          throw error;
        });
    }
    return this.subscribersConnecting;
  }

  public createCollection<T>(
    database: string,
    collection: string,
    schema: Schema<T>,
  ): Promise<{ collection: string; action: string }> {
    // addCollection rather than createCollection: older servers only know that name.
    return this.request({ action: ClientAction.ADD_COLLECTION, database, collection, schema });
  }

  public removeCollection(database: string, collection: string): Promise<{ collection: string; action: string }> {
    return this.request({ action: ClientAction.REMOVE_COLLECTION, database, collection });
  }

  public removeDatabase(database: string): Promise<{ database: string; action: string }> {
    return this.request({ action: ClientAction.REMOVE_DATABASE, database });
  }

  public createDatabase(database: string): Promise<{ database: string; action: string }> {
    return this.request({ action: ClientAction.CREATE_DATABASE, database });
  }

  protected async request(request: Partial<Request<any>>): Promise<any> {
    const response = await this.controller.request(request);
    return response.data;
  }
}
