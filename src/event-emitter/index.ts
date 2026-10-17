import { EventEmitter } from 'events';

// Carries per-request "<clientRequestId>:response|error" events. Every key is unique, so instances can share it.
export const eventEmitter = new EventEmitter();
eventEmitter.setMaxListeners(0);
