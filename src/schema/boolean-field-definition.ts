import { Types } from '@const';
import { FieldDefinition } from './field-definition';

export type BooleanFieldDefinition = Omit<FieldDefinition<boolean>, 'type' | 'items'> & {
  type: Types.BOOLEAN;
};
