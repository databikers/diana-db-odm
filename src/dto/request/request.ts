import { ClientAction } from '@const';
import { FindQuery } from '../find-query';
import { Schema } from '@schema';
import { TransformQuery } from '../transform-query';

export interface Request<T> {
  user?: string;
  database?: string;
  collection?: string;
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
}
