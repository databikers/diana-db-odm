import { DianaDbOptions } from './diana-db-options';

export type ConnectOptions = Pick<DianaDbOptions, 'user' | 'password' | 'host' | 'port' | 'logger'> & {
  reconnectTimeout: number;
  requestGroupId: string;
};
