import { Schema } from '@schema';

export interface ValidatorOptions<T> {
  name: string;
  schema: Schema<T>;
}
