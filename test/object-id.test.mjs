import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, skip } from './helpers.mjs';
import { DianaDb, Model, Types } from '../dist/index.js';

let server;
let db;
let items;

before(async () => {
  if (skip) return;
  server = await startServer({ env: { DIANA_DB_SERVER_ID: 'odmtestnode1' } });
  db = new DianaDb(server.options());
  await db.connect(5000);
  items = new Model({
    database: 'test',
    collection: `items_${Date.now()}`,
    name: 'Item',
    schema: { name: { type: Types.STRING }, parent: { type: Types.REFERENCE, reference: 'items' } },
  });
  await items.init();
});

after(async () => {
  await db?.disconnect();
  await server?.stop();
});

test('documents get _ids with the server id', { skip }, async () => {
  const doc = await items.insert({ name: 'a' });
  assert.match(doc._id, /^odmtestnode1-[0-9a-f]{4,8}-[0-9a-f]{11}-[0-9a-f]{9}$/);
});

test('_ids made by earlier server versions are accepted in queries and references', { skip }, async () => {
  for (const old of [
    'a1b2c3d4e5f6-1a2b-18f2c3d4e5f-123456789',
    '-1a2b-18f2c3d4e5f-123456789',
    'node_1-1a2b-18f2c3d4e5f-abcdef123',
  ]) {
    assert.deepEqual(await items.find([{ _id: old }]), [], old);
    const linked = await items.insert({ name: 'b', parent: old });
    assert.equal(linked.parent, old);
  }
});

test('a malformed _id is refused', { skip }, async () => {
  await assert.rejects(items.find([{ _id: 'not-an-id' }]));
  await assert.rejects(items.insert({ parent: 'node1-1a2b-18f2c3d4e5f-12345678' }));
});
