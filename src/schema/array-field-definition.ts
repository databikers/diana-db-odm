import { Types } from '@const';
import { FieldDefinition } from './field-definition';

export type ArrayFieldDefinition = Omit<FieldDefinition<any>, 'type' | 'ttl'> & {
  type: Types.ARRAY;
  reference?: string;
  triggerRemove?: boolean;
};
