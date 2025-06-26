import { DianaDbOptions } from './diana-db-options';
import { ConnectionManager } from '@connection';

export type ConnectOptions = Pick<DianaDbOptions, 'user' | 'password' | 'host' | 'port' | 'logger'> & {
  reconnectTimeout: number;
  requestGroupId: string;
  connectionManager: ConnectionManager;
};
