import { FindQuery } from '../find-query/find-query';
import { Sorting } from '../sorting';

export type LookupQuery<T> = {
  collection: string;
  database: string;
  as: string;
  localField: keyof T | '_id';
  foreignField: string;
  filter: FindQuery<T>;
  sort: Sorting<T>;
  skip: number;
  limit: number;
};
