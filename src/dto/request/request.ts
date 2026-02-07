import { ClientAction } from '@const';
import { Schema } from '@schema';
import { FindQuery } from '../find-query';
import { TransformQuery } from '../transform-query';

export interface Request<T> {
  user?: string;
  database?: string;
  collection?: string;
  view?: string;
  clientRequestId?: string;
  requestGroupId?: string;
  action: ClientAction;
  filterQueries?: FindQuery<T>[];
  transformQueries?: TransformQuery<T>[];
  setData?: any;
  sortQuery?: any;
  skip?: number;
  limit?: number;
  schema?: Schema<any>;
  transactionId?: string;
  autoRollbackAfterMS?: number;
  migration?: number;
  timeoutValue?: number;
  distinctKey?: string;
}
