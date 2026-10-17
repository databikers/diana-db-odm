import { ClientAction } from '@const';

/** What a subscriber receives for every insert, update or remove in a database it can read. */
export type DatabaseUpdate = {
  database: string;
  collection: string;
  action: ClientAction.INSERT | ClientAction.UPDATE | ClientAction.REMOVE | `${ClientAction}`;
  affectedIds: string[];
  /** Document snapshot, sent for inserts and updates. */
  data?: any;
};
