import { Request } from '@dto';
import { Processor } from '../dto/processor';
import { ConnectionManager } from '@connection';
import { eventKeyHelper, randomId } from '@helper';
import { eventEmitter } from '@event-emitter';
import { DianaDbErrorCode, ErrorFactory } from '@error';
import { DatabaseUpdate, ServerResponse } from '@parameters';
import { DEFAULT_REQUEST_TIMEOUT_VALUE, ServerAction } from '@const';
import { TtlMap } from '@ttl-map';

export class ProcessController implements Processor<any> {
  private timeouts: Map<string, ReturnType<typeof setTimeout>>;
  private ttlMap: TtlMap;
  private connectionManager: ConnectionManager;
  private readonly defaultTimeoutValue: number;
  /** Set by the owning DianaDb instance; receives each published database update once. */
  public onPublish: (databaseUpdate: DatabaseUpdate) => void;
  /** The controller of the most recently constructed DianaDb; used by models created without `dianaDb`. */
  static instance: ProcessController;

  constructor(connectionManager: ConnectionManager, defaultTimeoutValue?: number) {
    this.timeouts = new Map<string, ReturnType<typeof setTimeout>>();
    this.ttlMap = new TtlMap();
    this.connectionManager = connectionManager;
    this.defaultTimeoutValue = defaultTimeoutValue || DEFAULT_REQUEST_TIMEOUT_VALUE;
    ProcessController.instance = this;
  }

  /** Sends a request and resolves with the full server response, or rejects with a coded Error. */
  public request<T = any>(request: Partial<Request<any>>): Promise<ServerResponse<T>> {
    const clientRequestId: string = randomId();
    request.clientRequestId = clientRequestId;
    if (!request.timeoutValue) {
      request.timeoutValue = this.defaultTimeoutValue;
    }
    const responseKey: string = eventKeyHelper(clientRequestId, 'response');
    const errorKey: string = eventKeyHelper(clientRequestId, 'error');
    return new Promise<ServerResponse<T>>((resolve, reject) => {
      eventEmitter.once(responseKey, (response: ServerResponse<T>) => {
        eventEmitter.removeAllListeners(errorKey);
        resolve(response);
      });
      eventEmitter.once(errorKey, (error: Error) => {
        eventEmitter.removeAllListeners(responseKey);
        reject(error);
      });
      this.processRequest(request as Request<any>).catch((error: Error) => {
        eventEmitter.removeAllListeners(responseKey);
        eventEmitter.removeAllListeners(errorKey);
        reject(error);
      });
    });
  }

  /** Dispatches the request. Rejects only if it cannot be sent at all; timeouts arrive through the error event. */
  public async processRequest(request: Request<any>): Promise<void> {
    const { clientRequestId } = request;
    this.timeouts.set(
      clientRequestId,
      setTimeout(() => {
        this.connectionManager.dropQueued(clientRequestId);
        this.failRequest(clientRequestId, `request failed by timeout ${request.timeoutValue} ms`, 'TIMEOUT');
      }, request.timeoutValue),
    );
    try {
      this.connectionManager.send(request);
    } catch (error) {
      clearTimeout(this.timeouts.get(clientRequestId));
      this.timeouts.delete(clientRequestId);
      throw error;
    }
  }

  /** Rejects a pending request without waiting for its timeout. */
  public failRequest(clientRequestId: string, message: string, code: DianaDbErrorCode): void {
    if (!this.timeouts.has(clientRequestId)) {
      return;
    }
    clearTimeout(this.timeouts.get(clientRequestId));
    this.timeouts.delete(clientRequestId);
    const error: Error =
      code === 'TIMEOUT' ? ErrorFactory.timeoutError(message) : ErrorFactory.connectionError(message);
    eventEmitter.emit(eventKeyHelper(clientRequestId, 'error'), error);
  }

  public async processResponse(response: ServerResponse<any>) {
    const { clientRequestId, action } = response;
    if (action === ServerAction.RESPONSE) {
      if (!this.timeouts.has(clientRequestId)) {
        // Late answer to a request that already timed out or failed.
        return;
      }
      clearTimeout(this.timeouts.get(clientRequestId));
      this.timeouts.delete(clientRequestId);
      const hasError: boolean = Object.prototype.hasOwnProperty.call(response, 'error');
      if (hasError) {
        eventEmitter.emit(eventKeyHelper(clientRequestId, 'error'), ErrorFactory.serverError(String(response.error)));
      } else {
        eventEmitter.emit(eventKeyHelper(clientRequestId, 'response'), response);
      }
    } else if (action === ServerAction.PUBLISH) {
      const { requestId } = response;
      if (!this.ttlMap.has(requestId)) {
        this.ttlMap.set(requestId, 1, 10000);
        this.onPublish?.(response.data as unknown as DatabaseUpdate);
      }
    }
  }
}
