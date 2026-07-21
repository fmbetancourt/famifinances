import { createHash } from 'node:crypto';

/** Recursively sorts object keys so logically-equal payloads serialize identically. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    return Object.keys(source)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize(source[key]);
        return acc;
      }, {});
  }
  return value;
}

/**
 * OFF-01 · a stable SHA-256 hex fingerprint of a request payload, independent of
 * object key order. Used to detect an idempotency key reused with different content
 * WITHOUT storing the cleartext amount/note (Principle II).
 */
export function fingerprint(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(payload))).digest('hex');
}
