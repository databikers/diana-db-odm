import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, skip } from './helpers.mjs';
import { DianaDb, Model, Types } from '../dist/index.js';

let server;
let db;
let people;

before(async () => {
  if (skip) return;
  server = await startServer();
  db = new DianaDb(server.url());
  await db.connect(5000);
  people = new Model({
    database: 'test',
    collection: `people_${Date.now()}`,
    name: 'Person',
    schema: {
      name: { type: Types.STRING, required: true },
      email: { type: Types.STRING, unique: true },
      age: { type: Types.NUMBER, default: 18 },
    },
  });
  await people.init();
});

after(async () => {
  await db?.disconnect();
  await server?.stop();
});

const make = (from, count) =>
  Array.from({ length: count }, (_, i) => ({ name: `user ${from + i}`, email: `u${from + i}@example.org` }));

test('insertMany stores every document in batches and applies defaults', { skip }, async () => {
  const inserted = await people.insertMany(make(0, 2500), undefined, 1000);
  assert.equal(inserted.length, 2500);
  assert.ok(inserted.every((doc, i) => doc._id && doc.name === `user ${i}` && doc.age === 18));
  assert.equal(await people.count([{}]), 2500);
});

test('a document failing local validation stops the call before anything is sent', { skip }, async () => {
  const docs = make(10000, 3);
  docs[1].age = 'old';
  await assert.rejects(people.insertMany(docs), /^.*document 1: /);
  assert.equal(await people.count([{ email: 'u10000@example.org' }]), 0);
});

test('a server-side error names the document by its position in the whole array', { skip }, async () => {
  const docs = make(20000, 5);
  docs[3].email = 'u0@example.org'; // already stored by the first test
  await assert.rejects(people.insertMany(docs, undefined, 2), (error) => {
    assert.match(error.message, /document 3: property 'email' with value u0@example.org is used already/);
    assert.equal(error.code, 'SERVER');
    return true;
  });
  // the first batch (documents 0-1) was stored, the failing batch (2-3) was not
  assert.equal(
    await people.count([
      {
        email: {
          $in: [
            'u20000@example.org',
            'u20001@example.org',
          ],
        },
      },
    ]),
    2,
  );
  assert.equal(await people.count([{ email: 'u20002@example.org' }]), 0);
});

test('insertMany validates its arguments', { skip }, async () => {
  await assert.rejects(people.insertMany('nope'), /expects an array/);
  await assert.rejects(people.insertMany([], undefined, 0), /batchSize must be an integer from 1 to 10000/);
  assert.deepEqual(await people.insertMany([]), []);
});

test('insertMany inside a transaction is all-or-nothing', { skip }, async () => {
  const transactionId = await db.startTransaction({ database: 'test' });
  await people.insertMany(make(30000, 4), transactionId, 2);
  await db.rollbackTransaction({ database: 'test', transactionId });
  assert.equal(await people.count([{ email: 'u30000@example.org' }]), 0);
});
