import { Connection } from '@connection';

export interface Processor<T> {
  processRequest(item: T, connection: Connection, timeoutValue: number): void;
}
