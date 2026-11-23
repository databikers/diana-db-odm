import {
  numberFieldExtended,
  stringField,
  timeField,
  booleanField,
  arrayOfBooleanField,
  arrayOfNumberField,
  arrayOfStringField,
  arrayOfTimeField,
  stringQuery,
  numberQuery,
  booleanQuery,
  timeQuery,
  schemaItem,
  objectIdField,
  arrayOfObjectIdField,
  objectIdQuery,
  transformQueries,
  geoField,
  arrayOfGeoField,
  geoQuery,
  sortQuery,
  clientOptions,
  modelOptions,
  vectorField,
  vectorQuery,
} from './schemas';

import { defaultValidationOptions } from './options';
import { v } from './rules';

const filterQueryValidator: any = {
  string(data: any) {
    return stringQuery.validate(data, defaultValidationOptions);
  },
  objectId(data: any) {
    return objectIdQuery.validate(data, defaultValidationOptions);
  },
  boolean(data: any) {
    return booleanQuery.validate(data, defaultValidationOptions);
  },
  number(data: any) {
    return numberQuery.validate(data, defaultValidationOptions);
  },
  time(data: any) {
    return timeQuery.validate(data, defaultValidationOptions);
  },
  geo(data: any) {
    return geoQuery.validate(data);
  },
  vector(data: any) {
    return vectorQuery.validate(data);
  },
};

const setDataValidator: any = {
  boolean(data: any) {
    return booleanField.validate(data, defaultValidationOptions);
  },
  number(data: any) {
    return numberFieldExtended.validate(data, defaultValidationOptions);
  },
  string(data: any) {
    return stringField.validate(data, defaultValidationOptions);
  },
  objectId(data: any) {
    return objectIdField.validate(data, defaultValidationOptions);
  },
  time(data: any) {
    return timeField.validate(data, defaultValidationOptions);
  },
  geo(data: any) {
    return geoField.validate(data, defaultValidationOptions);
  },
  vector(data: any) {
    return vectorField.validate(data);
  },
  arrayOfBoolean(data: any) {
    return arrayOfBooleanField.validate(data, defaultValidationOptions);
  },
  arrayOfNumber(data: any) {
    return arrayOfNumberField.validate(data, defaultValidationOptions);
  },
  arrayOfString(data: any) {
    return arrayOfStringField.validate(data, defaultValidationOptions);
  },
  arrayOfObjectId(data: any) {
    return arrayOfObjectIdField.validate(data, defaultValidationOptions);
  },
  arrayOfTime(data: any) {
    return arrayOfTimeField.validate(data, defaultValidationOptions);
  },
  arrayOfGeo(data: any) {
    return arrayOfGeoField.validate(data, defaultValidationOptions);
  },
};

const schemaItemValidator = (data: any) => {
  return schemaItem.validate(data, defaultValidationOptions);
};

const transformQueriesValidator = (data: any[]) => {
  return transformQueries.validate(data, defaultValidationOptions);
};

const isoDateString = v.string().isoDate();

const validateTimeString = (data: any) => {
  return isoDateString.validate(data);
};

const sortQueryValidator = (data: any) => {
  return sortQuery.validate(data);
};

export function clientOptionsValidator(options: any) {
  return clientOptions.validate(options);
}
export function modelOptionsValidator(options: any) {
  return modelOptions.validate(options);
}

export {
  schemaItemValidator,
  transformQueriesValidator,
  filterQueryValidator,
  setDataValidator,
  sortQueryValidator,
  validateTimeString,
  modelOptions,
};
