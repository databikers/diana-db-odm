export type ClientRequest = {
  database: string;
  collection: string;
  action: string; // EClientActions;
  requestId: string;
  clientRequestId: string;
  filterQuery?: any[]; //IQuery[];
  aggregationQuery?: any[];
  setData?: any;
  sortQuery?: any;
  skip?: number;
  limit?: number;
  schema?: any; //  ISchema;
  transactionId?: string;
  autoRollbackAfterMS?: number;
};
