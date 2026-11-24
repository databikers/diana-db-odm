import { OneOf } from './one-of';

export type NumberUpdateQuery = OneOf<{
  $add: number | string;
  $subtract: number | string;
  $multiply: number | string;
  $divide: number | string;
  /** decimal places, 0 to 8 */
  $round: number;
}>;
