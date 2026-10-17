import { Types } from '@const';
import { FieldDefinition } from './field-definition';

export type NumberFieldDefinition = Omit<FieldDefinition<number>, 'type' | 'items'> & {
  type: Types.NUMBER;
  /**
   * Decimal places kept, 0–8. Optional: without it the value is stored as given, unrounded.
   * Set it for money-like values, where 0.1 + 0.2 should be stored as 0.3.
   */
  precision?: number;
};
