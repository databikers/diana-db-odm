import { Request } from '@dto';
import { ServerResponse } from '@parameters';

export class Queue<T> {
  private data: T[];
  constructor() {
    this.data = [];
  }

  get size() {
    return this.data.length;
  }

  enqueue(item: T): number {
    return this.data.push(item);
  }

  dequeue(): T {
    return this.data.shift();
  }
}

export const requestQueue = new Queue<Request<any>>();
export const responseQueue = new Queue<ServerResponse<any>>();
