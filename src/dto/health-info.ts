/** Memory numbers of the server's memory guard, in MB. */
export type MemoryGuardInfo = {
  /** Requests are being refused with a memory error until memory is freed. */
  exhausted: boolean;
  /** Why memory counts as exhausted; empty while it does not. */
  reason: string;
  used: number;
  available: number;
  limit: number;
  heapUsed: number;
  heapLimit: number;
  /** The server's memory_reserve_percent. */
  reservePercent: number;
};

/** The answer of getHealth(). */
export type HealthInfo = Record<'memory' | 'cpu' | 'gcp' | 'elu' | 'eld', number> & {
  /** Reported by servers from 4.1.0 on. */
  memoryGuard?: MemoryGuardInfo;
};
