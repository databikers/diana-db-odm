import { Types } from '@const';
import { FieldDefinition } from './field-definition';

export type TimeFieldDefinition = Omit<FieldDefinition<number>, 'type' | 'items'> & {
  type: Types.TIME;
  ttl?: number;
};
