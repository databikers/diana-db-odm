import { FindQuery, QueryOperands } from '@dto';

export type ReferenceQuery<T> = Pick<QueryOperands<boolean>, '$eq' | '$ne' | '$in' | '$nin'> & {
  $subQuery: FindQuery<T>;
};
