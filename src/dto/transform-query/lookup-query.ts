import { FindQuery } from '../find-query';
import { Sorting } from '../sorting';

export type LookupQuery<L, F> = {
  collection: string;
  database: string;
  as: string;
  localField: keyof L | '_id';
  foreignField: keyof F | '_id';
  replaceRoot: string;
  filter: FindQuery<F>;
  sort: Sorting<F>;
  skip: number;
  limit: number;
};
