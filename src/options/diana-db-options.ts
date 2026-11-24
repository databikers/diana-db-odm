import { Logger } from '@dto';
import { DianaDb } from '../diana-db';

type PemInput = string | Buffer;

export type TlsOptions = {
  /** Client certificate, for servers that verify clients (mTLS). */
  cert?: PemInput;
  key?: PemInput;
  /** CA that signed the server certificate. */
  ca?: PemInput | PemInput[];
  /** Verify the server certificate. Defaults to false, so self-signed servers work out of the box. */
  rejectUnauthorized?: boolean;
  /** Name checked against the server certificate. Defaults to `host` when it is not an IP address. */
  servername?: string;
};

export type DianaDbOptions = {
  host: string;
  /** Defaults to 34567. */
  port?: number;
  user: string;
  password: string;
  /** Defaults to 5. */
  connectionPoolSize?: number;
  connectTimeoutValue?: number;
  reconnectTimeoutValue?: number;
  /** Default timeout of every request, in ms. Defaults to 30000. */
  requestTimeoutValue?: number;
  /** Database used by migrateUp/migrateDown when they are called without one. */
  database?: string;
  logger?: Logger;
  dianaDb?: DianaDb;
  secureServer?: boolean;
  tls?: TlsOptions;
  /**
   * Allow servers older than 4.1, which only know authentication protocol 1 (password hash used as the key, no
   * salt). Default true: the client tries protocol 2 and falls back. Set false once every server is 4.1 or newer,
   * so the client never downgrades.
   */
  legacyAuth?: boolean;
};
