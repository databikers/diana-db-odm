import { ClientAction } from '@const';

export type DatabaseUpdate = {
  database: string;
  collection: string;
  action: ClientAction;
  affectedIds: string[];
  data?: any;
};
