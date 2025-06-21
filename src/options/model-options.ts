import { Schema } from '@schema';

export type ModelOptions<T> = {
  database: string;
  collection: string;
  name: string;
  schema: Schema<T>;
};
