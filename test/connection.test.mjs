import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, skip, captureLogger } from './helpers.mjs';
import { DianaDb } from '../dist/index.js';

let server;

before(async () => {
  if (skip) return;
  server = await startServer();
});

after(async () => {
  await server?.stop();
});

test('disconnecting right after connecting logs no credentials error', { skip }, async () => {
  const { lines, logger } = captureLogger();
  const db = new DianaDb(server.options({ logger }));
  await db.connect(5000);
  await db.disconnect();
  await new Promise((r) => setTimeout(r, 300));
  assert.deepEqual(
    lines.filter((line) => line.startsWith('error')),
    [],
  );
});
