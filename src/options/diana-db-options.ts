import { Logger } from '@dto';

export type DianaDbOptions = {
  host: string;
  port: number;
  user: string;
  password: string;
  connectionPoolSize: number;
  connectTimeoutValue?: number;
  logger?: Logger;
};
