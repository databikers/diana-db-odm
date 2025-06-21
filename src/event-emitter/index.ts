import { EventEmitter } from 'events';
import * as console from 'console';
import { CONNECT_EVENT } from '@const';
import { Model } from '@model';

export const eventEmitter = new EventEmitter();

eventEmitter.once(CONNECT_EVENT, () => {
  Model.init().catch(console.error);
});
