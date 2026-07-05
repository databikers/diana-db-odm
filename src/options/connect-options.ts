import { DianaDbOptions } from './diana-db-options';
import { ConnectionManager } from '@connection';

export type ConnectOptions = Pick<DianaDbOptions, 'user' | 'password' | 'host' | 'port' | 'logger'> & {
  reconnectTimeoutValue?: number;
  requestGroupId?: string;
  connectionManager?: ConnectionManager;
  isSubscriber?: boolean;
  secureServer?: boolean;
  tls?: {
    cert: Buffer;
    key: Buffer;
    ca?: Buffer;
    rejectUnauthorized?: boolean;
  };
};
