import { FindQuery } from '../find-query/find-query';
import { Sorting } from '../sorting';
import { GroupQuery } from './group-query';
import { LookupQuery } from './lookup-query';
import { ProjectQuery } from './project-query';

export type TransformQuery<L> = {
  $match?: FindQuery<L>;
  $group?: GroupQuery<L>;
  $lookup?: LookupQuery<L, any>;
  $project?: ProjectQuery<L>;
  $unwind?: string;
  $replaceRoot?: keyof L;
  $sort?: Sorting<L>;
  $skip?: number;
  $limit?: number;
};
