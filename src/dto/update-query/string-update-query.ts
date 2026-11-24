import { OneOf } from './one-of';

export type StringUpdateQuery = OneOf<{
  $concat: {
    delimiter: string;
    parts: string[];
  };
  /** [search, replacement, RegExp flags] */
  $replace: string[];
}>;
