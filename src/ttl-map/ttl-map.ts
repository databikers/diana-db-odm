import { PseudoIntervalParameters } from '@parameters';
import { pseudoInterval } from '@helper';

const pseudoIntervalParams: Omit<PseudoIntervalParameters, 'executor'> = {
  isRan: true,
  doExit: false,
  interval: 1000,
};

export class TtlMap {
  private pseudoIntervalParams: PseudoIntervalParameters;
  private ttl: Map<string, number>;
  private data: Map<string, any>;

  constructor() {
    this.ttl = new Map<string, number>();
    this.data = new Map<string, any>();
    this.pseudoIntervalParams = { ...pseudoIntervalParams, executor: async () => this.ttlChecker() };
    pseudoInterval(this.pseudoIntervalParams);
  }

  public get size() {
    return this.data.size;
  }

  private ttlChecker() {
    return new Promise<void>((resolve, reject) => {
      const now = new Date().getTime();
      this.ttl.forEach((value: number, key: string) => {
        if (now >= value) {
          this.delete(key);
        }
      });
      resolve();
    });
  }

  public set(key: string, value: any, ttl?: number) {
    if (typeof ttl === 'number' && ttl > 0) {
      this.ttl.set(key, new Date().getTime() + ttl);
    }
    return this.data.set(key, value);
  }

  public get(key: string) {
    return this.data.get(key);
  }

  public delete(key: string) {
    this.ttl.delete(key);
    return this.data.delete(key);
  }

  public has(key: string) {
    return this.data.has(key);
  }

  public clear() {
    this.ttl.clear();
    return this.data.clear();
  }

  public entries() {
    return this.data.entries();
  }

  public values() {
    return this.data.values();
  }

  public keys() {
    return this.data.keys();
  }

  public forEach(callback: (value: any, key: string) => void) {
    return this.data.forEach(callback);
  }
}
