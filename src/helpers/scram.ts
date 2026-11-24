import { createHash, createHmac, hkdfSync, randomBytes, scrypt } from 'crypto';

/**
 * Client side of authentication protocol 2 (server 4.6.5+). The server's helpers/scram describes the scheme:
 * the password never leaves the client, the server proves it knows the user's record, and every connection
 * encrypts with its own session key.
 */
export const NONCE_BYTES: number = 24;
const SESSION_INFO: string = 'diana-db session 2';
// Largest work factor accepted from a server: protects the client from a server asking for absurd memory.
const MAX_N: number = 1 << 20;
const MAX_R: number = 32;
const MAX_P: number = 16;

export interface Challenge {
  salt: string;
  n: number;
  r: number;
  p: number;
  serverNonce: string;
}

const CHALLENGE_REGEXP: RegExp = /^challenge:2:([A-Za-z0-9+/=]+):(\d+):(\d+):(\d+):([A-Za-z0-9+/=]+)$/;

export function parseChallenge(line: string): Challenge | undefined {
  const match: RegExpMatchArray | null = line.match(CHALLENGE_REGEXP);
  if (!match) {
    return;
  }
  const [
    n,
    r,
    p,
  ] = [
    match[2],
    match[3],
    match[4],
  ].map(Number);
  if (n < 2 || n > MAX_N || (n & (n - 1)) !== 0 || r < 1 || r > MAX_R || p < 1 || p > MAX_P) {
    return;
  }
  return { salt: match[1], n, r, p, serverNonce: match[5] };
}

export function clientNonce(): string {
  return randomBytes(NONCE_BYTES).toString('base64');
}

// scrypt results per password and salt: a pool opens several connections and reconnects often, and the server
// keeps the same salt per user, so the expensive step runs once per process.
const saltedCache: Map<string, Promise<Buffer>> = new Map<string, Promise<Buffer>>();

function salted(password: string, challenge: Challenge): Promise<Buffer> {
  const passwordHash: Buffer = createHash('sha256').update(password).digest();
  const cacheKey: string = createHash('sha256')
    .update(passwordHash)
    .update(`:${challenge.salt}:${challenge.n}:${challenge.r}:${challenge.p}`)
    .digest('base64');
  if (!saltedCache.has(cacheKey)) {
    const { n, r, p } = challenge;
    const result: Promise<Buffer> = new Promise<Buffer>((resolve, reject) => {
      scrypt(
        passwordHash,
        Buffer.from(challenge.salt, 'base64'),
        32,
        { N: n, r, p, maxmem: 256 * n * r },
        (error: Error | null, key: Buffer) => (error ? reject(error) : resolve(key)),
      );
    });
    result.catch(() => saltedCache.delete(cacheKey));
    saltedCache.set(cacheKey, result);
  }
  return saltedCache.get(cacheKey);
}

export interface Proof {
  proof: string;
  expectedSignature: string;
  key: Buffer;
}

/** The proof to send, the server signature to expect, and the session key once the server accepts. */
export async function prove(user: string, password: string, nonce: string, challenge: Challenge): Promise<Proof> {
  const saltedPassword: Buffer = await salted(password, challenge);
  const clientKey: Buffer = createHmac('sha256', saltedPassword).update('Client Key').digest();
  const storedKey: Buffer = createHash('sha256').update(clientKey).digest();
  const serverKey: Buffer = createHmac('sha256', saltedPassword).update('Server Key').digest();
  const message: string = `${user},${nonce},${challenge.serverNonce},${challenge.salt}`;
  const signature: Buffer = createHmac('sha256', storedKey).update(message).digest();
  const proof: Buffer = Buffer.alloc(clientKey.length);
  for (let i = 0; i < clientKey.length; i = i + 1) {
    proof[i] = clientKey[i] ^ signature[i];
  }
  const sessionSalt: Buffer = Buffer.concat([
    Buffer.from(nonce, 'base64'),
    Buffer.from(challenge.serverNonce, 'base64'),
  ]);
  return {
    proof: proof.toString('base64'),
    expectedSignature: createHmac('sha256', serverKey).update(message).digest('base64'),
    key: Buffer.from(hkdfSync('sha256', clientKey, sessionSalt, SESSION_INFO, 32)),
  };
}
