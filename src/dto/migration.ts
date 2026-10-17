import { MigrationStatus } from '@const';

export interface Migration {
  name: string;
  index: number;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

/** What the server answers to migrateUp / migrateDown: `{ migration: { name, status } }`. */
export type MigrationInfo = {
  name: string;
  status: MigrationStatus;
};
