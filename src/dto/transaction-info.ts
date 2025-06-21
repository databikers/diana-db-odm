import { TransactionStatus } from '@const';

export type TransactionInfo = {
  transactionId: string;
  status: TransactionStatus;
};
