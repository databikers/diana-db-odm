// Compiled by "npm run test:types": this file must type-check, and the lines marked @ts-expect-error must not.
import { DianaDb, Model, Schema, Types } from '../../dist';

type User = { name: string; age: number; tags: string[]; seenAt: string };

const schema: Schema<User> = {
  name: { type: Types.STRING },
  age: { type: Types.NUMBER },
  tags: { type: Types.ARRAY, items: Types.STRING },
  seenAt: { type: Types.TIME },
};

export async function usage(dianaDb: DianaDb): Promise<void> {
  const users = new Model<User>({ database: 'app', collection: 'user', name: 'User', schema, dianaDb });

  // an update names the fields it changes, with values or operators
  await users.update([{ name: 'John' }], { age: 31 });
  await users.update([{ name: 'John' }], { age: { $add: 1 }, tags: { $addItem: 'x' } });
  await users.update([{}], { seenAt: { $add: { amount: 1, unit: 'day' } } });
  // @ts-expect-error a value of another type
  await users.update([{}], { age: 'old' });
  // @ts-expect-error a field that is not in the document type
  await users.update([{}], { unknown: 1 });

  // sorting: any subset of the fields, and _id
  await users.find([{}], undefined, { age: -1 });
  await users.find([{}], undefined, { _id: 1 });
  await users.find([{}], undefined, { age: 1, name: -1 });
  // @ts-expect-error a direction other than 1 or -1
  await users.find([{}], undefined, { age: 2 });
  // @ts-expect-error a field that is not in the document type
  await users.find([{}], undefined, { unknown: 1 });
}
