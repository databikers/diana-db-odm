import { ServerAction } from '@const';

export type ServerResponse<T> = {
  socket: string;
  requestId: string;
  clientRequestId: string;
  transactionId: string;
  operationTime: number;
  action: ServerAction;
  error?: string;
  data?: T[];
  found?: number;
  modified?: number;
  removed?: number;
};
