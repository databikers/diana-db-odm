import { Schema } from '@schema';
import { DianaDb } from '../diana-db';

export type ModelOptions<T> = {
  database: string;
  collection: string;
  name: string;
  schema: Schema<T>;
  /** Client this model sends its requests through. Defaults to the DianaDb most recently constructed before the model. */
  dianaDb?: DianaDb;
};
