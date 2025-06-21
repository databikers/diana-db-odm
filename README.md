# DianaDb ODM for Node.js project

DianaDb ODM for Node.js project

## Install DianaDb

Install DianaDb

```
$npm i -s @diana-db/odm
```

## Create DianaDb instance

Create DianaDb instance

```
import { DianaDb } from '@diana-db/odm'
              const DianaDbOptions: = {
                host: 'localhost',
                port: 34567,
                user: 'db-user',
                password: 'some-password,
                connectionPoolSize: 10,
                connectTimeoutValue: 5000,
              }
              export const DianaDb = new DianaDb(DianaDbOptions);
```

You can create and use as many instances as you like, but note that each will be configured separately.
          This means that each client will have their own models, migrations and subscribers,
          and they can be connected/disconnected and used separately from the other.

## DianaDb Constructor Options

DianaDb Constructor Options

| Property | Description | Format | Default Value |
| --- | --- | --- | --- |
| host | Server host | String | – |
| port | Server port | Positive integer | 34567 |
| user | Username | String | – |
| password | Password | String | – |
| connectionPoolSize | Max concurrent connections | Positive integer | 10 |
| connectTimeoutValue | Connection timeout in milliseconds | Positive integer | 10000 |

## Client Methods

Client Methods

When You created a client instance, You can use it methods to configure it before usage:

When You created a client instance, You can use it methods to configure it before usage:

| Method | Arguments | Description | Return Type |
| --- | --- | --- | --- |
| connect | connectTimeoutValue : positive integer | Connects to the server | Promise<void> |
| disconnect | – | Disconnects from the server | void |
| subscribe | subscribeParameters : Subscribe Parameters | Sets a subscriber to handle database changes | void |
| setMigration | migrationOptions : Migration Options | Registers a new migration script | void |
| startTransaction | StartTransactionParameters : object autoRollbackAfterMs : integer – max execution time | Starts a transaction with an optional auto-rollback | Promise<string> (transactionId) |
| commitTransaction | ManageTransactionParameters : object | Commits an open transaction | Promise<TransactionInfo> |
| rollbackTransaction | ManageTransactionParameters : object | Rolls back the current transaction | Promise<TransactionInfo> |
| migrateUp | – | Applies all pending migrations | Promise<void> |
| migrateDown | – | Rolls back the last applied migration | Promise<void> |

## Document Schema

Document Schema

Define User ans Post Schemes

Define User ans Post Schemes

```
import { Types } from 'diana-db-odm';

              type User = {
                name: string;
                positions: { x: number, y: number };
                isActive: boolean;
                createdAt: string;
              }

              export const userSchema: Schema < User > = {
                    name: {
                      type: Types.STRING,
                      isUnique: true,
                      isRequired: true
                    },
                    isActive: {
                      type: Types.BOOLEAN,
                      default: true
                    },
                    position: {
                      type: Types.POSITION
                    },
                    createdAt: {
                      type: Types.TIME,
                      isRequired: true
                    }
                  }
```

Create Post schema:

Create Post schema:

```
import { Types } from 'diana-db-odm';

              type Post = {
                user: string;
                title: string;
                content: string;
                isPublished: boolean;
                createdAt: string;
                publishedAt: string;
              }

              export const postSchema: Schema < Post > = {
                    user: {
                      type: Types.REFERENCE,
                      reference: 'users',
                      isRequired: true
                    },
                    title: {
                      type: Types.STRING,
                      isRequired: true
                    },
                    content: {
                      type: Types.STRING,
                      isRequired: true
                    },
                    isPublished: {
                      type: Types.BOOLEAN,
                      default: true
                    },
                    createdAt: {
                      type: Types.TIME,
                      isRequired: true
                    },
                    publishedAt: {
                      type: Types.TIME,
                      isRequired: true
                    }
                  }
```

Be careful with schema changes: there is automatic detection of the difference between the old and the new schema.
      After updating the schema and running your code, it will also be updated on the server side and you may lose some data.
      To prevent this, only store schemas in one place, for example in a separate (shared/common) package
      that will be used as a dependency in all parts of your project

Document Schema is a generic type and special configuration object that defines the structure of stored in collection documents

Document Schema is a generic type and special configuration object that defines the structure of stored in collection documents

Schema keys are associated with document properties, values are special configuration objects that determine the type and storage rules

Schema keys are associated with document properties, values are special configuration objects that determine the type and storage rules

Each configuration object can has next options

Each configuration object can has next options

| Option | Type of Value | Description | Required | Default Value |
| --- | --- | --- | --- | --- |
| type | Types | See Types | Yes | – |
| required | boolean | Indicates that this property is required | Yes | – |
| unique | boolean | Indicates that this property should be unique | No | false |
| mutable | boolean | Whether the value can be changed after creation | No | true |
| default | T[prop] , () => T[prop] , or () => Promise<T[prop]> | Default value or function returning one. Functions are evaluated in the context of the new document. | No | – |
| items | Types | Required when type is Types.ARRAY . Specifies item type. | Yes (if type is ARRAY) | – |
| reference | string | Name of the referenced collection | Yes (if type is REFERENCE or items is REFERENCE) | – |
| triggerRemove | boolean | If true , document will be removed when referenced item is deleted | No | false |
| ttl | number | Time to live (in ms) after insertion. Applicable for Types.TIME . | No | – |

## Data (field) Types

Data (field) Types

DianaDb supports next types

DianaDb supports next types

| Type | Description | Notes |
| --- | --- | --- |
| Types.STRING | Document property value is a string | – |
| Types.NUMBER | Document property value is a number | – |
| Types.BOOLEAN | Document property value is a boolean | – |
| Types.POSITION | Document property is an object with x and y coordinates representing a point | Enables spatial/geometric queries |
| Types.OBJECT_ID | Represents a document identifier as a hex string (36 bytes) | Not enforced as BSON; it's a string |
| Types.REFERENCE | Like Types.OBJECT_ID but includes a link to another collection | Requires reference property. Enables sub-queries |
| Types.TIME | Stores date/time as ISO string | Supports time-based filters and TTL indexing |
| Types.ARRAY | Array field with homogeneous types defined in items | Mixed-type arrays are not allowed |

## Models

Models

To create model You should use ODM instancesetModelmethod

To create model You should use ODM instance

setModel

method

setModelmethod requires an argument - ModelOptions contract

setModel

method requires an argument - ModelOptions contract

```
import { Model } from '@diana-db/odm';
              import { userSchema, postSchema } from '../schemas';

              const userModel = new Model({
                database: 'test',
                collection: 'users',
                name: 'User'
                schema: userSchema
              });

              const postModel = new Model({
                database: 'test',
                collection: 'users',
                name: 'Post'
                schema: postSchema
              });
```

## Model Options

Model Options

As You can see Model Options is an object contains 4 properties:

As You can see Model Options is an object contains 4 properties:

- database:string, database name there collection will be created

database:

string, database name there collection will be created

- collection:string, collection name there documents will be stored

collection:

string, collection name there documents will be stored

- Name:string, Model name

Name:

string, Model name

- schema:special object that define collection and modelSchema

schema:

special object that define collection and model

Schema

## Insert Documents

Insert Documents

To insert new document useinsertmodel's method

To insert new document use

insert

model's method

```
const user: User = await userModel.insert({
                name: 'John',
                position: {
                  x: 1,
                  y: 1
                },
                createdAt: new Date().toISOString()
              });

              // This method will return inserted document
              // {
              //   _id: '645d866d0c1367b15f6454028ac',
              //   name: 'John',
              //   position: {
              //     x: 1,
              //     y: 1
              //   },
              //   isActive: true
              //   createdAt: '2020-09-18T06:30:24.977Z'
              // }
```

So, as You can see, an_idproperty will be added automatically and You don't need to specify it in Schema

So, as You can see, an

_id

property will be added automatically and You don't need to specify it in Schema

Returned document is a simple object that hasn't its own methods

Returned document is a simple object that hasn't its own methods

## Query and Count Documents

Query and Count Documents

To query documents from collection You should usefindmodel's method:

To query documents from collection You should use

find

model's method:

```
const user = await userModel.find([{
                name: {
                  $eq: 'John'
                }
              }]);
```

Findmethod allows 5 arguments, no one of them is required:

Find

method allows 5 arguments, no one of them is required:

| Argument | Description |
| --- | --- |
| Filter Query | Special object or array of objects where keys match document schema fields and values are query operands.
                All operands in one Filter Query behave like AND ; an array of Filter Queries behaves like OR . |
| Transform Queries | An array of step-by-step transformation objects (similar to MongoDB aggregation pipelines). |
| Sorting Query | Object for sorting results by schema keys. Values: 1 for ascending, -1 for descending.
                Supports multi-key sorting and primitive array sorting with numeric values. |
| Skip | Integer ≥ 0. Skips a number of documents. |
| Limit | Positive integer that limits the number of documents returned. |
| transactionId | A string identifier used when executing the query within a transaction scope. |

countmethod allows first two arguments fromfindmethod (FilterQueries and Transform Queries) (and transactionId as well),
          but instead the list of documents returns integer - count of them

count

method allows first two arguments from

find

method (FilterQueries and Transform Queries) (and transactionId as well),
          but instead the list of documents returns integer - count of them

## Query Operands

Query Operands

There is a full list of supported Query Operands and examples of them usage

There is a full list of supported Query Operands and examples of them usage

| Operand | Supported Types | Description | Format |
| --- | --- | --- | --- |
| $eq | All Types | Get documents where the property equals the given value | ```
{
  name: { $eq: 'John' }
// or
  name: 'John'
}
``` |
| $ne | All Types | Property is not equal to the given value | ```
{
  name: { $ne: 'John' }
}
``` |
| $in | All Types | Property value exists in provided array | ```
{
  name: { $in: [ 'John', 'Sam' ] }
// or
  name: [ 'John', 'Sam' ]
}
``` |
| $nin | All Types | Property value does not exist in provided array | ```
{
  name: { $nin: [ 'John', 'Sam' ] }
}
``` |
| $gt | Number, TIME | Property is greater than the value | ```
{
  height: { $gt: 2 }
}
``` |
| $gte | Number, TIME | Greater than or equal to the value | ```
{
  height: { $gte: 2 }
}
``` |
| $lt | Number, TIME | Less than the value | ```
{
  height: { $lt: 2 }
}
``` |
| $lte | Number, TIME | Less than or equal to the value | ```
{
  height: { $lte: 2 }
}
``` |
| $regex | String | Matches property against string/regex | ```
{
  name: { $regex: 'Jo' }
}
``` |
| $startsWith, $endsWith, $notStartsWith, $notEndsWith | String | Match property with string start or end | ```
{
  name: { $startsWith: 'Jo' },
  lastname: { $endsWith: 'oe' }
}
``` |
| $cn, $nc | String | Contains (or not contains) | ```
{
  name: { $cn: 'Jo' },
  lastname: { $nc: 'ou' }
}
``` |
| $year, $month, $date, $week, $hours, $minutes, $dayOfYear, $dayOfWeek, $timeStamp | TIME | Filter on parts of a date/time field | ```
{
  createdAt: {
    $year: { $eq: 2020 },
    $month: { $in: [1, 4] },
    $dayOfWeek: { $in: [0, 1] }
  }
}
``` |
| $insideCircle, $outsideCircle | POSITION | Check if point is inside/outside circle | ```
{
  position: {
    $insideCircle: {
      center: { x: 1, y: 1 },
      radius: 10
    }
  }
}
``` |
| $insidePolygon, $outsidePolygon | POSITION | Check if point is inside/outside polygon | ```
{
  position: {
    $insidePolygon: [
      { x: 1, y: 1 },
      { x: 3, y: 0 },
      { x: -1, y: -1 }
    ]
  }
}
``` |
| $nearLines, $farFromLines | POSITION | Check if point is near/far from given lines | ```
{
  position: {
    $nearLines: {
      lines: [
        [ { x: 1, y: 1 }, { x: 10, y: 10 } ],
        [ { x: 2, y: 0 }, { x: 4, y: 20 } ]
      ],
      distance: 10
    }
  }
}
``` |

### Query on Array field

Query on Array field

Query on array field allows the same query operands as primitive types,
          but query will be used for each value for array and will be executed likeORcondition. In this case You should specify values which You want to include and exclude

Query on array field allows the same query operands as primitive types,
          but query will be used for each value for array and will be executed like

OR

condition. In this case You should specify values which You want to include and exclude

For example You have two document in Your collection and one has some array property as [ 1, 2, 3 ]
          and another one has the same property as [ 1, 2 ] - if You want to get documents, which property contains 1, 2 only,
          You should use query like:

For example You have two document in Your collection and one has some array property as [ 1, 2, 3 ]
          and another one has the same property as [ 1, 2 ] - if You want to get documents, which property contains 1, 2 only,
          You should use query like:

```
{
                      someArrayProperty: {
                        $in: [ 1, 2 ],
                        $nin: [ 3 ]
                      }
                    }
```

More array query operands which will allow to find by size of array and order of it's items
          will be provided in the next versions

More array query operands which will allow to find by size of array and order of it's items
          will be provided in the next versions

### Query on Reference field

Query on Reference field

Query on reference field allows You to use nested query to another collection without any aggregation.
          For example You have model that Schema has reference to collection 'users' and want to get documents which referenced user name is 'John', You can do the next:

Query on reference field allows You to use nested query to another collection without any aggregation.
          For example You have model that Schema has reference to collection 'users' and want to get documents which referenced user name is 'John', You can do the next:

```
{
                      user: {
                        $subQuery: {
                          name: {
                            $eq: 'John'
                          }
                      }
                    }
```

## Transform Queries

Transform Queries

Transform Queries queries allow you to modify the found documents as needed.
          Is it an array of special objects, each of which can only have one key
          which is associated with some transformation strategy and imposes to provide some strict structure.

Transform Queries queries allow you to modify the found documents as needed.
          Is it an array of special objects, each of which can only have one key
          which is associated with some transformation strategy and imposes to provide some strict structure.

| Transform Query | Structure | Description |
| --- | --- | --- |
| $project | Each key of projection schema will become the property of modified document. Its value can be: boolean - in true case returns value as is if passed to pipeline document has such property,
                  in false case remove property from  found documents string - indicates the property  that should be used to set to found document specified key.
                  Should be related to existent property of document object - special object with key that indicates projection strategy that should be used | Makes projection from found documents by provided projection schema |
| $group | The same structure as $project Transform Query, but should additionally has the _id property for grouping documents. _id can be false or relates to some documents property (just as string like 'name') | Groups and modify documents by provided rules and projection schema |
| $match | Each key of match value object is associated with found/modified document,
              each value is special object like Filter Query (but has some difference this it described bellow) | Filters found/modified documents by provided query |
| $lookup | Value is an object that should contains next properties: database - indicates database should be queried, non-required collection - indicates collection should be queried, required as - new/existent property name to set result localField - document property that should be used in query foreignField - another collection property that should be used in query filter - additional filter should be used, Filter Query | Find documents from specified database/collection and add new property (or replaces existent)
              as array of found documents |
| $unwind | Value should references to existent property od found/modified objects | Deconstructs array property for each found document and replaces document with the same documents
              each of which has property value equal to item instead array of items |
| $replaceRoot | Value should references to existent property od found/modified objects | Replaces found/modified documents with their values of provided property |

### Projection operands

Projection operands

| Operand | Format | Description |
| --- | --- | --- |
| $sum | Array of values (numbers, strings references to properties, sub query) | Sums all provided values in array and set result as new property or sums existent property with result |
| $subtract | Array of values (numbers, strings references to properties, sub query) | Subtracts all provided values in array and set result as new property or subtracts existent property with result |
| $multiply | Array of values (numbers, strings references to properties, sub query) | Multiply all provided values in array and set result as new property or multiply existent property with result |
| $divide | Array of values (numbers, strings references to properties, sub query) | Divide all provided values in array and set result as new property or divide existent property with result |
| $round | Number | Round floating number to provided precision |
| $ifNull | Array of values (numbers, strings references to properties) | Returns next value from provided array if previous value is equal to null or undefined |
| $push | Array of values (numbers, strings references to properties,) | Create an array property if it doesn't exist and push provided values there |
| $addToSet | Array of values (numbers, strings references to properties) | The same as $push but makes array with unique properties |
| $first | string referenced to some property | Returns first object property value |
| $concatArrays | string referenced to some array property | Concatenates array property |
| $concatString | Requires object with delimiter property that specify concatenation delimiter
              and localField property referenced to String property | Concatenates String property |
| $year | string references to TIME property | Transform string date to year, number |
| $month | string references to TIME property | Transform string date to month, number |
| $date | string references to TIME property | Transform string date to date, number |
| $dayOfWeek | string references to TIME property | Transform string date to day of week, number |
| $dayOfYear | string references to TIME property | Transform string date to day of year, number |
| $week | string references to TIME property | Transform string date to number of week in year, number |
| $hours | string references to TIME property | Transform string date to hours, number |
| $minutes | string references to TIME property | Transform string date to minutes, number |
| $seconds | string references to TIME property | Transform string date to seconds, number |
| $timestamp | string references to TIME property | Transform string date to timestamp in milliseconds, number |

### Match operands

Match operands

Like a filter Query, $match operand supports$eq,$ne,$in,$nin,$gt,$gte,$lt,$lte,
          and additional$containsoperand that works like$regexfor strings and$infor arrays

Like a filter Query, $match operand supports

$eq

,

$ne

,

$in

,

$nin

,

$gt

,

$gte

,

$lt

,

$lte

,
          and additional

$contains

operand that works like

$regex

for strings and

$in

for arrays

### Example of Transform Query usage:

Example of Transform Query usage:

```
const postModel = odm.getModel('post');

                  const result = await postModel.find({},[
                  {
                    $group: {
                      _id: 'user',
                      user: true,
                      postsCount: {
                        $sum: [ 1 ]
                      }
                    }
                  },
                  {
                    $lookup: {
                      collection: 'users',
                      localField: 'user',
                      foreignField: '_id',
                      as: 'user',
                      filter: {
                        isActive: {
                          $eq: true
                        }
                      },
                    }
                  },
                  {
                    $unwind: 'user'
                  },
                  {
                    $project: {
                      _id: false,
                      user: true,
                      postsCount: true
                    }
                  }

                ]);
```

## Update Documents

Update Documents

To update documents callupdatemodel's method with 2 arguments:
          Filter Query and partial document with updated states

To update documents call

update

model's method with 2 arguments:
          Filter Query and partial document with updated states

```
const userModel = odm.getModel('user');

                  await userModel.update([{
                    name: {
                      $eq: 'John'
                    }
                  }], {
                    isActive: false
                  });
```

StringUpdateQuery

Describes how to update string fields by concatenation or replacement.

Describes how to update string fields by concatenation or replacement.

| Operator | Type | Effect |
| --- | --- | --- |
| $concat | string | Appends a string to the current value |
| $replace | [string, string] | Replaces substring using [search, replacement] format |

NumberUpdateQuery

A powerful update shape for performing mathematical operations on numeric fields.

A powerful update shape for performing mathematical operations on numeric fields.

Supported update operators

| Operator | Type | Effect |
| --- | --- | --- |
| $add | number | Adds a value to the current number |
| $subtract | number | Subtracts a value from the current number |
| $multiply | number | Multiplies the current number by a value |
| $divide | number | Divides the current number by a value |

ArrayUpdateQuery

Defines operations to modify arrays by adding or removing elements.

Defines operations to modify arrays by adding or removing elements.

Supported update operators

| Operator | Type | Effect |
| --- | --- | --- |
| $add | any | Appends an element to the array (if not already present) |
| $remove | any | Removes an element from the array if found |

TimeUpdateQuery

A type-safe way to transform timestamps with add/subtract, snapping to
          boundaries, and weekday navigation.

A type-safe way to transform timestamps with add/subtract, snapping to
          boundaries, and weekday navigation.

UnitOfTime enum

| Enum key | Literal value | Description |
| --- | --- | --- |
| YEAR | "year" | Calendar year |
| MONTH | "month" | Calendar month |
| WEEK | "week" | 7-day period |
| DAY | "day" | Day of month |
| HOUR | "hour" | Hour of day |
| MINUTE | "minute" | Minute of hour |
| SECOND | "second" | Second of minute |
| MILLISECOND | "millisecond" | Thousandth of a second |

Weekday enum

| Enum key | Literal value |
| --- | --- |
| SUNDAY | "Sunday" |
| MONDAY | "Monday" |
| TUESDAY | "Tuesday" |
| WEDNESDAY | "Wednesday" |
| THURSDAY | "Thursday" |
| FRIDAY | "Friday" |
| SATURDAY | "Saturday" |

Supported update operators

Supported update operators

| Operator | Shape | Effect |
| --- | --- | --- |
| $add | { amount, unit } | Adds time ( amount × unit ) |
| $subtract | { amount, unit } | Subtracts time |
| $toStartOf | UnitOfTime | Rounds down to start of given unit |
| $toEndOf | UnitOfTime | Rounds up to end of unit |
| $toNextWeekDay | Weekday | Jumps forward to next weekday |
| $toLastWeekDay | Weekday | Jumps back to previous weekday |

## Remove Documents

Remove Documents

To remove documents callremovemodel's method with FindQuery

To remove documents call

remove

model's method with FindQuery

```
const { found, removed } = await userModel.remove([{ isActive: false }]);
```

## Subscribe to Database changes

Subscribe to Database changes

You can subscribe to changes at the DianaDb Server.

You can subscribe to changes at the DianaDb Server.

```
// Here 'user.post' means database 'user' and collection 'post',
                  dianaDb.subscribe('user.post', (databaseUpdate: DatabaseUpdate) => {
                    // handle update
                  });
```

| Field | Type | Description |
| --- | --- | --- |
| database | string | Name of the database |
| collection | string | Name of the collection |
| action | 'insert' | 'update' | 'remove' | Type of operation |
| affectedIds | string[] | Array of ObjectIds affected |
| data | object | Snapshot of document data for insert/update |

## Migrations

Migrations

DianaDb has its own migrations out of the box. You can set migration by

setMigration

odm's method:

```
dianaDb.setMigration({
                    index: 1,
                    name: 'MyFirstMigration', // provide unique name for migration
                    up: async () => {
                      // do something
                    },
                    down: async () => {
                      // do something
                    }
                  });
```

Migration can affect many databases and collections.

Migration can affect many databases and collections.

There is only one list of implemented migrations, so be careful with its names - the names and indexes must be unique. Also, you must prevent code changes inside your migrations.

There is only one list of implemented migrations, so be careful with its names - the names and indexes must be unique. Also, you must prevent code changes inside your migrations.

You can start or roll back a migration by calling themigrateUpandmigrateDownmethods of the odm instance.

You can start or roll back a migration by calling the

migrateUp

and

migrateDown

methods of the odm instance.

```
await dianaDb.connect();
                  await dianaDb.migrateUp();
```

## Transactions

Transactions

DianaDb supports transactions. As you know, a transaction provides atomicity at the level of a group of operations.
        Transactions in DianaDb are non-blocking,  but there are a few notes you should consider:

- Transactions have a higher priority than regular requests and can overwrite previously saved data

Transactions have a higher priority than regular requests and can overwrite previously saved data

- Each next transaction has a higher priority than the previous one, so be careful and use update queries not scalar values to avoid any risks

Each next transaction has a higher priority than the previous one, so be careful and use update queries not scalar values to avoid any risks

- Each transaction has its own scope, and all changes made inside it are not available from the outside - until you commit it

Each transaction has its own scope, and all changes made inside it are not available from the outside - until you commit it

- You can not start new one transaction with the same odm instance until You commit or rollback previous one

You can not start new one transaction with the same odm instance until You commit or rollback previous one

```
await dianaDb.connect()
                   // Specify database where transaction should be run and autoRollBackAfterMs parameter,
                   // that indicates maximum execution time before Your transaction will automatically rolled back
                  const transactionId = await odm.startTransaction({ database: 'user', autoRollBackAfterMs: 60000 });
                  try {
                    // do something
                    await dianaDb.commitTransaction();
                  } catch (e) {
                    await dianaDb.rollBackTransaction();
                  }
```
