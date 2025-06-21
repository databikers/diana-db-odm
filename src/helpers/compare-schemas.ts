import { Schema, SchemaItem } from '@schema';

export function compareSchemas<T>(schemaA: Schema<T>, schemaB: Schema<T>): boolean {
  return hasDifference(schemaA, schemaB) || hasDifference(schemaB, schemaA);
}

export function hasDifference<T>(schemaA: Schema<T>, schemaB: Schema<T>): boolean {
  for (const key of Object.keys(schemaA)) {
    if (key === '_id') {
      continue;
    }
    const aField = schemaA[key];
    const bField = schemaB[key];
    if (!bField) {
      return true;
    }
    for (const prop of Object.keys(aField)) {
      if (prop === 'default') {
        continue;
      }
      if (!(prop in bField) || aField[prop as keyof SchemaItem] !== bField[prop as keyof SchemaItem]) {
        return true;
      }
    }
    for (const prop of Object.keys(bField)) {
      if ((prop as keyof SchemaItem) === 'default') {
        continue;
      }
      if (!(prop in aField) || bField[prop as keyof SchemaItem] !== aField[prop as keyof SchemaItem]) {
        return true;
      }
    }
  }
  return false;
}
