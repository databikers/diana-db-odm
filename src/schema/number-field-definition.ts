import { Types } from '@const';
import { FieldDefinition } from './field-definition';

export type NumberFieldDefinition = Omit<FieldDefinition<number>, 'type' | 'items'> & {
  type: Types.NUMBER;
  precision: number;
};
