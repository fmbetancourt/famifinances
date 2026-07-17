/**
 * Keys whose values must never appear in logs, error reports, or analytics
 * (constitution Principle II; FR-015, FR-027). Monetary fields are included
 * defensively even though this feature has none.
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'newpassword',
  'passwordhash',
  'code',
  'codehash',
  'accesstoken',
  'refreshtoken',
  'token',
  'authorization',
  'tokenhash',
  'amount',
  'balance',
]);

const REDACTED = '[REDACTED]';

/** Returns a deep copy of `value` with sensitive fields replaced by a marker. */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redact(item));
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(source)) {
      output[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? REDACTED : redact(val);
    }
    return output;
  }
  return value;
}
