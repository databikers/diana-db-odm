import { ClientAction } from '@const';

export type SubscriptionData = {
  database: string;
  collection: string;
  action: ClientAction;
  affectedIds: string[];
};
