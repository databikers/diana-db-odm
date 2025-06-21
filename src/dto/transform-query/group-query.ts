import { ProjectQuery } from './project-query';

export type GroupQuery<T> = {
  _id: string;
} & ProjectQuery<T>;
