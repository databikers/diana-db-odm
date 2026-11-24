import { ArrayUpdateQuery } from './array-update-query';
import { NumberUpdateQuery } from './number-update-query';
import { StringUpdateQuery } from './string-update-query';
import { TimeUpdateQuery } from './time-update-query';

/** Any subset of the fields: each a new value or an update operator. */
export type UpdateData<T extends Object> = {
  [K in keyof T]?: ArrayUpdateQuery | TimeUpdateQuery | NumberUpdateQuery | StringUpdateQuery | T[K];
};
