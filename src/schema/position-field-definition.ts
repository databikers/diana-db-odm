import { Types } from '@const';
import { Point } from '@dto';
import { FieldDefinition } from './field-definition';

export type PositionFieldDefinition = Omit<FieldDefinition<Point>, 'type' | 'items'> & {
  type: Types.POSITION;
};
