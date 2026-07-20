import * as argon2 from 'argon2';

/**
 * Centralized, tunable security parameters (constitution Principle II; research
 * R1/R3/R4). Kept in one place so the hardening pass has a single source of truth.
 */

// Lighter cost under NODE_ENV=test so the parallel e2e suite (many argon2 hashes
// at once) does not saturate CPU and flake; production keeps the OWASP baseline.
const IS_TEST = process.env.NODE_ENV === 'test';

/** argon2id options for hashing low-entropy secrets (passwords, OTP codes). */
export const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: IS_TEST ? 8192 : 19456, // 8 MiB in tests, 19 MiB in prod
  timeCost: 2, // argon2 minimum is 2
  parallelism: 1,
};

/** Per-account sign-in lockout (FR-013). */
export const LOGIN_LOCKOUT = {
  maxFailedAttempts: 5,
  lockWindowMs: 15 * 60 * 1000,
} as const;

/** One-time code policy (FR-020, FR-023, FR-027). */
export const OTP_POLICY = {
  length: 6,
  maxAttempts: 5,
} as const;

/** Global baseline rate limit (FR-013, FR-026). */
export const THROTTLE = {
  ttlMs: 60_000,
  limit: 30,
} as const;

/**
 * SEC-01 · stricter per-IP rate limit for credential endpoints (SEC FR-004), layered
 * on top of the global THROTTLE and the per-account LOGIN_LOCKOUT. Read from the
 * environment (secure defaults) so it is tunable without a code change (SEC FR-010).
 */
export const AUTH_THROTTLE = {
  limit: Number(process.env.AUTH_RATE_LIMIT ?? 5),
  ttlMs: Number(process.env.AUTH_RATE_TTL_MS ?? 60_000),
} as const;

/** SEC-01 · parsed CORS origin allowlist; empty ⇒ deny all cross-origin browser access (SEC FR-002). */
export const CORS_ALLOWED_ORIGINS: string[] = (process.env.CORS_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

/** SEC-01 · max JSON request body size (SEC FR-003). */
export const BODY_LIMIT = process.env.REQUEST_BODY_LIMIT ?? '100kb';

/**
 * SEC-01 · helmet options for global security headers (SEC FR-001). HSTS with a
 * ~180-day max-age, frameguard DENY, nosniff, no-referrer, `X-Powered-By` hidden.
 * The Content-Security-Policy is disabled here because the API serves JSON (and the
 * Swagger UI at /api/docs), not first-party HTML that a CSP would protect.
 */
export const SECURITY_HEADERS = {
  hsts: { maxAge: 15_552_000, includeSubDomains: true },
  frameguard: { action: 'deny' as const },
  referrerPolicy: { policy: 'no-referrer' as const },
  contentSecurityPolicy: false as const,
} as const;
