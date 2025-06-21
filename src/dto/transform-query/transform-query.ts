import { FindQuery } from '../find-query/find-query';
import { Sorting } from '../sorting';
import { GroupQuery } from './group-query';
import { LookupQuery } from './lookup-query';
import { ProjectQuery } from './project-query';

export type TransformQuery<T> = {
  $match?: FindQuery<T>;
  $group?: GroupQuery<T>;
  $lookup?: LookupQuery<T>;
  $project?: ProjectQuery<T>;
  $unwind?: keyof T;
  $replaceRoot?: keyof T;
  $sort?: Sorting<T>;
  $skip?: number;
  $limit?: number;
};
