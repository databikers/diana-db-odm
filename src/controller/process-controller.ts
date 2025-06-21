import { Request } from '@dto';
import { Processor } from '../dto/processor';
import { Connection } from '@connection';
import { eventKeyHelper } from '@helper';
import { eventEmitter } from '@vent-emitter';
import { ErrorFactory } from '@error';
import { ServerResponse } from '@parameters';
import { ServerAction } from '@const';
import { TtlMap } from '@ttl-map';

export class ProcessController implements Processor<any> {
  private timeouts: Map<string, any>;
  private ttlMap: TtlMap;

  constructor() {
    this.timeouts = new Map<string, any>();
    this.ttlMap = new TtlMap();
  }

  public async processRequest(request: Request<any>, connection: Connection) {
    const { clientRequestId, action } = request;
    const responseKey = eventKeyHelper(clientRequestId, 'response');
    const errorKey = eventKeyHelper(clientRequestId, 'error');
    return new Promise((resolve, reject) => {
      this.timeouts.set(
        clientRequestId,
        setTimeout(() => {
          reject(ErrorFactory.requestError(`Request failed by timeout ${request.timeoutValue} ms`));
          eventEmitter.removeAllListeners(responseKey);
          eventEmitter.removeAllListeners(errorKey);
        }, request.timeoutValue),
      );
      connection.makeRequest(request);
    });
  }

  public async processResponse(response: ServerResponse<any>) {
    const { clientRequestId, action } = response;
    const responseKey = eventKeyHelper(clientRequestId, 'response');
    const errorKey = eventKeyHelper(clientRequestId, 'error');
    if (action === ServerAction.RESPONSE) {
      const hasError: boolean = Object.prototype.hasOwnProperty.apply(response, ['error']);
      if (hasError) {
        eventEmitter.emit(errorKey, response.error);
      } else {
        eventEmitter.emit(responseKey, response);
      }
      clearTimeout(this.timeouts.get(clientRequestId));
      this.timeouts.delete(clientRequestId);
    } else if (action === ServerAction.PUBLISH) {
      const { requestId } = response;
      if (!this.ttlMap.has(requestId)) {
        this.ttlMap.set(requestId, 1, 5000);
        eventEmitter.emit(ServerAction.PUBLISH, response);
      }
    }
  }
}

export const processController = new ProcessController();
