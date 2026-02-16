import { v4 } from 'uuid';
import { ClientAction, DEFAULT_REQUEST_TIMEOUT_VALUE, INITIALIZE_EVENT, Types } from '@const';
import { ModelOptions, ValidatorOptions } from '@options';
import { FindQuery, Request, Sorting, UpdateData, TransformQuery } from '@dto';
import { Validator } from '@validate';
import { eventEmitter } from '@event-emitter';
import { ServerResponse } from '@parameters';
import { Schema } from '@schema';
import { eventKeyHelper, compareSchemas } from '@helper';
import { ErrorFactory } from '@error';
import { ProcessController } from '@controller';

export class Model<T> {
  private initialized: boolean;
  private static instances: Model<any>[] = [];

  protected options: ModelOptions<T>;
  protected validator: Validator<T>;

  constructor(options: ModelOptions<T>) {
    Validator.validateModelOptions(options);
    this.options = options;
    this.validator = new Validator({ name: this.options.name, schema: this.options.schema } as ValidatorOptions<T>);
    this.options.schema._id = {
      type: Types.OBJECT_ID,
    };
    Model.instances = Model.instances || [];
    Model.instances.push(this);
  }

  public static async init() {
    await Promise.all(Model.instances.map((model: Model<any>) => model.init));
    eventEmitter.emit(INITIALIZE_EVENT);
  }

  public async insert(data: any, transactionId?: string): Promise<T & { _id: string }> {
    if (!this.initialized) {
      await this.init();
    }
    if (!data || typeof data !== 'object') {
      throw ErrorFactory.schemaError(`document should be an object`, 'stored document');
    }
    for (const key in this.options.schema as Schema<T>) {
      if (data[key] === undefined && Object.prototype.hasOwnProperty.apply(this.options.schema[key], ['default'])) {
        if (typeof this.options.schema[key].default === 'function') {
          data[key] = await this.options.schema[key].default.apply(data, []);
        } else {
          data[key] = this.options.schema[key].default;
        }
      }
    }
    this.validator.requiredFields(data);
    this.validator.data(data);
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

  public createView(name: string, transformQueries?: TransformQuery<T>[]) {
    const request: Partial<Request<T>> = {
      database: this.options.database,
      collection: this.options.collection,
      action: ClientAction.ADD_VIEW,
      transformQueries,
      view: name,
    };
    return this.request(request);
  }

  findByView(view: string, findQuery?: FindQuery<T>, sorting?: Sorting<any>, skip?: number, limit?: number) {
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
    if (limit) {
      this.validator.limit(limit);
      request.limit = limit;
    }
    return this.request(request);
  }

  public async find(
    filterQueries: FindQuery<T>[],
    transformQueries?: TransformQuery<T>[],
    sorting?: Sorting<T>,
    skip?: number,
    limit?: number,
    transactionId?: string,
  ): Promise<T[]> {
    if (!this.initialized) {
      await this.init();
    }
    if (!Array.isArray(filterQueries)) {
      filterQueries = [filterQueries];
    }
    this.validator.filterQueries(filterQueries);
    const request: Partial<Request<T>> = {
      database: this.options.database,
      collection: this.options.collection,
      action: ClientAction.FIND,
    };
    if (!filterQueries) {
      filterQueries = [];
    }
    request.filterQueries = Array.isArray(filterQueries) ? filterQueries : [filterQueries];
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
    if (limit) {
      this.validator.limit(limit);
      request.limit = limit;
    }
    if (transactionId) {
      request.transactionId = transactionId;
    }
    return this.request(request);
  }

  public async distinct(key: string): Promise<T[]> {
    if (!this.initialized) {
      await this.init();
    }
    const request: Partial<Request<T>> = {
      database: this.options.database,
      collection: this.options.collection,
      action: ClientAction.DISTINCT,
      distinctKey: key,
    };
    return this.request(request);
  }

  public async max(key: string): Promise<T[]> {
    if (!this.initialized) {
      await this.init();
    }
    const request: Partial<Request<T>> = {
      database: this.options.database,
      collection: this.options.collection,
      action: ClientAction.MAX,
      distinctKey: key,
    };
    return this.request(request);
  }

  public async min(key: string): Promise<T[]> {
    if (!this.initialized) {
      await this.init();
    }
    const request: Partial<Request<T>> = {
      database: this.options.database,
      collection: this.options.collection,
      action: ClientAction.MIN,
      distinctKey: key,
    };
    return this.request(request);
  }

  public async count(filterQueries: FindQuery<T>[], transformQueries?: TransformQuery<T>[], transactionId?: string) {
    if (!this.initialized) {
      await this.init();
    }
    const request: Partial<Request<T>> = {
      database: this.options.database,
      collection: this.options.collection,
      action: ClientAction.COUNT,
    };
    this.validator.filterQueries(filterQueries);
    request.filterQueries = filterQueries;
    if (transformQueries && transformQueries.length) {
      this.validator.transformQueries(transformQueries);
      request.transformQueries = transformQueries;
    }
    if (transactionId) {
      request.transactionId = transactionId;
    }
    return this.request(request);
  }

  public async update(filterQueries: FindQuery<T>[], updateData: UpdateData<T>, transactionId?: string): Promise<any> {
    if (!this.initialized) {
      await this.init();
    }
    if (!Array.isArray(filterQueries)) {
      filterQueries = [filterQueries];
    }
    const request: Partial<Request<T>> = {
      database: this.options.database,
      collection: this.options.collection,
      action: ClientAction.UPDATE,
    };
    this.validator.filterQueries(filterQueries);
    request.filterQueries = filterQueries;
    this.validator.mutableFields(updateData);
    this.validator.data(updateData, true);
    request.setData = updateData;
    if (transactionId) {
      request.transactionId = transactionId;
    }
    return this.request(request);
  }

  public async remove(filterQueries: FindQuery<T>[], transactionId?: string): Promise<any> {
    if (!this.initialized) {
      await this.init();
    }
    if (!Array.isArray(filterQueries)) {
      filterQueries = [filterQueries];
    }
    const request: Partial<Request<T>> = {
      database: this.options.database,
      collection: this.options.collection,
      action: ClientAction.REMOVE,
    };
    if (transactionId) {
      request.transactionId = transactionId;
    }
    this.validator.filterQueries(filterQueries);
    request.filterQueries = filterQueries;
    return this.request(request);
  }

  protected request(request: Partial<Request<T>>): Promise<any> {
    const clientRequestId = v4();
    const { action } = request;
    request.clientRequestId = clientRequestId;
    if (!request.timeoutValue) {
      request.timeoutValue = DEFAULT_REQUEST_TIMEOUT_VALUE;
    }
    const responseKey = eventKeyHelper(clientRequestId, 'response');
    const errorKey = eventKeyHelper(clientRequestId, 'error');
    return new Promise((resolve, reject) => {
      eventEmitter.addListener(responseKey, (response: ServerResponse<T>) => {
        eventEmitter.removeAllListeners(responseKey);
        eventEmitter.removeAllListeners(errorKey);
        const { data, found, modified, removed } = response;
        switch (action) {
          case ClientAction.UPDATE:
            return resolve({ found, modified });
          case ClientAction.REMOVE:
            return resolve({ found, removed });
          default:
            return resolve(data as any);
        }
      });
      eventEmitter.addListener(errorKey, (error: string) => {
        eventEmitter.removeAllListeners(responseKey);
        eventEmitter.removeAllListeners(errorKey);
        return reject(new Error(error));
      });
      ProcessController.instance?.processRequest(request as Request<T>).catch(reject);
    });
  }

  public async init(): Promise<void> {
    this.initialized = true;
    const collectionExists: boolean = await this.checkCollectionExistence();
    if (collectionExists) {
      const remoteSchema: Schema<T> = await this.getRemoteSchema();
      const isDifferent: boolean = this.compareSchemas(remoteSchema);
      if (isDifferent) {
        return this.updateSchema();
      }
    } else {
      return this.createCollection();
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

  protected async getRemoteSchema(): Promise<Schema<T>> {
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
}
