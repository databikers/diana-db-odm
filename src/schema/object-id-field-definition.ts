import { Types } from '@const';
import { FieldDefinition } from './field-definition';

export type ObjectIdFieldDefinition = Omit<FieldDefinition<string>, 'type' | 'items'> & {
  type: Types.OBJECT_ID;
  reference?: string;
  triggerRemove?: boolean;
};
