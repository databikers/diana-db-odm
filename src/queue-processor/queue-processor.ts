import { pseudoInterval } from '@helper';
import { PseudoIntervalParameters } from '@parameters';
import { Connection, ConnectionManager } from '@connection';
import { Queue } from './queue';

export class QueueProcessor<T> {
  public pseudoIntervalParams: PseudoIntervalParameters;

  constructor(queueProcessorOptions: {
    queue: Queue<T>;
    connectionManager: ConnectionManager;
    processor: (item: T, connection: Connection) => void;
  }) {
    const { queue } = queueProcessorOptions;
    this.pseudoIntervalParams = {
      executor: async () => {
        const item: T = queue.dequeue();
        if (item) {
          const connection = queueProcessorOptions.connectionManager.connection;
          if (connection) {
            queueProcessorOptions.processor(item, connection);
          } else {
            queueProcessorOptions.queue.enqueue(item);
          }
        }
      },
      isRan: true,
      doExit: false,
      interval: 0,
    };
    pseudoInterval(this.pseudoIntervalParams);
  }

  public stopProcessing() {
    this.pseudoIntervalParams.isRan = false;
    this.pseudoIntervalParams.doExit = true;
  }
}
