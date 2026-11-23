import { PositionFindQuery } from './position-find-query';
import { TimeFindQuery } from './time-find-query';
import { BooleanFindQuery } from './boolean-find-query';
import { StringFindQuery } from './string-find-query';
import { NumberFindQuery } from './number-find-query';
import { VectorFindQuery } from './vector-find-query';

export type FindQuery<T> = Partial<
  Record<
    keyof T,
    | BooleanFindQuery
    | StringFindQuery
    | NumberFindQuery
    | TimeFindQuery
    | PositionFindQuery
    | VectorFindQuery
    | T[keyof T]
    | { $subQuery: FindQuery<any> }
  >
>;
