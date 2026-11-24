import { URL } from 'url';
import { DianaDbOptions } from '@options';
import {
  DEFAULT_CONNECT_TIMEOUT_VALUE,
  DEFAULT_CONNECTION_PULL_SIZE,
  DEFAULT_RECONNECT_TIMEOUT_VALUE,
  DEFAULT_REQUEST_TIMEOUT_VALUE,
  DEFAULT_SERVER_PORT,
} from '@const';

/**
 * diana-db://user:password@host:port/database?connectionPoolSize=5&connectTimeoutValue=30000
 * diana-dbs://... sets secureServer: true. The optional path is the default database for migrations.
 */
export function parseConnectionString(connectionString: string): DianaDbOptions {
  const connectionData = new URL(connectionString);
  const secureServer = connectionString.startsWith('diana-dbs://');
  const params = connectionData.searchParams;
  const integer = (name: string, fallback: number): number => {
    const value: string | null = params.get(name);
    return value === null || value === '' ? fallback : parseInt(value, 10);
  };
  const database: string = decodeURIComponent(connectionData.pathname.replace(/^\/+/, ''));
  const options: DianaDbOptions = {
    user: decodeURIComponent(connectionData.username),
    password: decodeURIComponent(connectionData.password),
    host: connectionData.hostname,
    port: parseInt(connectionData.port, 10) || DEFAULT_SERVER_PORT,
    connectionPoolSize: integer('connectionPoolSize', DEFAULT_CONNECTION_PULL_SIZE),
    connectTimeoutValue: integer('connectTimeoutValue', DEFAULT_CONNECT_TIMEOUT_VALUE),
    reconnectTimeoutValue: integer('reconnectTimeoutValue', DEFAULT_RECONNECT_TIMEOUT_VALUE),
    requestTimeoutValue: integer('requestTimeoutValue', DEFAULT_REQUEST_TIMEOUT_VALUE),
    secureServer,
  };
  if (database) {
    options.database = database;
  }
  if (params.has('legacyAuth')) {
    options.legacyAuth = params.get('legacyAuth') !== 'false';
  }
  if (secureServer && params.has('rejectUnauthorized')) {
    options.tls = { rejectUnauthorized: params.get('rejectUnauthorized') === 'true' };
  }
  return options;
}
