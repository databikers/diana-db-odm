import { Types, UnitOfTime, Weekday } from '@const';
import { v } from './rules';

/** Every _id a DianaDB server may have stored (see the server's helpers/object-id-helper). */
export const OBJECT_ID_REGEXP: RegExp = /^(?:[A-Za-z0-9_]{1,64})?-[0-9a-f]{4,8}-[0-9a-f]{11}-[0-9a-f]{9}$/;

// '$' and a property name, which may be one letter
const pointer = v.string().regex(/^\$[A-Za-z][A-Za-z0-9_]*/);

const pemInput = v.alternatives(v.string(), v.binary());

export const clientOptions = v.object({
  port: v.number().positive().integer().min(1025).max(65535),
  host: v.string().required(),
  user: v.string().required(),
  password: v.string().required(),
  connectionPoolSize: v.number().positive().integer().min(1),
  connectTimeoutValue: v.number().positive().integer().allow(0),
  reconnectTimeoutValue: v.number().positive().integer().allow(0),
  requestTimeoutValue: v.number().positive().integer().min(1),
  database: v.string(),
  secureServer: v.boolean(),
  legacyAuth: v.boolean(),
  logger: v.any(),
  // Buffers, as in the README (readFileSync), or PEM strings. Other node tls options pass through.
  tls: v
    .object({
      cert: pemInput,
      key: pemInput,
      ca: v.alternatives(pemInput, v.array().items(pemInput)),
      rejectUnauthorized: v.boolean(),
      servername: v.string(),
    })
    .unknown(true)
    .optional(),
});

const numberFieldExtended = v.alternatives(
  v.number(),
  pointer,
  v.object({
    $add: v.number(),
    $subtract: v.number(),
    $multiply: v.number(),
    $divide: v.number().disallow(0),
    $round: v.number().integer().min(0).max(8),
  }),
);

const stringField = v.alternatives(
  // an empty string is a string
  v.string().allow(''),
  pointer,
  v.object({
    $concat: v.object({
      delimiter: v.string().required(),
      parts: v.array().items(v.string()),
    }),
    $replace: v.array().min(3).max(3).items(v.string().allow('')),
  }),
);
const objectIdField = v.alternatives(
  pointer,
  // <server id>-<pid>-<timestamp>-<counter and random part>. Server 4.6.5+ makes server ids of exactly 12 lowercase
  // letters or digits; _ids made by earlier versions (no server id, or 1-64 letters, digits or "_") are accepted too.
  v.string().regex(OBJECT_ID_REGEXP),
);

const timeFieldItem = v.object({
  amount: v.number().positive().integer().required(),
  unit: v
    .string()
    .valid(...Object.values(UnitOfTime))
    .required(),
});

const weekday = v.string().valid(...Object.values(Weekday));

const unitOfTime = v.string().valid(...Object.values(UnitOfTime));

const timeField = v.alternatives(
  v.string().isoDate(),
  v.number().positive().integer(),
  pointer,
  v
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
const booleanField = v.alternatives(v.boolean().allow(true, false), pointer);

const geoField = v.alternatives(
  v.object({
    x: v.number().required(),
    y: v.number().required(),
  }),
  pointer,
);

const arrayExtended = v
  .object({
    $addItem: v.any(),
    $removeItem: v.any(),
  })
  .min(1)
  .max(1);

const arrayOfNumberField = v.alternatives(v.array().items(numberFieldExtended), arrayExtended);
const arrayOfStringField = v.alternatives(v.array().items(stringField), arrayExtended);
const arrayOfBooleanField = v.array().items(booleanField);
const arrayOfTimeField = v.array().items(timeField);
const arrayOfObjectIdField = v.array().items(objectIdField);
const arrayOfGeoField = v.array().items(geoField);

const numberQuery = v.alternatives().try(
  v.object({
    $in: v.array().items(v.number()),
    $nin: v.array().items(v.number()),
    $eq: v.number(),
    $ne: v.number(),
    $lt: v.number(),
    $gt: v.number(),
    $lte: v.number(),
    $gte: v.number(),
  }),
  v.number(),
);

const geoQuery = v.object({
  $insideCircle: v.object({
    center: geoField.required(),
    radius: v.number().positive().required(),
  }),
  $outsideCircle: v.object({
    center: geoField.required(),
    radius: v.number().positive().required(),
  }),
  $insidePolygon: v.array().items(geoField).min(3),
  $outsidePolygon: v.array().items(geoField).min(3),
  $nearLines: v.object({
    lines: v.array().items(v.array().items(geoField).min(2).max(2)).min(1).required(),
    distance: v.number().positive().required(),
  }),
  $farFromLines: v.object({
    lines: v.array().items(v.array().items(geoField).min(2).max(2)).min(1).required(),
    distance: v.number().positive().allow(0).required(),
  }),
});

const stringQuery = v.alternatives().try(
  v.object({
    $regex: v.string(),
    $in: v.array().items(v.string().allow('')),
    $nin: v.array().items(v.string().allow('')),
    $eq: v.string().allow(''),
    $ne: v.string().allow(''),
    $startsWith: v.string(),
    $notStartsWith: v.string(),
    $endsWith: v.string(),
    $notEndsWith: v.string(),
    $cn: v.string(),
    $nc: v.string(),
  }),
  v.string().allow(''),
);

const objectIdQuery = v.alternatives().try(
  v
    .object({
      $in: v.array().items(objectIdField),
      $nin: v.array().items(objectIdField),
      $eq: objectIdField,
      $ne: objectIdField,
      $subQuery: v.any(),
    })
    .min(1)
    .max(1),
  objectIdField,
);

const booleanQuery = v.alternatives().try(
  v
    .object({
      $in: v.array().items(v.boolean()),
      $nin: v.array().items(v.boolean()),
      $eq: v.boolean(),
      $ne: v.boolean(),
    })
    .min(1)
    .max(1),
  v.boolean(),
);

const timeQuery = v
  .object({
    $year: numberQuery,
    $month: numberQuery,
    $week: numberQuery,
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

// A document holds one vector per VECTOR field: arrays of vectors are not supported.
const arrayItemTypes: Types[] = Object.values(Types).filter((type: Types) => type !== Types.VECTOR);

// Same limit as the server: 65536 dimensions are 512 KB per document.
const MAX_VECTOR_DIMENSIONS: number = 65536;

const vectorField = v.array().items(v.number()).min(1).max(MAX_VECTOR_DIMENSIONS);

const vectorQuery = v
  .object({
    $neighbors: v.object({
      vector: vectorField.required(),
      count: v.number().positive().integer(),
      metric: v.string().valid('euclidean', 'cosine', 'dot'),
      maxDistance: v.number().min(0),
    }),
    $direction: v.object({
      vector: vectorField.required(),
      minSimilarity: v.number().min(-1).max(1).required(),
      count: v.number().positive().integer(),
    }),
  })
  .min(1);

const schemaItem = v
  .object({
    type: v
      .string()
      .valid(...Object.values(Types))
      .required(),
    items: v
      .when('type', {
        is: Types.ARRAY,
        then: v
          .string()
          .valid(...arrayItemTypes)
          .required(),
      })
      .when('type', {
        not: Types.ARRAY,
        then: v.forbidden(),
      }),
    uppercase: v
      .when('type', {
        is: Types.STRING,
        then: v.boolean(),
      })
      .when('type', {
        not: Types.STRING,
        then: v.forbidden(),
      }),
    lowercase: v
      .when('type', {
        is: Types.STRING,
        then: v.boolean(),
      })
      .when('type', {
        not: Types.STRING,
        then: v.forbidden(),
      }),
    precision: v
      .when('type', {
        is: Types.NUMBER,
        then: v.number().integer().min(0).max(8),
      })
      .when('type', {
        not: Types.NUMBER,
        then: v.forbidden(),
      }),
    reference: v
      .when('type', {
        is: Types.REFERENCE,
        then: v.string().required(),
      })
      .when('items', {
        is: Types.REFERENCE,
        then: v.string().required(),
      }),
    required: v.boolean(),
    unique: v.boolean(),
    default: v.any(),
    set: v.any(),
    get: v.any(),
    mutable: v.boolean(),
    dimensions: v
      .when('type', {
        is: Types.VECTOR,
        then: v.number().integer().min(1).max(MAX_VECTOR_DIMENSIONS).required(),
      })
      .when('type', {
        not: Types.VECTOR,
        then: v.forbidden(),
      }),
    ttl: v
      .when('type', {
        not: Types.TIME,
        then: v.forbidden(),
      })
      .when('type', {
        is: Types.TIME,
        then: v.number().positive().integer().min(5),
      }),
    triggerRemove: v.when('type', {
      is: Types.REFERENCE,
      then: v.boolean(),
      otherwise: v.any().when('type', {
        is: Types.ARRAY,
        then: v.any().when('items', {
          is: Types.REFERENCE,
          then: v.boolean(),
          otherwise: v.forbidden(),
        }),
        otherwise: v.forbidden(),
      }),
    }),
  })
  .oxor('lowercase', 'uppercase')
  .oxor('default', 'set', 'get')
  .min(1);

const modelOptions = v.object({
  database: v.string().required(),
  collection: v.string().required(),
  name: v.string().required(),
  schema: v.object().pattern(/^/, schemaItem).min(1),
  dianaDb: v.object(),
});

const projectionSchema = v
  .object({
    $sum: v.array().items(v.number(), pointer),
    $subtract: v.array().items(v.number(), pointer),
    $divide: v.array().items(v.number().disallow(0), pointer),
    $multiply: v.array().items(v.number(), pointer),
    // pointers are read from the document; other values are taken as they are
    $ifNull: v.array().min(1).items(v.number(), v.string(), v.boolean()),
    $max: pointer,
    $min: pointer,
    $avg: pointer,
    $push: v.any(),
    $addToSet: v.any(),
    $concatArray: pointer,
    $first: pointer,
    $last: pointer,
    $concat: v.object({
      delimiter: v.string().required(),
      parts: v.array().items(v.string()),
    }),
    $year: pointer,
    $month: pointer,
    $date: pointer,
    $hours: pointer,
    $minutes: pointer,
    $seconds: pointer,
    $dayOfWeek: pointer,
    $dayOfYear: pointer,
    $timestamp: pointer,
    $round: v.number().integer().min(0).max(8),
  })
  .min(1)
  .max(1);

const transformQueries = v.array().items(
  v
    .object({
      $lookup: v.object({
        collection: v.string().required(),
        database: v.string(),
        as: v.string().required(),
        localField: v.string().required(),
        foreignField: v.string().required(),
        filter: v.any(),
        replaceRoot: pointer,
        sort: v.object().pattern(/^/, v.number().valid(-1, 1)).min(1),
        skip: v.number().positive().integer().allow(0),
        limit: v.number().positive().integer(),
      }),
      $match: v
        .object()
        .pattern(/^/, v.alternatives(booleanQuery, stringQuery, numberQuery, timeQuery, geoQuery, objectIdQuery)),
      $sort: v.object().pattern(/^/, v.number().valid(-1, 1)).min(1),
      $unwind: pointer,
      $replaceRoot: pointer,
      $group: v
        .object({
          _id: v.any().required(),
        })
        .pattern(/^(?!.*\_id$)/, v.alternatives(projectionSchema, pointer, v.boolean())),
      $project: v
        .object()
        .pattern(/^/, v.alternatives(projectionSchema, v.string(), v.boolean()))
        .min(1),
      $skip: v.number().positive().integer().allow(0),
      $limit: v.number().positive().integer(),
    })
    .max(1),
);

const sortQuery = v.alternatives(v.number().valid(-1, 1), v.object().pattern(/^/, v.number().valid(-1, 1)).min(1));

export {
  modelOptions,
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
  vectorField,
  vectorQuery,
};
