import { Types } from '@const';
import { FieldDefinition } from './field-definition';

export type ReferenceFieldDefinition = Omit<FieldDefinition<string>, 'type' | 'items'> & {
  type: Types.REFERENCE;
  reference: string;
  triggerRemove?: boolean;
};
