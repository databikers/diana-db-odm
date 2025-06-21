import { Types, UnitOfTime, Weekday } from '@const';

const joi = require('joi');

const configurationOptions = joi.object({
  port: joi.number().positive().integer().min(1025).max(65535),
  workersCount: joi.number().positive().integer().min(1),
  transactionsMinAutoRollBackValue: joi.number().positive().integer(),
  transactionsMaxAutoRollBackValue: joi.number().positive().integer(),
  dumpCreateInterval: joi.string().valid('day', 'hour'),
  dumpDirectory: joi.string().regex(/^(^[\/]{1})|(^[\.]{1,2})\//),
  logsDirectory: joi.string().regex(/^(^[\/]{1})|(^[\.]{1,2})\//),
  logsTtlValue: joi
    .string()
    .regex(/^\d+d$/)
    .required(),
  currentDumpName: joi.string(),
});

export const clientOptions = joi.object({
  port: joi.number().positive().integer().min(1025).max(65535).required(),
  host: joi.string().required(),
  user: joi.string().required(),
  password: joi.string().required(),
  connectionPoolSize: joi.number().positive().integer().min(1),
  connectTimeoutValue: joi.number().positive().integer().min(100),
  logger: joi.any(),
});

const numberFieldExtended = joi.alternatives(
  joi.number(),
  joi.object({
    $add: joi.number().positive(),
    $subtract: joi.number().positive(),
    $multiply: joi.number().positive(),
    $divide: joi.number().positive(),
    $round: joi.number().positive().integer().min(1).max(8),
  }),
);

const stringField = joi.alternatives(
  joi.string(),
  joi.object({
    $concat: joi.string(),
    $replace: joi.array().min(3).max(3).items(joi.string()),
  }),
);
const objectIdField = joi.string().regex(/^[0-9a-fA-F]{36}$/);

const timeFieldItem = joi.object({
  amount: joi.number().positive().integer().required(),
  unit: joi
    .string()
    .valid(...Object.values(UnitOfTime))
    .required(),
});

const weekday = joi.string().valid(...Object.values(Weekday));

const unitOfTime = joi.string().valid(...Object.values(UnitOfTime));

const timeField = joi.alternatives(
  joi.string().isoDate(),
  joi.number().positive().integer(),
  joi
    .object({
      $add: timeFieldItem,
      $subtract: timeFieldItem,
      $toStartOf: unitOfTime,
      $toEndOf: unitOfTime,
      $toNextWeekday: weekday,
      $toLastWeekday: weekday,
    })
    .min(1),
);
const booleanField = joi.boolean().allow(true, false);

const geoField = joi.object({
  x: joi.number().required(),
  y: joi.number().required(),
});

const arrayExtended = joi
  .object({
    $add: joi.any(),
    $remove: joi.any(),
  })
  .min(1);

const arrayOfNumberField = joi.alternatives(joi.array().items(numberFieldExtended), arrayExtended);
const arrayOfStringField = joi.alternatives(joi.array().items(stringField), arrayExtended);
const arrayOfBooleanField = joi.alternatives(joi.array().items(booleanField), arrayExtended);
const arrayOfTimeField = joi.alternatives(joi.array().items(timeField), arrayExtended);
const arrayOfObjectIdField = joi.alternatives(joi.array().items(objectIdField), arrayExtended);
const arrayOfGeoField = joi.alternatives(joi.array().items(geoField), arrayExtended);

const numberQuery = joi.alternatives().try(
  joi.object({
    $in: joi.array().items(joi.number()),
    $nin: joi.array().items(joi.number()),
    $eq: joi.number(),
    $ne: joi.number(),
    $lt: joi.number(),
    $gt: joi.number(),
    $lte: joi.number(),
    $gte: joi.number(),
  }),
  joi.number(),
);

const geoQuery = joi.object({
  $insideCircle: joi.object({
    center: geoField.required(),
    radius: joi.number().positive().required(),
  }),
  $outsideCircle: joi.object({
    center: geoField.required(),
    radius: joi.number().positive().required(),
  }),
  $insidePolygon: joi.array().items(geoField).min(3),
  $outsidePolygon: joi.array().items(geoField).min(3),
  $nearLines: joi.object({
    lines: joi.array().items(joi.array().items(geoField).min(2).max(2)).min(1).required(),
    distance: joi.number().positive().required(),
  }),
  $farFromLines: joi.object({
    lines: joi.array().items(joi.array().items(geoField).min(2).max(2)).min(1).required(),
    distance: joi.number().positive().allow(0).required(),
  }),
});

const stringQuery = joi.alternatives().try(
  joi.object({
    $regex: joi.string(),
    $in: joi.array().items(joi.string()),
    $nin: joi.array().items(joi.string()),
    $eq: joi.string(),
    $ne: joi.string(),
    $startsWith: joi.string(),
    $notStartsWith: joi.string(),
    $endsWith: joi.string(),
    $notEndsWith: joi.string(),
    $cn: joi.string(),
    $nc: joi.string(),
  }),
  joi.string(),
);

const objectIdQuery = joi.alternatives().try(
  joi
    .object({
      $in: joi.array().items(objectIdField),
      $nin: joi.array().items(objectIdField),
      $eq: objectIdField,
      $ne: objectIdField,
      $subQuery: joi.any(),
    })
    .min(1)
    .max(1),
  objectIdField,
);

const booleanQuery = joi.alternatives().try(
  joi
    .object({
      $in: joi.array().items(joi.boolean()),
      $nin: joi.array().items(joi.boolean()),
      $eq: joi.boolean(),
      $ne: joi.boolean(),
    })
    .min(1)
    .max(1),
  joi.boolean(),
);

const timeQuery = joi
  .object({
    $year: numberQuery,
    $month: numberQuery,
    $date: numberQuery,
    $hours: numberQuery,
    $minutes: numberQuery,
    $seconds: numberQuery,
    $dayOfWeek: numberQuery,
    $dayOfYear: numberQuery,
    $timestamp: numberQuery,
    $raw: stringQuery,
  })
  .min(1);

const schemaItem = joi
  .object({
    type: joi
      .string()
      .valid(...Object.values(Types))
      .required(),
    items: joi
      .when('type', {
        is: Types.ARRAY,
        then: joi
          .string()
          .valid(...Object.values(Types))
          .required(),
      })
      .when('type', {
        not: Types.ARRAY,
        then: joi.forbidden,
      }),
    precision: joi
      .when('type', {
        is: Types.NUMBER,
        then: joi.number().positive().integer().allow(0).min(0).max(8).required(),
      })
      .when('type', {
        not: Types.NUMBER,
        then: joi.forbidden,
      }),
    reference: joi
      .when('type', {
        is: Types.REFERENCE,
        then: joi.string().required(),
      })
      .when('items', {
        is: Types.REFERENCE,
        then: joi.string().required(),
      }),
    required: joi.boolean(),
    unique: joi.boolean(),
    mutable: joi.boolean(),
    default: joi.any(),
    ttl: joi
      .when('type', {
        not: Types.TIME,
        then: joi.forbidden(),
      })
      .when('type', {
        is: Types.TIME,
        then: joi.number().positive().integer().min(5),
      }),
    triggerRemove: joi
      .when('type', {
        is: Types.REFERENCE,
        then: joi.boolean(),
      })
      .when('type', {
        not: Types.REFERENCE,
        then: joi.forbidden(),
      }),
  })
  .min(1);

const projectionSchema = joi
  .object({
    $sum: joi.array().items(joi.string(), joi.number(), joi.any()),
    $subtract: joi.array().items(joi.string(), joi.number(), joi.any()),
    $divide: joi.array().items(joi.string(), joi.number(), joi.any()),
    $multiply: joi.array().items(joi.string(), joi.number(), joi.any()),
    $ifNull: joi.array().items(joi.string(), joi.number(), joi.any()),
    $push: joi.any(),
    $addToSet: joi.any(),
    $concatArray: joi.string(),
    $first: joi.string(),
    $concatString: joi.object({
      delimiter: joi.string().required(),
      localField: joi.string(),
    }),
    $year: joi.string(),
    $month: joi.string(),
    $date: joi.string(),
    $hours: joi.string(),
    $minutes: joi.string(),
    $seconds: joi.string(),
    $dayOfWeek: joi.string(),
    $dayOfYear: joi.string(),
    $timestamp: joi.string(),
    $round: joi.number().positive().integer(),
  })
  .min(1)
  .max(1);

const transformQueries = joi.array().items(
  joi
    .object({
      $lookup: joi.object({
        collection: joi.string().required(),
        database: joi.string(),
        as: joi.string().required(),
        localField: joi.string().required(),
        foreignField: joi.string().required(),
        filter: joi.any(),
        sort: joi.object().pattern(/^/, joi.number().integer().allow(-1, 1)).min(1),
        skip: joi.number().positive().integer().allow(0),
        limit: joi.number().positive().integer(),
      }),
      $match: joi.object().pattern(/^/, joi.alternatives(booleanQuery, stringQuery, numberQuery, timeQuery, geoQuery)),
      $sort: joi.object().pattern(/^/, joi.number().integer().allow(-1, 1)).min(1),
      $unwind: joi.string(),
      $replaceRoot: joi.string(),
      $group: joi
        .object({
          _id: joi.string().required(),
        })
        .pattern(/^(?!.*\_id$)/, joi.alternatives(projectionSchema, joi.string(), joi.boolean())),
      $project: joi
        .object()
        .pattern(/^/, joi.alternatives(projectionSchema, joi.string(), joi.boolean()))
        .min(1),
    })
    .max(1),
);

const sortQuery = joi.alternatives(
  joi.number().integer().allow(-1, 1),
  joi.object().pattern(/^/, joi.number().integer().allow(-1, 1)).min(1),
);

const schema = joi.object().pattern(/^/, schemaItem).min(1);

export const modelOptions = joi.object({
  database: joi.string().required(),
  collection: joi.string().required(),
  name: joi.string().required(),
  schema,
});

export {
  configurationOptions,
  numberFieldExtended,
  stringField,
  timeField,
  booleanField,
  objectIdField,
  arrayOfBooleanField,
  arrayOfNumberField,
  arrayOfStringField,
  arrayOfTimeField,
  arrayOfObjectIdField,
  stringQuery,
  objectIdQuery,
  numberQuery,
  booleanQuery,
  timeQuery,
  schemaItem,
  transformQueries,
  geoField,
  arrayOfGeoField,
  geoQuery,
  sortQuery,
};
