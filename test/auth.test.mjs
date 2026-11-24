import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startServer, skip, captureLogger } from './helpers.mjs';
import { DianaDb, Model, Types } from '../dist/index.js';

// A 4.0 server (protocol 1 only), for the fallback tests: DIANA_DB_SERVER_40_DIST, optional.
const OLD_DIST = process.env.DIANA_DB_SERVER_40_DIST;

let server;

before(async () => {
  if (skip) return;
  server = await startServer();
});

after(async () => {
  await server?.stop();
});

const serverLog = (dir) =>
  readdirSync(dir)
    .filter((file) => file.endsWith('-info.log'))
    .map((file) => readFileSync(join(dir, file), 'utf8'))
    .join('');

test('connects with protocol 2 and works', { skip }, async () => {
  const { lines, logger } = captureLogger();
  const db = new DianaDb(server.options({ logger, legacyAuth: false }));
  await db.connect(5000);
  assert.ok((await db.getVersion()).version);
  await db.disconnect();
  await new Promise((r) => setTimeout(r, 200));
  assert.match(serverLog(server.dir), /Connected user \\"admin\\" from IP 127.0.0.1 \(protocol 2\)/);
  assert.deepEqual(
    lines.filter((line) => line.startsWith('error')),
    [],
  );
});

test('a wrong password fails connect() at once with an authentication error', { skip }, async () => {
  const { logger } = captureLogger();
  const db = new DianaDb(server.options({ password: 'wrong', logger }));
  const started = Date.now();
  await assert.rejects(db.connect(10000), (error) => {
    assert.match(error.message, /Authentication with 127.0.0.1:\d+ failed: check the user name and password/);
    assert.equal(error.code, 'CONNECTION');
    return true;
  });
  assert.ok(Date.now() - started < 5000, 'not by the connect timeout');
});

test('subscribers authenticate with protocol 2 and receive changes', { skip }, async () => {
  const db = new DianaDb(server.options({ legacyAuth: false }));
  await db.connect(5000);
  const collection = `things_${Date.now()}`;
  const things = new Model({
    database: 'test',
    collection,
    name: 'Thing',
    schema: { n: { type: Types.NUMBER } },
    dianaDb: db,
  });
  await things.init();
  let resolveUpdate;
  const received = new Promise((resolve) => (resolveUpdate = resolve));
  await db.subscribe(`test.${collection}`, resolveUpdate);
  await things.insert({ n: 1 });
  const update = await Promise.race([
    received,
    new Promise((r) => setTimeout(() => r('timeout'), 5000)),
  ]);
  assert.notEqual(update, 'timeout');
  await db.disconnect();
  assert.match(serverLog(server.dir), /\(subscriber\) from IP 127.0.0.1 \(protocol 2\)/);
});

test('a server with legacy_auth=no accepts this client', { skip }, async () => {
  const strict = await startServer({ env: { DIANA_DB_LEGACY_AUTH: 'no' } });
  try {
    const db = new DianaDb(strict.options());
    await db.connect(5000);
    assert.ok((await db.getVersion()).version);
    await db.disconnect();
  } finally {
    await strict.stop();
  }
});

test(
  'falls back to protocol 1 with a 4.0 server',
  { skip: skip || (!OLD_DIST && 'set DIANA_DB_SERVER_40_DIST') },
  async () => {
    const old = await startServer({ dist: OLD_DIST });
    try {
      const { lines, logger } = captureLogger();
      const db = new DianaDb(old.options({ logger }));
      await db.connect(5000);
      assert.equal((await db.getVersion()).version, '4.0.0');
      await db.disconnect();
      assert.ok(lines.some((line) => /is older than 4.6.5: using legacy authentication/.test(line)));
      assert.deepEqual(
        lines.filter((line) => line.startsWith('error')),
        [],
      );

      const strictClient = new DianaDb(old.options({ legacyAuth: false, logger }));
      await assert.rejects(
        strictClient.connect(5000),
        /does not support authentication protocol 2 \(server before 4.6.5\) and legacyAuth is false/,
      );
    } finally {
      await old.stop();
    }
  },
);

test('after a server restart the client still uses protocol 2', { skip }, async () => {
  const { lines, logger } = captureLogger();
  let strict = await startServer({ env: { DIANA_DB_LEGACY_AUTH: 'no' } });
  const db = new DianaDb(strict.options({ logger, reconnectTimeoutValue: 100 }));
  try {
    await db.connect(5000);
    await strict.stop({ keep: true });
    // long enough for several refused attempts to reconnect
    await new Promise((r) => setTimeout(r, 600));
    strict = await startServer({ env: { DIANA_DB_LEGACY_AUTH: 'no' }, dir: strict.dir, port: strict.port });
    let version;
    for (let attempt = 0; attempt < 50 && !version; attempt++) {
      version = await db.getVersion().then(
        (answer) => answer.version,
        () => new Promise((r) => setTimeout(r, 100)),
      );
    }
    assert.ok(version, 'the client works again after the restart');
    assert.ok(!lines.some((line) => /legacy authentication/.test(line)), lines.join('\n'));
  } finally {
    await db.disconnect();
    await strict.stop();
  }
});
