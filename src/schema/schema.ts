import { StringFieldDefinition } from './string-field-definition';
import { BooleanFieldDefinition } from './boolean-field-definition';
import { ReferenceFieldDefinition } from './reference-field-definition';
import { ObjectIdFieldDefinition } from './object-id-field-definition';
import { ArrayFieldDefinition } from './array-field-definition';
import { NumberFieldDefinition } from './number-field-definition';
import { PositionFieldDefinition } from './position-field-definition';
import { TimeFieldDefinition } from './time-field-definition';

export type SchemaItem =
  | BooleanFieldDefinition
  | StringFieldDefinition
  | ReferenceFieldDefinition
  | ObjectIdFieldDefinition
  | ArrayFieldDefinition
  | NumberFieldDefinition
  | PositionFieldDefinition
  | TimeFieldDefinition;

export interface Schema<T extends Record<string, any>> {
  _id?: ObjectIdFieldDefinition;
  [key: string]: SchemaItem;
}
