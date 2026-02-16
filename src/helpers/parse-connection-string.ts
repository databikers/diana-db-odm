import { URL } from 'url';
import { DianaDbOptions } from '@options';
import {
  DEFAULT_CONNECT_TIMEOUT_VALUE,
  DEFAULT_CONNECTION_PULL_SIZE,
  DEFAULT_RECONNECT_TIMEOUT_VALUE,
  DEFAULT_SERVER_PORT,
} from '@const';

export function parseConnectionString(connectionString: string): DianaDbOptions {
  const connectionData = new URL(connectionString);
  const { connectionPoolSize, connectTimeoutValue, reconnectTimeoutValue } = connectionData.searchParams as any;
  return {
    user: connectionData.username,
    password: connectionData.password,
    host: connectionData.hostname,
    port: parseInt(connectionData.port) || DEFAULT_SERVER_PORT,
    connectionPoolSize: connectionPoolSize ? parseInt(connectionPoolSize) : DEFAULT_CONNECTION_PULL_SIZE,
    connectTimeoutValue: connectTimeoutValue ? parseInt(connectTimeoutValue) : DEFAULT_CONNECT_TIMEOUT_VALUE,
    reconnectTimeoutValue: reconnectTimeoutValue ? parseInt(reconnectTimeoutValue) : DEFAULT_RECONNECT_TIMEOUT_VALUE,
  };
}
