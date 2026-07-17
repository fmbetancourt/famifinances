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
