import { ClientAction, ServerAction } from '@const';
import { Schema } from '@schema';

export interface IInfo {
  database: string;
  collection: string;
  action: ClientAction;
  schema?: Schema<any>;
  affectedId?: string[];
  updatedFields?: { [key: string]: any };
}

export interface Response {
  socket: string;
  requestId?: string;
  executionTime?: number;
  action: ServerAction;
  error?: string;
  data?: any | any[];
  info?: IInfo;
  found?: number;
  modified?: number;
  removed?: number;
}
