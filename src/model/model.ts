import { ClientAction, INITIALIZE_EVENT, Types } from '@const';
import { ModelOptions, ValidatorOptions } from '@options';
import { FindQuery, Request, Sorting, UpdateData, TransformQuery } from '@dto';
import { Validator } from '@validate';
import { eventEmitter } from '@event-emitter';
import { Schema } from '@schema';
import { compareSchemas } from '@helper';
import { ErrorFactory } from '@error';
import { ProcessController } from '@controller';

// Documents per insertMany request: large enough to amortize the round trip and the disk sync, small enough
// that one request doesn't hold the server for long. The server accepts at most 10000.
const INSERT_MANY_BATCH_SIZE: number = 1000;
const MAX_INSERT_MANY_BATCH_SIZE: number = 10000;

export class Model<T> {
  private static instances: Model<any>[] = [];
  private initialized: boolean;
  private initializing: Promise<void>;
  private _locked: boolean;
  // The client fixed when the model was constructed, so creating another DianaDb later doesn't re-route it.
  private boundController: ProcessController;

  protected options: ModelOptions<T>;
  protected validator: Validator<T>;

  public get locked() {
    return this._locked;
  }

  constructor(options: ModelOptions<T>) {
    Validator.validateModelOptions(options);
    this.options = options;
    this.validator = new Validator({ name: this.options.name, schema: this.options.schema } as ValidatorOptions<T>);
    this.options.schema._id = {
      type: Types.OBJECT_ID,
    };
    this.boundController = options.dianaDb?.controller || ProcessController.instance;
    Model.instances = Model.instances || [];
    Model.instances.push(this);
  }

  /** Initializes every constructed model. */
  public static async init() {
    await Promise.all(Model.instances.map((model: Model<any>) => model.init()));
    eventEmitter.emit(INITIALIZE_EVENT);
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }

  public async insert(data: any, transactionId?: string): Promise<T & { _id: string }> {
    await this.ensureInitialized();
    data = await this.prepareInsert(data);
    const request: Partial<Request<T>> = {
      database: this.options.database,
      collection: this.options.collection,
      action: ClientAction.INSERT,
      setData: data,
    };
    if (transactionId) {
      request.transactionId = transactionId;
    }
    return this.request(request);
  }

  /**
   * Inserts many documents with one request (and one disk sync on the server) per `batchSize` documents.
   *
   * Every document is checked here before anything is sent. The server checks each batch as a whole: a batch
   * with an invalid document or a repeated unique value inserts nothing. Batches are sent one after another,
   * so when a later batch fails, the earlier ones are already stored; the error names the failing document by
   * its position in `documents`. Use a transaction to make the whole call all-or-nothing.
   */
  public async insertMany(
    documents: any[],
    transactionId?: string,
    batchSize: number = INSERT_MANY_BATCH_SIZE,
  ): Promise<(T & { _id: string })[]> {
    await this.ensureInitialized();
    if (!Array.isArray(documents)) {
      throw ErrorFactory.argumentError('insertMany expects an array of documents');
    }
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_INSERT_MANY_BATCH_SIZE) {
      throw ErrorFactory.argumentError(`batchSize must be an integer from 1 to ${MAX_INSERT_MANY_BATCH_SIZE}`);
    }
    const prepared: any[] = [];
    for (let i = 0; i < documents.length; i = i + 1) {
      try {
        prepared.push(await this.prepareInsert(documents[i]));
      } catch (e) {
        e.message = `document ${i}: ${e.message}`;
        throw e;
      }
    }
    const inserted: (T & { _id: string })[] = [];
    for (let start = 0; start < prepared.length; start = start + batchSize) {
      const request: Partial<Request<T>> = {
        database: this.options.database,
        collection: this.options.collection,
        action: ClientAction.INSERT_MANY,
        setData: prepared.slice(start, start + batchSize) as any,
      };
      if (transactionId) {
        request.transactionId = transactionId;
      }
      try {
        inserted.push(...(await this.request(request)));
      } catch (e) {
        // the server counts documents from the start of the batch
        e.message = String(e.message).replace(/document (\d+):/, (_: string, index: string) => {
          return `document ${start + Number(index)}:`;
        });
        throw e;
      }
    }
    return inserted;
  }

  /** Copy of `data` with defaults and setters applied, checked against the schema. */
  protected async prepareInsert(data: any): Promise<any> {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw ErrorFactory.schemaError(`document should be an object`, 'stored document');
    }
    // Defaults and setters are applied to a copy: the caller's object is left as it was.
    data = { ...data };
    const keys = Object.keys(this.options.schema);
    for (const key of keys) {
      if (data[key] === undefined && this.options.schema[key].default !== undefined) {
        if (typeof this.options.schema[key].default === 'function') {
          data[key] = await this.options.schema[key].default.apply(data, []);
        } else {
          data[key] = this.options.schema[key].default;
        }
      }
    }
    for (const key in data) {
      if (this.options.schema[key]?.set) {
        if (typeof this.options.schema[key].set === 'function') {
          const setValue = await this.options.schema[key].set.apply(data, [data[key]]);
          if (setValue !== undefined && !Number.isNaN(setValue)) {
            data[key] = setValue;
          }
        }
      }
    }
    this.validator.requiredFields(data);
    this.validator.data(data);
    return data;
  }

  public async createView(
    name: string,
    transformQueries?: TransformQuery<T>[],
  ): Promise<{ view: string; action: string }> {
    await this.ensureInitialized();
    if (!name || typeof name !== 'string') {
      throw ErrorFactory.argumentError(`View name should be a string`);
    }
    if (!Array.isArray(transformQueries)) {
      throw ErrorFactory.argumentError(`View transformQueries should be an array of a valid TransformQuery objects`);
    }
    const request: Partial<Request<T>> = {
      database: this.options.database,
      collection: this.options.collection,
      action: ClientAction.ADD_VIEW,
      transformQueries,
      view: name,
    };
    return this.request(request);
  }

  public async removeView(name: string): Promise<{ view: string; action: string }> {
    await this.ensureInitialized();
    if (!name || typeof name !== 'string') {
      throw ErrorFactory.argumentError(`View name should be a string`);
    }

    const request: Partial<Request<T>> = {
      database: this.options.database,
      collection: this.options.collection,
      action: ClientAction.REMOVE_VIEW,
      view: name,
    };
    return this.request(request);
  }

  public async findByView(
    view: string,
    findQuery?: FindQuery<T>,
    sorting?: Sorting<any>,
    skip?: number,
    limit?: number,
  ): Promise<any[]> {
    await this.ensureInitialized();
    if (!view || typeof view !== 'string') {
      throw ErrorFactory.argumentError(`View name should be a string`);
    }
    if (!findQuery) {
      findQuery = {};
    }
    const request: Partial<Request<T>> = {
      database: this.options.database,
      collection: this.options.collection,
      action: ClientAction.FIND_BY_VIEW,
      filterQueries: [findQuery],
      view,
    };
    if (findQuery) {
      this.validator.filterQueries([findQuery]);
    }
    if (sorting) {
      this.validator.sortQuery(sorting);
      request.sortQuery = sorting;
    }
    if (skip) {
      this.validator.skip(skip);
      request.skip = skip;
    }
    if (limit !== undefined && limit !== null) {
      this.validator.limit(limit);
      request.limit = limit;
    }
    return this.request(request);
  }

  public async countByView(view: string, findQuery?: FindQuery<T>): Promise<number> {
    await this.ensureInitialized();
    if (!view || typeof view !== 'string') {
      throw ErrorFactory.argumentError(`View name should be a string`);
    }
    if (!findQuery) {
      findQuery = {};
    }
    const request: Partial<Request<T>> = {
      database: this.options.database,
      collection: this.options.collection,
      action: ClientAction.COUNT_BY_VIEW,
      filterQueries: [findQuery],
      view,
    };
    if (findQuery) {
      this.validator.filterQueries([findQuery]);
    }
    return this.request(request);
  }

  public async find(
    filterQueries: FindQuery<T>[] | FindQuery<T> = [{}],
    transformQueries?: TransformQuery<T>[],
    sorting?: Sorting<T>,
    skip?: number,
    limit?: number,
    transactionId?: string,
  ): Promise<T[]> {
    await this.ensureInitialized();
    const filters: FindQuery<T>[] = this.toFilters(filterQueries);
    this.validator.filterQueries(filters);
    const request: Partial<Request<T>> = {
      database: this.options.database,
      collection: this.options.collection,
      action: ClientAction.FIND,
    };
    request.filterQueries = filters;
    if (transformQueries) {
      this.validator.transformQueries(transformQueries);
      request.transformQueries = transformQueries;
    }
    if (sorting) {
      this.validator.sortQuery(sorting);
      request.sortQuery = sorting;
    }
    if (skip) {
      this.validator.skip(skip);
      request.skip = skip;
    }
    if (limit !== undefined && limit !== null) {
      this.validator.limit(limit);
      request.limit = limit;
    }
    if (transactionId) {
      request.transactionId = transactionId;
    }
    const items: T[] = (await this.request(request)) || [];
    if (!transformQueries || !Array.isArray(transformQueries) || !transformQueries.length) {
      for (const item of items) {
        const keys: string[] = Object.keys(this.options.schema);
        for (const key of keys) {
          if (typeof this.options.schema[key].get === 'function') {
            item[key as keyof T] = await this.options.schema[key].get.apply(item, []);
          } else if (this.options.schema[key].default !== undefined && item[key as keyof T] === undefined) {
            if (typeof this.options.schema[key].default === 'function') {
              item[key as keyof T] = await this.options.schema[key].default.apply(item, []);
            } else {
              item[key as keyof T] = this.options.schema[key].default;
            }
          }
        }
      }
    }
    return items;
  }

  public async distinct(key: keyof T | string): Promise<any[]> {
    await this.ensureInitialized();
    const request: Partial<Request<T>> = {
      database: this.options.database,
      collection: this.options.collection,
      action: ClientAction.DISTINCT,
      distinctKey: key as string,
    };
    return this.request(request);
  }

  public async max(key: keyof T | string): Promise<T[]> {
    await this.ensureInitialized();
    const request: Partial<Request<T>> = {
      database: this.options.database,
      collection: this.options.collection,
      action: ClientAction.MAX,
      distinctKey: key as string,
    };
    return this.request(request);
  }

  public async min(key: keyof T | string): Promise<T[]> {
    await this.ensureInitialized();
    const request: Partial<Request<T>> = {
      database: this.options.database,
      collection: this.options.collection,
      action: ClientAction.MIN,
      distinctKey: key as string,
    };
    return this.request(request);
  }

  public async count(
    filterQueries: FindQuery<T>[] | FindQuery<T> = [{}],
    transformQueries?: TransformQuery<T>[],
    transactionId?: string,
  ): Promise<number> {
    await this.ensureInitialized();
    const request: Partial<Request<T>> = {
      database: this.options.database,
      collection: this.options.collection,
      action: ClientAction.COUNT,
    };
    const filters: FindQuery<T>[] = this.toFilters(filterQueries);
    this.validator.filterQueries(filters);
    request.filterQueries = filters;
    if (transformQueries && transformQueries.length) {
      this.validator.transformQueries(transformQueries);
      request.transformQueries = transformQueries;
    }
    if (transactionId) {
      request.transactionId = transactionId;
    }
    return this.request(request);
  }

  public async update(
    filterQueries: FindQuery<T>[] | FindQuery<T>,
    updateData: UpdateData<T>,
    transactionId?: string,
  ): Promise<{ found: number; modified: number }> {
    await this.ensureInitialized();
    if (!updateData || typeof updateData !== 'object') {
      throw ErrorFactory.argumentError(`updateData should be an object`);
    }
    const filters: FindQuery<T>[] = this.toFilters(filterQueries);
    this.validator.filterQueries(filters);
    // Setters are applied to a copy: the caller's object is left as it was.
    updateData = { ...updateData };
    this.validator.mutableFields(updateData);
    for (const key in updateData) {
      if (this.options.schema[key]?.set) {
        if (typeof this.options.schema[key].set === 'function') {
          const setValue = await this.options.schema[key].set.apply(updateData, [updateData[key]]);
          if (setValue !== undefined && !Number.isNaN(setValue)) {
            updateData[key] = setValue;
          }
        }
      }
    }
    this.validator.data(updateData, true);
    const request: Partial<Request<T>> = {
      database: this.options.database,
      collection: this.options.collection,
      action: ClientAction.UPDATE,
    };
    request.filterQueries = filters;
    request.setData = updateData;
    if (transactionId) {
      request.transactionId = transactionId;
    }
    return this.request(request);
  }

  public async remove(
    filterQueries: FindQuery<T>[] | FindQuery<T>,
    transactionId?: string,
  ): Promise<{ found: number; removed: number }> {
    await this.ensureInitialized();
    const filters: FindQuery<T>[] = this.toFilters(filterQueries);
    this.validator.filterQueries(filters);
    const request: Partial<Request<T>> = {
      database: this.options.database,
      collection: this.options.collection,
      action: ClientAction.REMOVE,
    };
    if (transactionId) {
      request.transactionId = transactionId;
    }
    request.filterQueries = filters;
    return this.request(request);
  }

  private toFilters(filterQueries: FindQuery<T>[] | FindQuery<T>): FindQuery<T>[] {
    if (filterQueries === undefined || filterQueries === null) {
      return [{}];
    }
    const filters: FindQuery<T>[] = Array.isArray(filterQueries) ? filterQueries : [filterQueries];
    return filters.length ? filters : [{}];
  }

  /**
   * The client this model talks through: `options.dianaDb`, else the DianaDb most recently constructed before
   * this model (or, for a model constructed before any client, the latest one at the time of the request).
   */
  protected get controller(): ProcessController {
    const controller: ProcessController = this.boundController || ProcessController.instance;
    if (!controller) {
      throw ErrorFactory.configurationError(
        `model ${this.options.name}: construct a DianaDb (or pass "dianaDb" in the model options) first`,
      );
    }
    return controller;
  }

  protected async request(request: Partial<Request<T>>): Promise<any> {
    const { action } = request;
    const response = await this.controller.request<T>(request);
    const { data, found, modified, removed } = response;
    switch (action) {
      case ClientAction.UPDATE:
        return { found, modified };
      case ClientAction.REMOVE:
        return { found, removed };
      default:
        return data as any;
    }
  }

  /**
   * Creates the collection, or reconciles its schema with the server. Safe to call concurrently: every caller
   * shares one attempt, and a failed attempt can be retried.
   */
  public init(): Promise<void> {
    if (this.initialized) {
      return Promise.resolve();
    }
    if (!this.initializing) {
      this.initializing = this.reconcile().then(
        () => {
          this.initialized = true;
          this.initializing = undefined;
        },
        (error: Error) => {
          this.initializing = undefined;
          throw error;
        },
      );
    }
    return this.initializing;
  }

  protected async reconcile(): Promise<void> {
    const collectionExists: boolean = await this.checkCollectionExistence();
    if (collectionExists) {
      const { schema, locked } = await this.getRemoteSchema();
      this._locked = locked;
      const isDifferent: boolean = this.compareSchemas(schema);
      if (isDifferent) {
        if (locked) {
          throw ErrorFactory.remoteSchemaError(
            `Schema mismatch: collection ${this.options.collection} is locked on the remote server, and its schema differs from the local one`,
          );
        } else {
          await this.updateSchema();
        }
      }
    } else {
      await this.createCollection();
    }
  }

  protected async checkCollectionExistence(): Promise<boolean> {
    const request: Partial<Request<T>> = {
      database: this.options.database,
      collection: this.options.collection,
      action: ClientAction.GET_COLLECTION_NAMES,
    };
    const collections: string[] = await this.request(request);
    return collections?.includes(this.options.collection);
  }

  protected async createCollection(): Promise<any> {
    const request: Partial<Request<T>> = {
      database: this.options.database,
      collection: this.options.collection,
      action: ClientAction.ADD_COLLECTION,
    };
    request.schema = this.getConvertedSchema();
    return this.request(request);
  }

  protected getConvertedSchema(): Schema<T> {
    const schema: Schema<T> = {};
    for (const key in this.options.schema) {
      schema[key] = Object.assign({}, this.options.schema[key]);
      schema[key].default = undefined;
    }
    return schema as Schema<T>;
  }

  protected async getRemoteSchema(): Promise<{ schema: Schema<T>; locked: boolean }> {
    const request: Partial<Request<T>> = {
      database: this.options.database,
      collection: this.options.collection,
      action: ClientAction.GET_COLLECTION_SCHEMA,
    };
    return this.request(request);
  }

  protected compareSchemas(schema: Schema<T>): boolean {
    return compareSchemas<T>(this.options.schema, schema);
  }

  protected updateSchema(): Promise<any> {
    const request: Partial<Request<T>> = {
      database: this.options.database,
      collection: this.options.collection,
      action: ClientAction.UPDATE_COLLECTION,
      schema: this.getConvertedSchema(),
    };
    return this.request(request);
  }

  public async lock(): Promise<{ collection: string; locked: boolean }> {
    const request: Partial<Request<T>> = {
      database: this.options.database,
      collection: this.options.collection,
      action: ClientAction.LOCK_COLLECTION_SCHEMA,
    };
    const result = await this.request(request);
    this._locked = result?.locked;
    return result;
  }

  public async unlock(): Promise<{ collection: string; locked: boolean }> {
    const request: Partial<Request<T>> = {
      database: this.options.database,
      collection: this.options.collection,
      action: ClientAction.UNLOCK_COLLECTION_SCHEMA,
    };
    const result = await this.request(request);
    this._locked = result?.locked;
    return result;
  }

  public async getViews(): Promise<Record<string, { transformQueries: TransformQuery<T>[] }>> {
    const request: Partial<Request<T>> = {
      database: this.options.database,
      collection: this.options.collection,
      action: ClientAction.GET_COLLECTION_VIEWS,
    };
    return this.request(request);
  }
}
