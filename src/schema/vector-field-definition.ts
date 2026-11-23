import { Types } from '@const';
import { FieldDefinition } from './field-definition';

export type VectorFieldDefinition = Omit<FieldDefinition<number[]>, 'type' | 'items'> & {
  type: Types.VECTOR;
  /** Length of every vector stored in the field, 1-65536. Can't change while the field holds vectors. */
  dimensions: number;
};
