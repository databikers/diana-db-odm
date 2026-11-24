import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, skip } from './helpers.mjs';
import { DianaDb, Model, Types } from '../dist/index.js';

let server;
let db;
let items;

before(async () => {
  if (skip) return;
  server = await startServer();
  db = new DianaDb(server.options());
  await db.connect(5000);
  items = new Model({
    database: 'test',
    collection: `items_${Date.now()}`,
    name: 'Item',
    schema: {
      title: { type: Types.STRING },
      n: { type: Types.NUMBER },
      note: { type: Types.STRING },
    },
    dianaDb: db,
  });
  await items.insertMany([
    { title: '', n: 1 },
    { title: 'b', n: 2, note: 'kept' },
    { title: 'c', n: 3 },
  ]);
});

after(async () => {
  await db?.disconnect();
  await server?.stop();
});

/** The call must fail in the ODM: an error without a server code. */
async function refusedLocally(call) {
  let error;
  try {
    await call();
  } catch (e) {
    error = e;
  }
  assert.ok(error, 'the call was expected to fail');
  assert.equal(error.code, undefined, error.message);
}

test('an empty string is a valid value and can be queried', { skip }, async () => {
  assert.deepEqual(
    (await items.find([{ title: '' }])).map((item) => item.n),
    [1],
  );
  assert.equal(await items.count([{ title: { $ne: '' } }]), 2);
  assert.equal(
    await items.count([
      {
        title: {
          $in: [
            '',
            'b',
          ],
        },
      },
    ]),
    2,
  );
  await items.update([{ n: 3 }], { title: '' });
  assert.equal(await items.count([{ title: { $eq: '' } }]), 2);
});

test('limit must be 1 or more and a sorting direction 1 or -1', { skip }, async () => {
  await refusedLocally(() => items.find([{}], undefined, undefined, 0, 0));
  await refusedLocally(() => items.find([{}], undefined, undefined, 0, -1));
  await refusedLocally(() => items.find([{}], undefined, { n: 2 }));
  await refusedLocally(() => items.find([{}], undefined, { n: 0 }));
  await refusedLocally(() => items.find([{}], [{ $sort: { n: 2 } }]));
  assert.deepEqual(
    (await items.find([{}], undefined, { n: -1 }, 0, 2)).map((item) => item.n),
    [
      3,
      2,
    ],
  );
  assert.deepEqual(
    (await items.find([{}], undefined, { _id: 1 })).map((item) => item.n),
    [
      1,
      2,
      3,
    ],
  );
});

test(
  'pointers to one-letter properties, $ifNull with a plain fallback, $round 0, $replace without flags',
  { skip },
  async () => {
    const [total] = await items.find([{}], [{ $group: { _id: false, total: { $sum: ['$n'] } } }]);
    assert.equal(total.total, 6);
    const rows = await items.find(
      [{}],
      [
        {
          $project: {
            n: true,
            note: {
              $ifNull: [
                '$note',
                'none',
              ],
            },
            half: {
              $divide: [
                '$n',
                2,
              ],
            },
          },
        },
        { $sort: { n: 1 } },
      ],
    );
    assert.deepEqual(
      rows.map((row) => [
        row.note,
        row.half,
      ]),
      [
        [
          'none',
          0.5,
        ],
        [
          'kept',
          1,
        ],
        [
          'none',
          1.5,
        ],
      ],
    );
    const rounded = await items.find(
      [{ n: 3 }],
      [
        {
          $project: {
            half: {
              $divide: [
                '$n',
                2,
              ],
            },
          },
        },
        { $project: { half: { $round: 0 } } },
      ],
    );
    assert.equal(rounded[0].half, 2);
    await items.update([{ n: 2 }], {
      note: {
        $replace: [
          'kept',
          'changed',
          '',
        ],
      },
    });
    assert.equal((await items.find([{ n: 2 }]))[0].note, 'changed');
  },
);
