import { Logger } from '@dto';
import { DianaDb } from '../diana-db';

export type DianaDbOptions = {
  host: string;
  port: number;
  user: string;
  password: string;
  connectionPoolSize: number;
  connectTimeoutValue?: number;
  reconnectTimeout?: number;
  logger?: Logger;
  dianaDb?: DianaDb;
};
