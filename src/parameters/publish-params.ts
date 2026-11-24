import { ClientAction } from '@const';

/** What a subscriber receives for every insert, update or remove in a database it can read. */
export type DatabaseUpdate = {
  database: string;
  collection: string;
  action: ClientAction.INSERT | ClientAction.UPDATE | ClientAction.REMOVE | `${ClientAction}`;
  affectedIds: string[];
  /**
   * insert: the inserted document (for insertMany an array of them, left out above 100 documents).
   * update: the update data as it was sent. Not sent for remove.
   */
  data?: any;
};
