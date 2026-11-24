import { DianaDbOptions, TlsOptions } from './diana-db-options';
import { ConnectionManager } from '@connection';

export type ConnectOptions = Pick<DianaDbOptions, 'user' | 'password' | 'host' | 'port' | 'logger' | 'legacyAuth'> & {
  reconnectTimeoutValue?: number;
  requestGroupId?: string;
  connectionManager?: ConnectionManager;
  isSubscriber?: boolean;
  secureServer?: boolean;
  tls?: TlsOptions;
};
