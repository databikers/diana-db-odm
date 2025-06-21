import { Types } from '@const';

type DefaultSetter<T> = () => T;
type DefaultAsyncSetter<T> = () => Promise<T>;

export type FieldDefinition<T> = {
  type: Types;
  items: Exclude<Types, 'ARRAY'>;
  required?: boolean;
  unique?: true;
  mutable?: boolean;
  default?: T | Function;
};
