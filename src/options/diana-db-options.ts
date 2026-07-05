import { Logger } from '@dto';
import { DianaDb } from '../diana-db';

export type DianaDbOptions = {
  host: string;
  port: number;
  user: string;
  password: string;
  connectionPoolSize: number;
  connectTimeoutValue?: number;
  reconnectTimeoutValue?: number;
  logger?: Logger;
  dianaDb?: DianaDb;
  secureServer?: boolean;
  tls?: {
    cert: Buffer;
    key: Buffer;
    ca?: Buffer;
    rejectUnauthorized?: boolean;
  };
};
