import { OneOf } from './one-of';

export type ArrayUpdateQuery = OneOf<{
  $addItem: any;
  $removeItem: any;
}>;
