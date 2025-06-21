import { Types } from '@const';
import { FieldDefinition } from './field-definition';

export type StringFieldDefinition = Omit<FieldDefinition<string>, 'type' | 'items'> & {
  type: Types.STRING;
};
