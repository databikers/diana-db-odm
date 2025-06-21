import { Types } from '@const';
import { ErrorFactory } from '@error';
import { ValidatorOptions } from '@options';
import {
  clientOptionsValidator,
  filterQueryValidator,
  modelOptionsValidator,
  setDataValidator,
  sortQueryValidator,
  transformQueriesValidator,
} from './validation-helpers';
import { objectIdQuery } from './schemas';

export class Validator<T> {
  protected options: ValidatorOptions<any>;

  constructor(options: ValidatorOptions<T>) {
    this.options = options;
  }

  public filterQueries(filterQueries: any[]) {
    let validationResult: any;
    for (let i = 0; i < filterQueries.length; i = i + 1) {
      const filterQuery: any = filterQueries[i];
      for (const key in filterQuery) {
        if (!this.options.schema[key]) {
          throw ErrorFactory.findQueryError(
            `property '${key}' doesn't exist in the '${this.options.name}' collection's Schema`,
          );
        }
        switch (this.options.schema[key].type) {
          case Types.ARRAY:
            switch ((this.options.schema[key] as any).items) {
              case Types.BOOLEAN:
                validationResult = filterQueryValidator.boolean(filterQuery[key]);
                break;
              case Types.STRING:
                validationResult = filterQueryValidator.string(filterQuery[key]);
                break;
              case Types.REFERENCE:
              case Types.OBJECT_ID:
                validationResult = objectIdQuery.string(filterQuery[key]);
                break;
              case Types.NUMBER:
                validationResult = filterQueryValidator.number(filterQuery[key]);
                break;
              case Types.TIME:
                validationResult = filterQueryValidator.time(filterQuery[key]);
                break;
              case Types.POSITION:
                validationResult = filterQueryValidator.geo(filterQuery[key]);
                break;
            }
            break;
          case Types.BOOLEAN:
            validationResult = filterQueryValidator.boolean(filterQuery[key]);
            break;
          case Types.STRING:
            validationResult = filterQueryValidator.string(filterQuery[key]);
            break;
          case Types.REFERENCE:
          case Types.OBJECT_ID:
            validationResult = filterQueryValidator.objectId(filterQuery[key]);
            break;
          case Types.NUMBER:
            validationResult = filterQueryValidator.number(filterQuery[key]);
            break;
          case Types.TIME:
            validationResult = filterQueryValidator.time(filterQuery[key]);
            break;
          case Types.POSITION:
            validationResult = filterQueryValidator.geo(filterQuery[key]);
            break;
        }
        if (validationResult && validationResult.error) {
          throw ErrorFactory.findQueryError(validationResult.error.message);
        }
      }
    }
  }

  public requiredFields(data: any) {
    for (const key in this.options.schema) {
      if (this.options.schema[key]?.required && !Object.prototype.hasOwnProperty.apply(data, [key])) {
        throw ErrorFactory.requiredFieldError(
          `property '${key}' is required in the '${this.options.name}' collection's Schema`,
        );
      }
    }
  }

  public mutableFields(data: any) {
    for (const key in this.options.schema) {
      if (this.options.schema[key].mutable === false && Object.prototype.hasOwnProperty.apply(data, [key])) {
        throw ErrorFactory.nonMutableFieldError(
          `property '${key}' of the '${this.options.name}' collection's Schema is not mutable`,
        );
      }
    }
  }

  public data(data: any, update: boolean = false) {
    let validationResult: any;
    for (const key in data) {
      if (!this.options.schema[key]) {
        throw ErrorFactory.schemaError(
          `property '${key}' doesn't exist in Schema of the collection '${this.options.name}'`,
          key,
        );
      }
      if (
        !update &&
        this.options.schema[key].type !== Types.POSITION &&
        typeof data[key] === 'object' &&
        !(Array.isArray(data[key]) && this.options.schema[key].type === Types.ARRAY)
      ) {
        throw ErrorFactory.schemaError(`property '${key}' should not be an object'`, key);
      }
      switch (this.options.schema[key].type) {
        case Types.ARRAY:
          switch ((this.options.schema[key] as any).items) {
            case Types.BOOLEAN:
              validationResult = setDataValidator.arrayOfBoolean(data[key]);
              break;
            case Types.STRING:
              validationResult = setDataValidator.arrayOfString(data[key]);
              break;
            case Types.REFERENCE:
            case Types.OBJECT_ID:
              validationResult = setDataValidator.arrayOfObjectId(data[key]);
              break;
            case Types.NUMBER:
              validationResult = setDataValidator.arrayOfNumber(data[key]);
              break;
            case Types.TIME:
              validationResult = setDataValidator.arrayOfTime(data[key]);
              break;
            case Types.POSITION:
              validationResult = setDataValidator.arrayOfGeo(data[key]);
              break;
          }
          break;
        case Types.BOOLEAN:
          validationResult = setDataValidator.boolean(data[key]);
          break;
        case Types.STRING:
          validationResult = setDataValidator.string(data[key]);
          break;
        case Types.REFERENCE:
        case Types.OBJECT_ID:
          validationResult = setDataValidator.objectId(data[key]);
          break;
        case Types.NUMBER:
          validationResult = setDataValidator.number(data[key]);
          break;
        case Types.TIME:
          validationResult = setDataValidator.time(data[key]);
          break;
        case Types.POSITION:
          validationResult = setDataValidator.geo(data[key]);
          break;
      }
      if (validationResult && validationResult.error) {
        throw ErrorFactory.schemaError(validationResult.error.message, key);
      }
    }
  }

  public transformQueries(transformQueries: any[]) {
    const validationResult: any = transformQueriesValidator(transformQueries);
    if (validationResult && validationResult.error) {
      throw ErrorFactory.transformQueryError(validationResult.error.message);
    }
  }

  public skip(skip: any) {
    if (!Number.isInteger(skip) || skip < 0) {
      throw ErrorFactory.skipError(`property 'skip' should be positive integer`);
    }
  }

  public limit(limit: any) {
    if (!Number.isInteger(limit) || limit < 0) {
      throw ErrorFactory.limitError(`property 'limit' should be positive integer`);
    }
  }

  public sortQuery(sortQuery: any) {
    const validationResult = sortQueryValidator(sortQuery);
    if (validationResult && validationResult.error) {
      throw ErrorFactory.sortingError(validationResult.error.message);
    }
  }

  public static clientOptions(clientOptions: any) {
    const validationResult = clientOptionsValidator(clientOptions);
    if (validationResult && validationResult.error) {
      throw ErrorFactory.configurationError(validationResult.error.message);
    }
  }

  public static validateModelOptions(modelOptions: any) {
    const validationResult = modelOptionsValidator(modelOptions);
    if (validationResult && validationResult.error) {
      throw ErrorFactory.modelOptionsError(validationResult.error.message);
    }
  }
}
