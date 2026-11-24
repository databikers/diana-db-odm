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
import { ValidationResult } from './rules';

// Filter validators by stored type (array fields are filtered by their item type)
const filterValidatorByType: Record<string, (data: any) => ValidationResult> = {
  [Types.BOOLEAN]: filterQueryValidator.boolean,
  [Types.STRING]: filterQueryValidator.string,
  [Types.REFERENCE]: filterQueryValidator.objectId,
  [Types.OBJECT_ID]: filterQueryValidator.objectId,
  [Types.NUMBER]: filterQueryValidator.number,
  [Types.TIME]: filterQueryValidator.time,
  [Types.POSITION]: filterQueryValidator.geo,
  [Types.VECTOR]: filterQueryValidator.vector,
};

const dataValidatorByType: Record<string, (data: any) => ValidationResult> = {
  [Types.BOOLEAN]: setDataValidator.boolean,
  [Types.STRING]: setDataValidator.string,
  [Types.REFERENCE]: setDataValidator.objectId,
  [Types.OBJECT_ID]: setDataValidator.objectId,
  [Types.NUMBER]: setDataValidator.number,
  [Types.TIME]: setDataValidator.time,
  [Types.POSITION]: setDataValidator.geo,
  [Types.VECTOR]: setDataValidator.vector,
};

const arrayDataValidatorByItemType: Record<string, (data: any) => ValidationResult> = {
  [Types.BOOLEAN]: setDataValidator.arrayOfBoolean,
  [Types.STRING]: setDataValidator.arrayOfString,
  [Types.REFERENCE]: setDataValidator.arrayOfObjectId,
  [Types.OBJECT_ID]: setDataValidator.arrayOfObjectId,
  [Types.NUMBER]: setDataValidator.arrayOfNumber,
  [Types.TIME]: setDataValidator.arrayOfTime,
  [Types.POSITION]: setDataValidator.arrayOfGeo,
};

export class Validator<T> {
  protected options: ValidatorOptions<any>;

  constructor(options: ValidatorOptions<T>) {
    this.options = options;
  }

  /** Only the schema's own fields count: "constructor", "toString"... are never fields. */
  protected field(key: string): any {
    return Object.prototype.hasOwnProperty.call(this.options.schema, key) ? this.options.schema[key] : undefined;
  }

  public filterQueries(filterQueries: any[]) {
    for (let i = 0; i < filterQueries.length; i = i + 1) {
      const filterQuery: any = filterQueries[i];
      for (const key in filterQuery) {
        const definition: any = this.field(key);
        if (!definition) {
          throw ErrorFactory.findQueryError(
            `property '${key}' doesn't exist in the '${this.options.name}' collection's Schema`,
          );
        }
        const type: string = definition.type === Types.ARRAY ? definition.items : definition.type;
        const validator = filterValidatorByType[type];
        if (!validator) {
          continue;
        }
        const validationResult: ValidationResult = validator(filterQuery[key]);
        if (validationResult.error) {
          throw ErrorFactory.findQueryError(validationResult.error.message);
        }
        if (type === Types.VECTOR) {
          for (const operator of [
            '$neighbors',
            '$direction',
          ]) {
            const vector: number[] | undefined = filterQuery[key]?.[operator]?.vector;
            if (vector && vector.length !== definition.dimensions) {
              throw ErrorFactory.findQueryError(
                `"${key}.${operator}.vector" must have ${definition.dimensions} dimensions, got ${vector.length}`,
              );
            }
          }
        }
      }
    }
  }

  public requiredFields(data: any, update: boolean = false) {
    for (const key in this.options.schema) {
      if (!update && this.options.schema[key]?.required && !Object.prototype.hasOwnProperty.apply(data, [key])) {
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
    for (const key in data) {
      const definition: any = this.field(key);
      if (!definition) {
        throw ErrorFactory.schemaError(
          `property '${key}' doesn't exist in Schema of the collection '${this.options.name}'`,
          key,
        );
      }
      if (
        !update &&
        definition.type !== Types.POSITION &&
        typeof data[key] === 'object' &&
        !(Array.isArray(data[key]) && (definition.type === Types.ARRAY || definition.type === Types.VECTOR))
      ) {
        throw ErrorFactory.schemaError(`property '${key}' should not be an object'`, key);
      }
      const validator =
        definition.type === Types.ARRAY
          ? arrayDataValidatorByItemType[definition.items]
          : dataValidatorByType[definition.type];
      if (!validator) {
        continue;
      }
      const validationResult: ValidationResult = validator(data[key]);
      if (validationResult.error) {
        throw ErrorFactory.schemaError(validationResult.error.message, key);
      }
      if (definition.type === Types.VECTOR && data[key].length !== definition.dimensions) {
        throw ErrorFactory.schemaError(
          `property '${key}' must have ${definition.dimensions} dimensions, got ${data[key].length}`,
          key,
        );
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
    if (!Number.isInteger(limit) || limit < 1) {
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
