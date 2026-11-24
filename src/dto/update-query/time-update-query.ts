import { UnitOfTime, Weekday } from '@const';
import { OneOf } from './one-of';
import { UpdateTimeHolderItem } from './update-time-holder-item';

export type TimeUpdateQuery = OneOf<{
  $add: UpdateTimeHolderItem;
  $subtract: UpdateTimeHolderItem;
  $toStartOf: UnitOfTime | `${UnitOfTime}`;
  $toEndOf: UnitOfTime | `${UnitOfTime}`;
  $toNextWeekday: Weekday | `${Weekday}`;
  $toLastWeekday: Weekday | `${Weekday}`;
}>;
