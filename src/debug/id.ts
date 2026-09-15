import { createHash } from 'crypto';

/** First 128 bits of SHA-256 over the canonical JSON body. Stable across processes. */
export function artifactIdOf(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 32);
}
