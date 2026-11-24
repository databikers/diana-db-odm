# DianaDB

**The first fully featured DBMS written in Node.js.**

DianaDB is a NoSQL, column-oriented database. It works with documents and collections, but stores data in a highly optimized columnar format: each document is decomposed into separate columns, each column tailored to a specific data type with its own storage and processing logic. Data integrity is enforced through document schemas that define the expected structure of each collection. Because of this layout, **every field in a document functions like an index**.

If you already know MongoDB, onboarding is quick — the query language is conceptually close to MQL.

|                     |                                                                |
| ------------------- | -------------------------------------------------------------- |
| **Current release** | Server v4.6.5 / ODM v4.6.5                                     |
| **ODM package**     | [`@diana-db/odm`](https://www.npmjs.com/package/@diana-db/odm) |
| **Documentation**   | [diana-db.com](https://diana-db.com)                           |
| **License**         | MIT with a usage restriction — see [License](#license)         |
| **Maintainer**      | [Data Bikers Limited](https://databikers.com)                  |

> Server >= 4.0.0 requires ODM >= 4.0.0. Server 4.6.5 and ODM 4.6.5 work with the 4.0 releases of the other side: see [Security](#security).

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Server Installation](#server-installation)
  - [Debian](#debian)
  - [Alpine](#alpine)
  - [Docker](#docker)
- [CLI Tool](#cli-tool)
- [Configuration](#configuration)
- [Security](#security)
- [Monitoring](#monitoring)
- [Replication](#replication)
- [Desktop Application](#desktop-application)
- [ODM for Node.js](#odm-for-nodejs)
  - [Connecting](#connecting)
  - [Constructor Options](#constructor-options)
  - [Client Methods](#client-methods)
- [Document Schema](#document-schema)
  - [Field Options](#field-options)
  - [Field Types](#field-types)
- [Model](#model)
- [Insert](#insert)
- [Find and Count](#find-and-count)
  - [Query Operands](#query-operands)
  - [TIME Queries](#time-queries)
  - [Spatial Queries](#spatial-queries)
  - [Array and Reference Queries](#array-and-reference-queries)
  - [distinct / max / min](#distinct--max--min)
  - [Transform Queries](#transform-queries)
  - [Projection Operands](#projection-operands)
- [Update](#update)
- [Remove](#remove)
- [Materialized Views](#materialized-views)
- [Subscribers](#subscribers)
- [Transactions](#transactions)
- [Migrations](#migrations)
- [Cook Book](#cook-book)
- [Benchmarks](#benchmarks)
- [Versioning and Changelog](#versioning-and-changelog)
- [Roadmap](#roadmap)
- [Reporting Issues](#reporting-issues)
- [License](#license)

---

## Features

| Feature                        | What it gives you                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| **TLS / mTLS**                 | Encrypt every connection, with optional mutual TLS to verify client identity          |
| **Built for speed**            | A lean columnar storage engine with no unnecessary overhead between you and your data |
| **Expressive query language**  | DiQL describes complex queries clearly and concisely                                  |
| **Materialized views**         | Precompute and store query results for instant reads on repeated, demanding queries   |
| **Geo-spatial queries**        | Query by location, polygon or route natively — no separate geo-indexing service       |
| **Relations**                  | Model connected data naturally without giving up document-store flexibility           |
| **Cross-database lookups**     | Join data across multiple databases on the same server                                |
| **Subscribers**                | React to database changes in real time, globally or per collection, without polling   |
| **Time queries**               | Query and manipulate documents by time ranges and intervals as a first-class feature  |
| **ACID transactions**          | Multi-document transactions with document-level locking                               |
| **Built-in migration storage** | Track and apply migrations with no extra tooling or external migration table          |
| **S3 sync**                    | Store dumps and backups directly in a private, S3-compatible bucket                   |
| **Vectors**                    | Store embeddings and search by distance or direction                                  |
| **Multi-master replication**   | Several servers hold the same data, and each of them accepts writes                   |
| **Monitoring**                 | `/health` and Prometheus `/metrics` over HTTP                                         |

Relations work without JOINs or explicit lookups. Given `user` and `post` collections, you can retrieve every post by a user named "John Doe" directly — and every post by users belonging to a specific team, even when the post stores only the user id and the user stores only the team id.

Scheduling work is a single query: every document relating to Tuesdays in July 2025, or shifting all scheduled items to the nearest available slot. That comes from the `TIME` type and its utilities.

Documents can be updated with **commands** rather than final scalar values, which makes concurrent updates dynamic and safe.

---

## Quick Start

```bash
# 1. Run a server
docker run -p 34567:34567 databikers/diana-db:debian

# 2. Install the client
npm i -s @diana-db/odm
```

```typescript
import { DianaDb, Model, Types } from '@diana-db/odm';

const dianaDb = new DianaDb('diana-db://admin:admin@localhost:34567?connectionPoolSize=5');
await dianaDb.connect(5000);

const userModel = new Model({
  database: 'test',
  collection: 'user',
  name: 'User',
  schema: {
    name: { type: Types.STRING, required: true, lowercase: true },
    age: { type: Types.NUMBER, precision: 0 },
    isActive: { type: Types.BOOLEAN, default: true },
    createdAt: { type: Types.TIME, default: () => new Date().toISOString() },
  },
});
await userModel.init();

await userModel.insert({ name: 'John', age: 33 });

const users = await userModel.find([{ name: { $eq: 'john' } }], [], { createdAt: -1 }, 0, 10);
```

> The server creates no default user. Add one yourself and grant access before connecting — see [CLI Tool](#cli-tool).

---

## Server Installation

### Debian

```bash
sudo echo "deb [arch=amd64 trusted=yes] https://dist.databikers.com stable main" | sudo tee /etc/apt/sources.list.d/diana-db.list
sudo apt-get update
sudo apt-get install -y diana-db
```

```bash
sudo service diana-db [status|start|stop]
```

### Alpine

```bash
wget -q -O /etc/apk/keys/sgerrand.rsa.pub https://alpine-pkgs.sgerrand.com/sgerrand.rsa.pub
wget https://github.com/sgerrand/alpine-pkg-glibc/releases/download/2.35-r1/glibc-2.35-r1.apk
apk add glibc-2.35-r1.apk
wget https://dist.databikers.com/x86_64/diana-db-2.5.3-r0.apk
apk add --allow-untrusted ./diana-db-2.5.3-r0.apk
```

```bash
sudo rc-service diana-db [status|start|stop]
```

### Docker

`entrypoint.sh` — Debian image:

```sh
#!/bin/sh
set -e
touch /var/lib/diana-db/current.didb
touch /var/lib/diana-db/users
/usr/bin/diana-db add-user -u admin -p admin
/usr/bin/diana-db grant-access -u admin -db test:3
/usr/bin/diana-db-server
```

`entrypoint.sh` — Alpine image:

```sh
#!/bin/sh
set -e
/usr/bin/diana-db add-user -u admin -p admin
/usr/bin/diana-db grant-access -u admin -db test:3
exec /usr/bin/diana-db-server
```

`Dockerfile`:

```dockerfile
FROM databikers/diana-db:debian
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
```

```bash
docker build -t local-diana-db .
docker run -p 34567:34567 local-diana-db
```

`docker-compose.yml`:

```yaml
version: '3.8'
services:
  diana-db:
    image: local-diana-db
    ports:
      - '34567:34567'
    volumes:
      - ./data/etc:/etc/diana-db
      - ./data/lib:/var/lib/diana-db
      - ./data/log:/var/log/diana-db
    restart: unless-stopped
    container_name: diana-db
    entrypoint: ['/entrypoint.sh']
```

---

## CLI Tool

`diana-db` manages the daemon, users, access and backups.

| Command         | Flags                       | Description                                                                   |
| --------------- | --------------------------- | ----------------------------------------------------------------------------- |
| `settings`      | –                           | Displays current settings (`diana-db --settings`)                             |
| `version`       | –                           | Displays current version (`diana-db --version`)                               |
| `start`         | `-c <conf>`                 | Stops any running instance, then launches `diana-db-server` in the background |
| `stop`          | `-c <conf>`                 | Kills the running `diana-db-server` process                                   |
| `add-user`      | `-u <user> -p <pass>`       | Creates a user with the given credentials                                     |
| `remove-user`   | `-u <user>`                 | Removes the user                                                              |
| `grant-access`  | `-u <user> -db <db:access>` | Grants database access. Levels: `0` read, `1` write, `3` manage               |
| `remove-access` | `-u <user> -db <db>`        | Removes database access                                                       |
| `list-backups`  | –                           | Displays the backup list                                                      |
| `create-backup` | `-n <name>`                 | Creates `[name].didb`. Server must be stopped                                 |
| `apply-backup`  | `-n <name>`                 | Applies `[name].didb`. Server must be stopped                                 |
| `remove-backup` | `-n <name>`                 | Removes `[name].didb`                                                         |

```bash
diana-db start -c /path/to/diana-db.conf
diana-db add-user -u alice -p s3cr3t
diana-db grant-access -u alice -db main:3
diana-db create-backup -n test_backup
```

---

## Configuration

`diana-db` reads a `key=value` config, defaulting to `/etc/diana-db/diana-db.conf`. Each key maps to an environment variable used by `diana-db-server`. Comments start with `#`.

| Key                                    | Environment Variable                    | Type          | Description                                                                             |
| -------------------------------------- | --------------------------------------- | ------------- | --------------------------------------------------------------------------------------- |
| `port`                                 | `DIANA_DB_PORT`                         | Integer       | Listening TCP port (default `34567`)                                                    |
| `dump_create_interval`                 | `DIANA_DB_DUMP_CREATE_INTERVAL`         | Integer (ms)  | How often to snapshot                                                                   |
| `logs_directory`                       | `DIANA_DB_LOG_DIRECTORY`                | Path          | Server log directory                                                                    |
| `dump_directory`                       | `DIANA_DB_DUMP_DIRECTORY`               | Path          | Dump directory                                                                          |
| `logs_ttl_value`                       | `DIANA_DB_LOG_TTL`                      | Integer (ms)  | Log retention                                                                           |
| `backup_name`                          | `DIANA_DB_BACKUP_NAME`                  | String        | Default backup filename when `-n` is omitted                                            |
| `current_dump_name`                    | `DIANA_DB_DUMP_CURRENT_NAME`            | String        | Filename for the latest dump                                                            |
| `store_strategy`                       | `DIANA_DB_STORE_STRATEGY`               | String        | `local` (default) or `s3`                                                               |
| `store_s3_endpoint`                    | `DIANA_DB_STORE_S3_ENDPOINT`            | URL           | Required when `store_strategy=s3`                                                       |
| `store_s3_bucket`                      | `DIANA_DB_STORE_S3_BUCKET`              | String        | Required when `store_strategy=s3`                                                       |
| `store_s3_region`                      | `DIANA_DB_STORE_S3_REGION`              | String        | Required when `store_strategy=s3`                                                       |
| `store_s3_access_key_id`               | `DIANA_DB_STORE_S3_ACCESS_KEY_ID`       | String        | Required when `store_strategy=s3`                                                       |
| `store_s3_secret_access_key`           | `DIANA_DB_STORE_S3_SECRET_ACCESS_KEY`   | String        | Required when `store_strategy=s3`                                                       |
| `ssl_cert_file`                        | `DIANA_DB_SSL_CERT_FILE`                | Path          | TLS certificate. Enables TLS with `ssl_key_file`                                        |
| `ssl_key_file`                         | `DIANA_DB_SSL_KEY_FILE`                 | Path          | TLS private key                                                                         |
| `ssl_ca_file`                          | `DIANA_DB_SSL_CA_FILE`                  | Path          | CA used to verify client certificates (mTLS)                                            |
| `ssl_request_cert`                     | `DIANA_DB_SSL_REQUEST_CERT`             | Boolean (0/1) | Request a client certificate (mTLS)                                                     |
| `ssl_reject_unauthorized`              | `DIANA_DB_SSL_REJECT_UNAUTHORIZED`      | Boolean (0/1) | Reject certificates that fail verification                                              |
| `transactions_min_auto_rollback_value` | `DIANA_DB_TRANSACTION_AUTOROLLBACK_MIN` | Integer (ms)  | Minimum auto-rollback delay                                                             |
| `transactions_max_auto_rollback_value` | `DIANA_DB_TRANSACTION_AUTOROLLBACK_MAX` | Integer (ms)  | Maximum auto-rollback delay                                                             |
| `server_id`                            | `DIANA_DB_SERVER_ID`                    | String        | First part of new `_id`s: exactly 12 lowercase letters or digits (default: MAC address) |
| `legacy_auth`                          | `DIANA_DB_LEGACY_AUTH`                  | Boolean       | Accept clients older than 4.6.5 (default `yes`)                                         |
| `http`                                 | `DIANA_DB_HTTP`                         | Boolean       | HTTP server for monitoring (default `yes`)                                              |
| `http_port`                            | `DIANA_DB_HTTP_PORT`                    | Integer       | Its port (default `34568`)                                                              |
| `http_host`                            | `DIANA_DB_HTTP_HOST`                    | String        | Its address (default `127.0.0.1`)                                                       |
| `http_token`                           | `DIANA_DB_HTTP_TOKEN`                   | String        | Require `Authorization: Bearer <token>` (16+ characters)                                |
| `cluster_peers`                        | `DIANA_DB_CLUSTER_PEERS`                | String        | Other servers of the cluster: `host:port,host:port`                                     |
| `cluster_secret`                       | `DIANA_DB_CLUSTER_SECRET`               | String        | Shared by all servers of the cluster (16+ characters)                                   |
| `cluster_port`                         | `DIANA_DB_CLUSTER_PORT`                 | Integer       | Port for the other servers (default `34569`)                                            |
| `cluster_host`                         | `DIANA_DB_CLUSTER_HOST`                 | String        | Its address (default `0.0.0.0`)                                                         |
| `cluster_tombstone_ttl`                | `DIANA_DB_CLUSTER_TOMBSTONE_TTL`        | `7d`, `48h`   | How long removals are remembered (default `7d`)                                         |
| `cluster_oplog_size`                   | `DIANA_DB_CLUSTER_OPLOG_SIZE`           | Integer       | Changes kept for servers that reconnect (default `100000`)                              |
| `memory_reserve_percent`               | `DIANA_DB_MEMORY_RESERVE_PERCENT`       | Integer 1–50  | Refuse requests below this free share (5)                                               |

```ini
# /etc/diana-db/diana-db.conf
binary_path=/usr/bin/diana-db-server
port=34567
transactions_min_auto_rollback_value=1000
transactions_max_auto_rollback_value=60000
logs_directory=/var/log/diana-db
logs_ttl_value=7d
dump_directory=/var/lib/diana-db
current_dump_name=current.didb
backup_name=backup.didb
dump_create_interval=day
store_strategy=local
```

> **Switching to `store_strategy=s3`:** upload your existing `users` file and current data (`/var/lib/diana-db/*`) to the target bucket **first**. DianaDB does not migrate local data automatically — switching without uploading starts the server with an empty dataset.

---

## Security

- **TLS / mTLS.** Connections can be encrypted in transit, with optional mutual TLS so the server verifies client identity via certificates.
- **The password is never transmitted.** Client and server prove to each other that they know it (a salted challenge and response, the password stretched with scrypt), and every request and response is then encrypted with **AES-256-GCM** using a key made for that connection only. Tampered or wrongly-keyed requests fail authentication and are rejected.
- **Stored credentials are salted.** `diana-db add-user` stores a per-user random salt and verifiers, not the password.
- **Segregated access control.** Access is granted per user and per database — read, write, or manage.
- **Private storage.** Dumps and backups can be written to a private S3-compatible bucket.

> Passwords are never sent over the wire, but connection metadata is sent in plaintext at connection start. Enable TLS if metadata confidentiality matters.

**Upgrading from 4.0.** The handshake above is protocol 2, new in 4.6.5. Both sides still speak the 4.0 protocol:

- ODM 4.6.5 falls back to it when the server is older than 4.6.5. Pass `legacyAuth: false` (or `?legacyAuth=false`) to refuse that.
- Server 4.6.5 accepts 4.0 clients while `legacy_auth` is on (the default). Users created before 4.6.5 work with both protocols without any change.
- When every client is on 4.6.5, set `legacy_auth=no`.

---

## Monitoring

The server answers HTTP on `http_port` (`34568`), by default on `127.0.0.1` only:

| Route          | Answer                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| `GET /health`  | `200` and the server state as JSON; `503` while requests are refused because memory is exhausted                  |
| `GET /metrics` | Prometheus text format: requests by action, memory, write-ahead log, snapshots, documents per collection, cluster |

```bash
curl http://127.0.0.1:34568/health
```

To reach it from another machine set `http_host` (for example `0.0.0.0`) and `http_token`; requests then need `Authorization: Bearer <token>`. `http=no` turns the HTTP server off. A busy `http_port` is logged and the database keeps running.

---

## Replication

Several servers can hold the same data, and each of them accepts reads and writes (multi-master). Every server lists the others:

```ini
# server 1 (10.0.0.1); servers 2 and 3 are configured the same way with their own server_id and peers
server_id=dianadbnode1
cluster_secret=<the same on every server, 16 or more characters>
cluster_peers=10.0.0.2:34569,10.0.0.3:34569
```

`server_id` is required in a cluster and must differ on every server. A cluster needs `store_strategy=local` and the write-ahead log. The server does not start when a cluster setting is missing, and says which one.

How it behaves:

- A write is confirmed by the server that received it and reaches the others right after (asynchronously). A read on another server may not see it for a moment.
- Two servers changing **different fields** of one document: both changes are kept. The **same field**: the newest write wins everywhere. Server clocks are compared, so keep them synchronized (NTP); `/metrics` reports the difference.
- A removal wins over changes made to the same document elsewhere at the same time. Removals are remembered for `cluster_tombstone_ttl`.
- Collections, schema changes, views and vectors replicate. A transaction replicates when it is committed.
- A server that was down gets what it missed when it returns. A new server, or one away for longer than `cluster_oplog_size` changes, receives the whole state and merges it. A server that was away for longer than `cluster_tombstone_ttl` must start with an empty data directory, otherwise documents removed meanwhile can come back.
- Connections between servers are authenticated with `cluster_secret` and encrypted.

Limits to know before using it:

- **`unique` is checked on the server that accepts the write.** Two servers can accept the same unique value at the same moment; both documents then exist.
- **Command updates** (`$inc` and similar) replicate as the resulting value. Two servers incrementing the same field at the same moment end with one of the two results, not the sum.
- **Transactions are atomic on the server that runs them.** Other servers receive their changes one by one, and locks are not shared between servers.
- **Users and access rights are per server.** Run `add-user` and `grant-access` on each of them.
- Clients connect to one server. The ODM does not switch to another server by itself.

---

## Desktop Application

A cross-platform GUI for working directly against a server: browse and manage data, edit schemas and their relationships, create and inspect materialized views, and test queries against real data.

- Linux (AppImage): `https://dist.databikers.com/gui/diana-db-gui/DianaDB-GUI-1.1.2.AppImage`
- Windows: `https://dist.databikers.com/gui/diana-db-gui/DianaDB-GUI%20Setup%201.1.2.exe`

---

## ODM for Node.js

```bash
npm i -s @diana-db/odm
```

### Connecting

```typescript
import { readFileSync } from 'node:fs';
import { DianaDb } from '@diana-db/odm';

export const dianaDb = new DianaDb({
  host: 'localhost',
  port: 34567,
  user: 'db-user',
  password: 'some-password',
  connectionPoolSize: 5,
  connectTimeoutValue: 5000,
  reconnectTimeoutValue: 1000,
  secureServer: true,
  tls: {
    cert: readFileSync('/path/to/cert'),
    key: readFileSync('/path/to/key'),
    ca: readFileSync('/path/to/ca'),
    rejectUnauthorized: true,
  },
});

await dianaDb.connect(5000);
```

Or with a connection string:

```typescript
new DianaDb('diana-db://user:pass@localhost:34567?connectionPoolSize=5'); // plain
new DianaDb('diana-dbs://user:pass@localhost:34567/shop?connectionPoolSize=5'); // TLS, default database "shop"
```

`connectionPoolSize`, `connectTimeoutValue`, `reconnectTimeoutValue` and `requestTimeoutValue` are accepted as query parameters, and `rejectUnauthorized=true` with `diana-dbs://`. The optional path sets the `database` option. User name and password are URL-decoded, so encode special characters (`p%40ss` for `p@ss`). The `diana-dbs://` scheme sets `secureServer: true`; any other protocol throws a configuration error.

You can create as many instances as you like — each has its own migrations and subscribers, and connects independently. A model sends its requests through the instance passed as `dianaDb` in its options, or else through the instance most recently constructed before the model.

`connect()` resolves as soon as one pooled connection is up; the rest connect in the background. If every connection is down later (server restart, network blip), requests are queued and sent when a connection is back, or fail with a `TIMEOUT` error after `requestTimeoutValue`. Requests already on a connection that drops fail at once with a `CONNECTION` error. After `disconnect()`, requests fail immediately until `connect()` is called again.

### Constructor Options

| Option                  | Type                                                     | Default   | Constraint   |
| ----------------------- | -------------------------------------------------------- | --------- | ------------ |
| `host`                  | string                                                   | –         | **required** |
| `port`                  | integer                                                  | `34567`   | 1025–65535   |
| `user`                  | string                                                   | –         | **required** |
| `password`              | string                                                   | –         | **required** |
| `connectionPoolSize`    | integer                                                  | `5`       | >= 1         |
| `connectTimeoutValue`   | integer (ms)                                             | `30000`   | –            |
| `reconnectTimeoutValue` | integer (ms)                                             | `1000`    | –            |
| `requestTimeoutValue`   | integer (ms)                                             | `30000`   | >= 1         |
| `database`              | string                                                   | –         | –            |
| `secureServer`          | boolean                                                  | `false`   | –            |
| `tls`                   | `{ cert?, key?, ca?, rejectUnauthorized?, servername? }` | –         | –            |
| `legacyAuth`            | boolean                                                  | `true`    | –            |
| `logger`                | object                                                   | `console` | –            |

- `legacyAuth: false` refuses servers older than 4.6.5 instead of falling back to their handshake (see [Security](#security)). Also accepted as `?legacyAuth=false` in a connection string.
- `database` is used by `migrateUp`, `migrateDown` and `getMigrations` when they are called without one.
- `tls` values are Buffers (`readFileSync`) or PEM strings; `ca` may be an array. Other Node.js `tls.connect` options pass through. `cert`/`key` are only needed when the server verifies clients (mTLS).
- `rejectUnauthorized` defaults to `false`, so self-signed servers work out of the box. **Set it to `true` with `ca` in production**: the certificate is then checked against `host` (or `servername`), so connect by the name in the certificate, not by IP.

### Client Methods

| Method                    | Arguments                                                | Returns                                         |
| ------------------------- | -------------------------------------------------------- | ----------------------------------------------- |
| `connect`                 | `connectTimeoutValue: number`                            | `Promise<boolean>`                              |
| `disconnect`              | –                                                        | `Promise<void>`                                 |
| `subscribe`               | `key: string`, `subscriber: (u: DatabaseUpdate) => void` | `Promise<void>`                                 |
| `unsubscribe`             | `key: string`, `subscriber?`                             | `Promise<void>`                                 |
| `addMigration`            | `migration: Migration`                                   | `void`                                          |
| `migrateUp`               | `database?`                                              | `Promise<MigrationInfo[]>`                      |
| `migrateDown`             | `database?`, `steps?`                                    | `Promise<MigrationInfo[]>`                      |
| `getMigrations`           | `database?`                                              | `Promise<string[]>`                             |
| `startTransaction`        | `{ database, autoRollBackAfterMs? }`                     | `Promise<string>`                               |
| `commitTransaction`       | `{ database, transactionId }`                            | `Promise<TransactionInfo>`                      |
| `rollbackTransaction`     | `{ database, transactionId }`                            | `Promise<TransactionInfo>`                      |
| `getDatabases`            | –                                                        | `Promise<string[]>`                             |
| `createDatabase`          | `database`                                               | `Promise<{ database, action }>`                 |
| `removeDatabase`          | `database`                                               | `Promise<{ database, action }>`                 |
| `getCollections`          | `database`                                               | `Promise<string[]>`                             |
| `createCollection`        | `database, collection, schema`                           | `Promise<{ collection, action }>`               |
| `removeCollection`        | `database, collection`                                   | `Promise<{ collection, action }>`               |
| `getCollectionSchema`     | `database, collection`                                   | `Promise<{ schema, locked }>`                   |
| `getCollectionSchemaLock` | `database, collection`                                   | `Promise<{ collection, locked }>`               |
| `lockCollectionSchema`    | `database, collection`                                   | `Promise<{ collection, locked }>`               |
| `unlockCollectionSchema`  | `database, collection`                                   | `Promise<{ collection, locked }>`               |
| `getCollectionViews`      | `database, collection`                                   | `Promise<Record<string, { transformQueries }>>` |
| `getHealth`               | –                                                        | `Promise<HealthInfo>`                           |
| `getVersion`              | –                                                        | `Promise<{ version: string }>`                  |

```typescript
type HealthInfo = {
  memory: number; // MB
  cpu: number; // %
  gcp: number; // garbage collector pressure, %
  elu: number; // event loop utilization, %
  eld: number; // event loop delay, ms
};
```

---

## Document Schema

A schema is a configuration object describing the structure of stored documents. Keys map to document properties. `_id` is added automatically — you do not declare it.

### Field Options

| Option          | Type                               | Description                                                                     | Required                                | Default |
| --------------- | ---------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------- | ------- |
| `type`          | `Types`                            | Field type                                                                      | **Yes**                                 | –       |
| `required`      | boolean                            | Property must be present                                                        | No                                      | `false` |
| `unique`        | boolean                            | Property must be unique                                                         | No                                      | `false` |
| `mutable`       | boolean                            | Value may change after creation                                                 | No                                      | `true`  |
| `lowercase`     | boolean                            | **STRING only.** Lowercases the value                                           | No                                      | `false` |
| `uppercase`     | boolean                            | **STRING only.** Uppercases the value                                           | No                                      | `false` |
| `default`       | `T`, `() => T`, `() => Promise<T>` | Default value or factory, evaluated in the document's context                   | No                                      | –       |
| `set`           | function                           | Applied to the incoming value on insert and update, before validation           | No                                      | –       |
| `get`           | function                           | Applied to each found document. Skipped when the query uses transform queries   | No                                      | –       |
| `items`         | `Types`                            | **ARRAY only.** Item type                                                       | **Yes** (if ARRAY)                      | –       |
| `reference`     | string                             | Referenced collection name                                                      | **Yes** (if type or items is REFERENCE) | –       |
| `triggerRemove` | boolean                            | **REFERENCE only.** Remove this document when the referenced item is deleted    | No                                      | `false` |
| `ttl`           | integer >= 5                       | **TIME only.** Time to live in ms from insertion                                | No                                      | –       |
| `precision`     | integer 0–8                        | **NUMBER only.** Decimal places retained. Without it values are stored as given | No                                      | –       |
| `dimensions`    | integer 1–65536                    | **VECTOR only.** Length of every vector; can't change while vectors are stored  | **Yes** (if VECTOR)                     | –       |

Enforced exclusions:

- `lowercase` and `uppercase` cannot both be set.
- At most one of `default`, `set`, `get` per field.
- Type-scoped options are **rejected** on other types — this is a validation error, not a silently ignored option.

### Field Types

| Type              | Description                                  | Notes                                                            |
| ----------------- | -------------------------------------------- | ---------------------------------------------------------------- |
| `Types.STRING`    | String                                       | Supports `lowercase` / `uppercase`                               |
| `Types.NUMBER`    | Number                                       | Optional `precision` (fixed decimal places, e.g. money)          |
| `Types.BOOLEAN`   | Boolean                                      | –                                                                |
| `Types.POSITION`  | `{ x, y }` point                             | Enables spatial queries                                          |
| `Types.VECTOR`    | Numbers of length `dimensions` (embeddings)  | Similarity search: `$neighbors`, `$direction`. Not an ARRAY item |
| `Types.OBJECT_ID` | `<server id>-<pid>-<timestamp>-<random>`     | Server id: MAC address or `server_id`. Not BSON                  |
| `Types.REFERENCE` | Like OBJECT_ID, linked to another collection | Requires `reference`. Enables `$subQuery`                        |
| `Types.TIME`      | ISO 8601 string **or** epoch milliseconds    | Supports time filters and `ttl`                                  |
| `Types.ARRAY`     | Homogeneous array of `items` type            | Any type but VECTOR as items. Set-like: unique values only       |

```typescript
import { Types, Schema } from '@diana-db/odm';

export const userSchema: Schema<User> = {
  name: { type: Types.STRING, unique: true, required: true, lowercase: true },
  isActive: { type: Types.BOOLEAN, default: true },
  position: { type: Types.POSITION },
  createdAt: { type: Types.TIME, default: () => new Date().toISOString() },
};

export const postSchema: Schema<Post> = {
  user: { type: Types.REFERENCE, reference: 'user', required: true, triggerRemove: true },
  title: { type: Types.STRING, required: true },
  isPublished: { type: Types.BOOLEAN, default: true },
  publishedAt: { type: Types.TIME, required: true },
};
```

> **Be careful with schema changes.** Differences between the old and new schema are detected automatically and applied server-side when your code runs — you may lose data. Keep schemas in one shared package used as a dependency across your project, or lock the collection schema.

---

## Model

```typescript
import { Model } from '@diana-db/odm';

const userModel = new Model<User>({
  database: 'test',
  collection: 'user',
  name: 'User',
  schema: userSchema,
  // dianaDb: secondClient, // optional: which DianaDb instance this model uses
});

await userModel.init();
```

`init()` is safe to call concurrently (callers share one attempt) and can be retried after a failure. `insert` and `update` apply defaults and setters to a copy, so the object you pass is not modified. `find`, `count`, `update` and `remove` accept one FindQuery or an array; `find()` and `count()` without filters match everything.

| Method                                                             | Description                                                                     | Returns                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ----------------------------------------------- |
| `init()`                                                           | Creates the collection or reconciles the schema. Called lazily by other methods | `Promise<void>`                                 |
| `Model.init()` _(static)_                                          | Initializes every constructed model                                             | `Promise<void>`                                 |
| `insert(data, transactionId?)`                                     | Applies defaults and setters, validates, inserts                                | `Promise<T & { _id }>`                          |
| `find(filters, transforms?, sort?, skip?, limit?, transactionId?)` | Finds documents                                                                 | `Promise<T[]>`                                  |
| `count(filters, transforms?, transactionId?)`                      | Counts matching documents                                                       | `Promise<number>`                               |
| `update(filters, updateData, transactionId?)`                      | Updates matching documents                                                      | `Promise<{ found, modified }>`                  |
| `remove(filters, transactionId?)`                                  | Removes matching documents                                                      | `Promise<{ found, removed }>`                   |
| `distinct(key)`                                                    | Unique values for a key                                                         | `Promise<any[]>`                                |
| `max(key)`                                                         | Documents holding the maximum value                                             | `Promise<T[]>`                                  |
| `min(key)`                                                         | Documents holding the minimum value                                             | `Promise<T[]>`                                  |
| `createView(name, transformQueries)`                               | Creates a materialized view                                                     | `Promise<{ view, action: 'created' }>`          |
| `removeView(name)`                                                 | Removes a materialized view                                                     | `Promise<{ view, action: 'removed' }>`          |
| `getViews()`                                                       | Views defined on this collection                                                | `Promise<Record<string, { transformQueries }>>` |
| `findByView(name, filter?, sort?, skip?, limit?)`                  | Queries a view                                                                  | `Promise<any[]>`                                |
| `countByView(name, filter?)`                                       | Counts results in a view                                                        | `Promise<number>`                               |
| `lock()`                                                           | Locks this collection's schema                                                  | `Promise<{ collection, locked }>`               |
| `unlock()`                                                         | Unlocks this collection's schema                                                | `Promise<{ collection, locked }>`               |

---

## Insert

```typescript
const user = await userModel.insert({
  name: 'John',
  position: { x: 1, y: 1 },
  createdAt: new Date().toISOString(),
});
```

```javascript
{
  _id: 'dc4628514b81-939f-198a25f76b7-bb1a9a777',
  name: 'john',
  position: { x: 1, y: 1 },
  isActive: true,
  createdAt: '2025-06-18T06:30:24.977Z'
}
```

`_id` is added automatically. Fields with `default` are filled when absent; fields with `set` pass through the setter before validation. The returned document is a plain object with no special methods.

To insert many documents use `insertMany`: one request per batch instead of one per document (about 40 times faster for 10,000 small documents on one connection).

```typescript
const users = await userModel.insertMany([
  { name: 'John' },
  { name: 'Jane' },
]);
// optional: a transaction, and the batch size (default 1000, up to 10000)
await userModel.insertMany(documents, transactionId, 5000);
```

It returns the inserted documents in the given order. A batch is inserted completely or not at all: if one document is invalid, the error names its position and nothing of that batch is stored. Batches already sent stay inserted, so use a transaction when all documents must be stored together. Requires server 4.6.5 or newer.

---

## Find and Count

```typescript
const [user] = await userModel.find(
  [{ name: { $eq: 'John' } }], // FindQuery — array behaves as OR
  [{ $project: { name: true } }], // Transform Queries
  { _id: -1 }, // Sorting
  0, // Skip
  1, // Limit
);
```

Operands within one FindQuery are ANDed; an array of FindQueries is ORed. The first argument is required, the rest are optional. `count` takes the first two arguments plus `transactionId` and returns a number.

### Query Operands

| Operand                                                   | Types                | Description                                    |
| --------------------------------------------------------- | -------------------- | ---------------------------------------------- |
| `$eq`                                                     | all                  | Equals. Shorthand: `{ name: 'John' }`          |
| `$ne`                                                     | all                  | Not equal                                      |
| `$in` / `$nin`                                            | all                  | Value is / is not in the given array           |
| `$gt` `$gte` `$lt` `$lte`                                 | NUMBER               | Range comparison                               |
| `$regex`                                                  | STRING               | Regular expression match                       |
| `$startsWith` `$endsWith` `$notStartsWith` `$notEndsWith` | STRING               | Prefix / suffix match                          |
| `$cn` / `$nc`                                             | STRING               | Contains / does not contain                    |
| `$subQuery`                                               | REFERENCE, OBJECT_ID | Nested query against the referenced collection |

> On OBJECT_ID, REFERENCE and BOOLEAN fields exactly **one** operand may be used per field, so `$subQuery` must stand alone.

### TIME Queries

A TIME field is never compared directly. Each part operand takes a numeric query; `$raw` takes a string query against the stored value.

`$year` `$month` `$date` `$hours` `$minutes` `$seconds` `$dayOfWeek` `$dayOfYear` `$timestamp` `$raw`

```typescript
// Range over an instant
{ createdAt: { $timestamp: { $gte: 1750000000000, $lt: 1755000000000 } } }

// Calendar parts
{ createdAt: { $year: { $eq: 2025 }, $month: { $in: [1, 4] }, $dayOfWeek: { $in: [0, 6] } } }

// Prefix match on the stored ISO value
{ createdAt: { $raw: { $startsWith: '2025-06' } } }
```

### Spatial Queries

```typescript
{ position: { $insideCircle: { center: { x: 1, y: 1 }, radius: 10 } } }
{ position: { $insidePolygon: [{ x: 1, y: 1 }, { x: 3, y: 0 }, { x: -1, y: -1 }] } }
{ position: { $nearLines: { lines: [[{ x: 1, y: 1 }, { x: 10, y: 10 }]], distance: 10 } } }
```

`$insideCircle` `$outsideCircle` `$insidePolygon` `$outsidePolygon` `$nearLines` `$farFromLines`. Polygons need at least 3 points; each line is exactly 2 points, at least one line. `$nearLines.distance` must be positive; `$farFromLines.distance` may be `0`.

### Vector Queries

```typescript
const docModel = new Model({
  database: 'test',
  collection: 'doc',
  name: 'Doc',
  schema: { title: { type: Types.STRING }, embedding: { type: Types.VECTOR, dimensions: 3 } },
});

await docModel.find([
  {
    embedding: {
      $neighbors: {
        vector: [
          0.12,
          -0.5,
          0.91,
        ],
        count: 5,
        metric: 'cosine',
      },
    },
  },
]);
await docModel.find([
  {
    embedding: {
      $direction: {
        vector: [
          0.12,
          -0.5,
          0.91,
        ],
        minSimilarity: 0.8,
      },
    },
  },
]);
```

`$neighbors`: the `count` nearest vectors (default 10); `metric` is `euclidean` (default), `cosine` or `dot`; optional `maxDistance` (euclidean, cosine). `$direction`: cosine similarity of at least `minSimilarity` (-1 to 1), optional `count`. Results come closest first unless the query has a sort. The query vector must have the field's `dimensions`; the search is exact. Other fields in the same filter narrow the similarity result.

### Array and Reference Queries

Array fields accept the same operands as their item type, applied per element with OR semantics:

```typescript
// documents whose array contains 1 and 2 but not 3
{ someArrayProperty: { $in: [1, 2], $nin: [3] } }
```

Reference fields query the target collection inline, with no aggregation:

```typescript
{
  user: {
    $subQuery: {
      name: {
        $eq: 'John';
      }
    }
  }
}
```

### distinct / max / min

```typescript
const names = await userModel.distinct('name');
const best = await userModel.max('score');
const worst = await userModel.min('score');
```

### Transform Queries

An array of stage objects, each holding exactly **one** key.

| Stage          | Description                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `$project`     | Each key becomes a property of the result. Value: boolean (keep/drop), pointer string, or a projection operand object  |
| `$group`       | Same shape as `$project` plus a required `_id` — `false` to merge into one, a pointer string, or an object of pointers |
| `$match`       | Filters current documents. Boolean, string, number, TIME and spatial queries only — **not** `$subQuery` or `_id`       |
| `$lookup`      | `{ collection*, as*, localField*, foreignField*, database, filter, sort, skip, limit, replaceRoot }`                   |
| `$unwind`      | Pointer string. One document per array item                                                                            |
| `$replaceRoot` | Pointer string. Replaces each document with the value at that property                                                 |
| `$sort`        | `{ field: 1 \| -1 }`, multi-key                                                                                        |
| `$skip`        | Integer >= 0                                                                                                           |
| `$limit`       | Positive integer, >= 1                                                                                                 |

`$unwind` and `$replaceRoot` values are pointers — they start with `$`.

```typescript
const result = await postModel.find(
  [{}],
  [
    { $group: { _id: '$user', user: { $first: '$user' }, postsCount: { $sum: [1] } } },
    {
      $lookup: {
        database: 'test',
        collection: 'user',
        localField: 'user',
        foreignField: '_id',
        as: 'user',
        filter: { isActive: { $eq: true } },
      },
    },
    { $unwind: '$user' },
    { $project: { _id: false, user: true, postsCount: true } },
    { $sort: { postsCount: -1 } },
    { $skip: 1 },
    { $limit: 1 },
  ],
);
```

### Projection Operands

Each projection object holds exactly one operand. Since Server 1.4.8 math operands never implicitly include the existing value — reference it as a pointer: `{ $sum: ['$amount', 123] }`.

| Operand                                                                                        | Format                        | Description                                             |
| ---------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------- |
| `$max` `$min` `$avg`                                                                           | pointer string                | Maximum / minimum / average                             |
| `$sum` `$subtract` `$multiply` `$divide`                                                       | array of numbers and pointers | Arithmetic. `$divide` rejects a `0` divisor             |
| `$round`                                                                                       | integer 0–8                   | Rounds to the given precision                           |
| `$ifNull`                                                                                      | array                         | First non-null / non-undefined value                    |
| `$push`                                                                                        | array                         | Creates an array property and pushes values             |
| `$addToSet`                                                                                    | array                         | Like `$push`, unique only                               |
| `$concatArray`                                                                                 | pointer to an array property  | Concatenates arrays                                     |
| `$first` `$last`                                                                               | pointer string                | First / last value                                      |
| `$concat`                                                                                      | `{ delimiter, parts[] }`      | Concatenates strings; pointers in `parts` are evaluated |
| `$year` `$month` `$date` `$hours` `$minutes` `$seconds` `$dayOfWeek` `$dayOfYear` `$timestamp` | pointer to a TIME property    | Extracts the part as a number                           |

---

## Update

```typescript
await userModel.update([{ name: { $eq: 'John' } }], { isActive: false });
```

Values may be plain values, or an operator object describing an update strategy for that field's type.

**String**

| Operator   | Type                           | Effect                                                                    |
| ---------- | ------------------------------ | ------------------------------------------------------------------------- |
| `$concat`  | `{ delimiter, parts[] }`       | Concatenates `parts` with `delimiter`                                     |
| `$replace` | `[search, replacement, flags]` | Replaces a substring; `flags` is a RegExp flag combination such as `'gm'` |

**Number** — each operand takes a number literal

| Operator                       | Effect                             |
| ------------------------------ | ---------------------------------- |
| `$add` `$subtract` `$multiply` | Arithmetic on the current value    |
| `$divide`                      | Divides. Divisor may not be `0`    |
| `$round`                       | Rounds to a precision, integer 0–8 |

**Array** — exactly one operator per field per call

| Operator      | Effect                                    |
| ------------- | ----------------------------------------- |
| `$addItem`    | Appends an element if not already present |
| `$removeItem` | Removes an element if found               |

> Renamed in 1.9.0 from `$add` / `$remove` to avoid clashing with the numeric operators.

**TIME**

| Operator                            | Structure                                        | Effect                                                  |
| ----------------------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| `$add` / `$subtract`                | `{ amount: positive integer, unit: UnitOfTime }` | Adds / subtracts time                                   |
| `$toStartOf` / `$toEndOf`           | `UnitOfTime`                                     | Rounds down / up to the unit                            |
| `$toNextWeekday` / `$toLastWeekday` | `Weekday`                                        | Jumps to the next / previous occurrence of that weekday |

`UnitOfTime`: `'year'` `'month'` `'week'` `'day'` `'hour'` `'minute'` `'second'` `'millisecond'`

`Weekday`: `'Sunday'` `'Monday'` `'Tuesday'` `'Wednesday'` `'Thursday'` `'Friday'` `'Saturday'`

---

## Remove

```typescript
const { found, removed } = await userModel.remove([{ isActive: { $eq: false } }]);
```

---

## Materialized Views

A view is a stored aggregation that updates automatically when the underlying data changes. Views support cross-database lookups.

```typescript
await transactionModel.createView('balance', [
  {
    $group: {
      _id: { user: '$user', currency: '$currency' },
      user: { $first: '$user' },
      amount: { $sum: ['$amount'] },
      currency: { $first: '$currency' },
    },
  },
]);

const balances = await transactionModel.findByView('balance', { user: { $eq: userId } }, { amount: -1 });
const count = await transactionModel.countByView('balance', { user: { $eq: userId } });
const views = await transactionModel.getViews();

await transactionModel.removeView('balance');
```

The view name must not collide with a collection or view name in that database. Keys in a view's `findQuery` match the **view's output shape**, not the source schema.

---

## Subscribers

```typescript
// 'user.post' = database 'user', collection 'post'
// 'user' alone = every collection in the 'user' database
const onPost = (databaseUpdate) => {
  // handle the update
};
await dianaDb.subscribe('user.post', onPost);

await dianaDb.unsubscribe('user.post', onPost); // or unsubscribe('user.post') for every subscriber of the key
```

Several subscribers per key are allowed; one that throws does not affect the others. Subscriptions use a dedicated connection that reconnects on its own, and `disconnect()` closes it. Updates are delivered only for databases the user can read.

| Field         | Type                               | Description                             |
| ------------- | ---------------------------------- | --------------------------------------- |
| `database`    | string                             | Database name                           |
| `collection`  | string                             | Collection name                         |
| `action`      | `'insert' \| 'update' \| 'remove'` | Operation that fired the update         |
| `affectedIds` | `string[]`                         | Ids affected                            |
| `data`        | object                             | Document snapshot for insert and update |

---

## Transactions

Non-blocking ACID transactions with document-level (row-level) locking.

- Transactions have higher priority than regular requests and can overwrite previously saved data.
- Affected documents are locked dynamically throughout execution until commit or rollback.
- Each transaction has its own scope; changes are invisible outside it until committed.

```typescript
const transactionId = await dianaDb.startTransaction({
  database: 'test',
  autoRollBackAfterMs: 60000,
});

const manageTransactionParameters = { database: 'test', transactionId };

try {
  await userModel.remove([{ ...filters }], transactionId);
  await dianaDb.commitTransaction(manageTransactionParameters);
} catch (e) {
  await dianaDb.rollbackTransaction(manageTransactionParameters);
}
```

`startTransaction` resolves to the transaction id string. `autoRollBackAfterMs` is clamped by the server's `transactions_min_auto_rollback_value` and `transactions_max_auto_rollback_value`. Both calls resolve to `{ transactionId, status }`, where status is `'committed'` or `'rolled-back'`.

---

## Migrations

DianaDB ships its own migration storage.

```typescript
dianaDb.addMigration({
  index: 1, // unique integer index
  name: 'MyFirstMigration', // unique name
  up: async () => {
    // apply changes
  },
  down: async () => {
    // revert changes
  },
});

await dianaDb.connect(5000);
await dianaDb.migrateUp('test'); // or set the `database` option and call migrateUp()
await dianaDb.migrateDown('test', 1); // revert only the last applied migration
```

The server keeps one list of applied migrations but checks WRITE access on a database, so each call needs one: pass it, or set the `database` constructor option (or the connection string path). `migrateUp` runs pending migrations in ascending index order; `migrateDown` reverts applied ones in descending order — all of them, or the last `steps`. Both resolve with the server's record of each migration they ran, `{ name, status }` with status `'up'` or `'down'` (the server answers `{ migration: { name, status } }` per call). If the server does not confirm a migration, the call throws a migration error naming it — its `up()`/`down()` has already run at that point, so check its effects before retrying.

A migration may span many databases and collections. There is a single list of applied migrations, so names and indexes must be unique — a duplicate index throws immediately. Migrations run in ascending index order. **Never edit the code inside a migration after it has run.**

---

## Errors

Every failed request rejects with an `Error` that carries a `code`:

| `code`       | Meaning                                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `SERVER`     | The server rejected the request (validation, access, unknown collection…). Nothing was changed                                                 |
| `DURABILITY` | The change was applied but the server could not write it to its write-ahead log. It may be lost if the server crashes before the next snapshot |
| `MEMORY`     | The server is almost out of memory and refused the request; nothing was changed. It refuses requests (except removals) until memory is freed   |
| `TIMEOUT`    | No answer within `requestTimeoutValue`. The request may or may not have been applied                                                           |
| `CONNECTION` | Not connected, or the connection closed before the answer. The request may or may not have been applied                                        |

```typescript
import { DianaDbError } from '@diana-db/odm';

try {
  await orderModel.insert(order);
} catch (e) {
  if ((e as DianaDbError).code === 'DURABILITY') {
    // applied, not yet on disk: alert, and retrying is NOT needed
  }
}
```

Validation errors raised by the ODM itself (schema, queries, options) are thrown before anything is sent and carry no `code`.

---

## Cook Book

An end-to-end mini-shop example spanning seven collections — `user`, `userLocation`, `item`, `price`, `storeItem`, `order`, `transaction` — and seven materialized views:

- `currentPrice` — latest price per item
- `inventory` — stock count aware of reserved units
- `balanceActual`, `balancePendingDeposits`, `balancePendingWithdrawals` — three-way balance per user and currency
- `orderToPay`, `orderToShip` — orders joined to user and location via `$lookup`

The flow seeds users, locations, items, prices, stock and deposits, then places an order that reserves store items inside an ACID transaction: if the balance covers the total the order ships immediately, otherwise it stays in `toPay`. `orderToShip` can then be queried by location with spatial operands.

Full walkthrough: <https://diana-db.com/cookbook/shop-example>

---

## Benchmarks

10,000 documents, inserted one at a time and awaited sequentially. Query filters by `name`, sorts by `_id` descending, skips 100 and limits 10. All three servers in Docker on one host.

| Database    | Insert (10,000) | Insert throughput | Query        | Query vs. DianaDB |
| ----------- | --------------- | ----------------- | ------------ | ----------------- |
| **DianaDB** | 5.290 s         | 1,890 docs/s      | **1.959 ms** | baseline          |
| MongoDB     | **1.518 s**     | **6,588 docs/s**  | 16.683 ms    | 8.5× slower       |
| PostgreSQL  | 7.122 s         | 1,404 rows/s      | 7.114 ms     | 3.6× slower       |

MongoDB leads on write throughput; DianaDB sits between MongoDB and PostgreSQL. On the read path the columnar layout shows — the filter on `name` needs no separate index, because the field _is_ the index.

Single run, no warm-up, no repeated runs, no tuning of any engine. Treat it as an order-of-magnitude comparison of an out-of-the-box setup, and run it yourself: [databikers/db-benchmark](https://github.com/databikers/db-benchmark)

---

## Versioning and Changelog

Server and ODM versions are released in step and must be kept compatible.

| Boundary        | Requirement  |
| --------------- | ------------ |
| Server >= 2.0.0 | ODM >= 2.0.0 |
| Server >= 1.7.0 | ODM >= 1.7.0 |

Recent highlights:

- **v4.6.5** — `insertMany`, salted challenge-response authentication (protocol 2), HTTP `/health` and `/metrics`, multi-master replication, strict `server_id`, shorter pauses while snapshots are saved
- **v4.0.0** — vectors
- **v3.3.3** — core optimizations and refactoring
- **v2.5.3** — client-level database management (`createDatabase`, `removeDatabase`, `createCollection`, `removeCollection`), `replaceRoot` in `LookupQuery`, core optimizations
- **v2.2.1** — `getVersion()`
- **v2.1.3 / ODM 2.1.0** — `removeView`, `getViews`, `getCollectionViews`
- **v2.1.2 / ODM 2.0.0** — TLS/mTLS, `local` and `s3` storage strategies, schema locking, document-level transaction locking _(breaking)_
- **v1.9.2** — `getDatabases()`, `getHealth()`
- **v1.9.1** — `uppercase` / `lowercase` string options
- **v1.9.0** — array operators renamed to `$addItem` / `$removeItem`
- **v1.8.3** — `countByView`
- **v1.8.1** — connection string support
- **v1.6.0** — materialized views updating on the fly, access and backup management in the CLI
- **v1.5.0** — `max` / `min` methods and `$max` / `$min` / `$avg` operators
- **v1.4.8** — `distinct` method

Full history: <https://diana-db.com/changes-log>

---

## Roadmap

- **Desktop Management Tool** — GUI for managing your databases
- **Query Language Improvements** — making DiQL more expressive and powerful
- **Golang, PHP, C#, Java clients** — official clients to extend integration across ecosystems
- **Vector index** — approximate nearest-neighbour search for large collections

---

## Reporting Issues

Open an issue at <https://github.com/databikers/diana-db/issues>. Include your server and ODM versions, the schema involved, and a minimal reproduction where possible.

---

## License

**MIT License with Usage Restriction.** Copyright © 2025 Data Bikers Limited.

Permission is granted, free of charge, to use, copy, modify, merge, publish, distribute, sublicense and sell copies of the Software, subject to:

- The copyright notice and this permission notice being included in all copies or substantial portions of the Software.
- **The Software may not be used to create or offer a competing product or service without prior written consent from Data Bikers Limited.**

The Software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and non-infringement.

---

<p align="center">
  <a href="https://diana-db.com">Documentation</a> &middot;
  <a href="https://www.npmjs.com/package/@diana-db/odm">npm</a> &middot;
  <a href="https://github.com/databikers/diana-db">GitHub</a> &middot;
  <a href="https://github.com/databikers/db-benchmark">Benchmark</a> &middot;
  <a href="https://databikers.com">Data Bikers Limited</a>
</p>
