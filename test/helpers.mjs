// Starts a real DianaDB server for the tests. DIANA_DB_SERVER_DIST must point to a built server's dist
// directory (the one holding diana-db.js and diana-db-server.js); without it the tests are skipped.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const SERVER_DIST = process.env.DIANA_DB_SERVER_DIST ? resolve(process.env.DIANA_DB_SERVER_DIST) : '';
export const skip = SERVER_DIST ? false : 'set DIANA_DB_SERVER_DIST to a built server dist directory';

let nextPort = 37000 + Math.floor(Math.random() * 2000);

export async function startServer({
  dist = SERVER_DIST,
  databases = ['test'],
  env = {},
  users = [
    [
      'admin',
      'password',
    ],
  ],
  dir: reuseDir,
  port: reusePort,
} = {}) {
  const dir = reuseDir || mkdtempSync(join(tmpdir(), 'diana-db-odm-test-'));
  const port = reusePort || nextPort++;
  const conf = join(dir, 'diana-db.conf');
  writeFileSync(
    conf,
    [
      `port=${port}`,
      `dump_directory=${dir}`,
      `logs_directory=${dir}`,
      'logs_ttl_value=7d',
      'current_dump_name=current.didb',
      'backup_name=backup.didb',
      'dump_create_interval=day',
      'store_strategy=local',
      '',
    ].join('\n'),
  );
  if (!reuseDir) {
    writeFileSync(join(dir, 'users'), '');
    for (const [
      user,
      password,
    ] of users) {
      execFileSync(process.execPath, [
        join(dist, 'diana-db.js'),
        'add-user',
        '-c',
        conf,
        '-u',
        user,
        '-p',
        password,
      ]);
      for (const db of databases) {
        execFileSync(process.execPath, [
          join(dist, 'diana-db.js'),
          'grant-access',
          '-c',
          conf,
          '-u',
          user,
          '-db',
          `${db}:3`,
        ]);
      }
    }
  }
  const child = spawn(
    process.execPath,
    [
      '--expose-gc',
      join(dist, 'diana-db-server.js'),
    ],
    {
      env: {
        ...process.env,
        DIANA_DB_DUMP_DIRECTORY: dir,
        DIANA_DB_LOG_DIRECTORY: dir,
        DIANA_DB_PORT: String(port),
        ...env,
      },
      stdio: [
        'ignore',
        'pipe',
        'pipe',
      ],
    },
  );
  let output = '';
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));
  const until = Date.now() + 15000;
  for (;;) {
    const ok = await new Promise((r) => {
      const s = net.connect(port, '127.0.0.1');
      s.once('connect', () => (s.destroy(), r(true)));
      s.once('error', () => r(false));
    });
    if (ok) break;
    if (Date.now() > until) throw new Error(`server did not start:\n${output}`);
    await new Promise((r) => setTimeout(r, 100));
  }
  return {
    dir,
    port,
    url: (user = 'admin', password = 'password') => `diana-db://${user}:${password}@127.0.0.1:${port}`,
    options: (extra = {}) => ({ host: '127.0.0.1', port, user: 'admin', password: 'password', ...extra }),
    output: () => output,
    async stop({ keep = false } = {}) {
      if (child.exitCode === null) {
        const exited = new Promise((r) => child.once('exit', r));
        child.kill('SIGTERM');
        await exited;
      }
      if (!keep) rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Collects what the ODM logs, so tests can assert that nothing unexpected was reported. */
export function captureLogger() {
  const lines = [];
  const push =
    (level) =>
    (...args) =>
      lines.push(`${level}: ${args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ')}`);
  return {
    lines,
    logger: { error: push('error'), warn: push('warn'), info: push('info'), log: push('log'), debug: push('debug') },
  };
}
