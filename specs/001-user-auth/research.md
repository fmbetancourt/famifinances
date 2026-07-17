# Phase 0 Research: AUTH-01

**Feature**: User Authentication & Access Control
**Date**: 2026-07-16

This document resolves the technical unknowns implied by the spec and the constitution's mandates
(robust password hashing, short-lived tokens with secure renewal, rate limiting, no secrets in logs).
Each decision uses a hexagonal port so infrastructure can change without touching domain logic
(Principle V/VI).

## R1 · Password hashing algorithm

- **Decision**: **argon2id** via the `argon2` library, with per-hash random salt and tuned
  memory/time cost (baseline: 19 MiB, time cost 2, parallelism 1; re-tuned during hardening).
- **Rationale**: argon2id is the current OWASP first-choice password hash, resistant to GPU and
  side-channel attacks; it satisfies the constitution's "robust hash" requirement better than
  bcrypt's 72-byte truncation and fixed memory profile.
- **Alternatives considered**: bcrypt (mature, but weaker memory-hardness and input truncation);
  scrypt (fine, but argon2id is the modern default and better supported in Node).

## R2 · Session token strategy

- **Decision**: **Short-lived JWT access token + opaque rotating refresh token**.
  - Access token: signed JWT using **HS256 with a strong `JWT_SECRET`** (RS256 deferred to a
    post-pilot decision if key management is introduced), lifetime **~15 minutes**, carries `sub`
    (accountId) only — no financial data and **no `emailVerified` claim** (see gating note below).
  - Refresh token: cryptographically random 256-bit opaque string, returned to the client, stored
    **only as a SHA-256 hash** in the `refreshSessions` collection with `expiresAt` (~30 days),
    rotated on every use, with **reuse detection** (a presented-but-already-rotated token revokes
    the whole rotation chain as suspected theft). SHA-256 (not argon2) is used because the token is
    high-entropy and verified on every refresh; argon2id is reserved for low-entropy passwords.
  - **Email-verification gating**: the soft gate for family/financial actions MUST read the current
    `emailVerified` flag from the account (authoritative), NOT from an access-token claim, so a
    just-verified user is unlocked immediately without waiting for token refresh (spec US6-AS1).
- **Rationale**: JWT keeps protected-resource checks stateless and fast (FR-010/FR-011); an opaque,
  server-stored refresh token is revocable, which is required for logout (US5/FR-012) and for the
  clarified "revoke all sessions on password reset" (Q2→A, FR-024). Storing only the hash means a DB
  leak does not expose usable tokens (Principle II).
- **Alternatives considered**: JWT-only with no server state (cannot revoke → fails logout and
  reset-all requirements); server sessions with a Redis store (extra infrastructure, violates YAGNI
  for a 3–5 family pilot — Mongo TTL indexes suffice).

## R3 · One-time code (verification & reset) format and lifetimes

- **Decision**: **6-digit numeric OTP**, generated with a CSPRNG, stored **hashed** (argon2id) in the
  `oneTimeCodes` collection, **single-use**, with:
  - Email verification code lifetime: **15 minutes**; max **5** verification attempts per code.
  - Password reset code lifetime: **15 minutes**; max **5** attempts per code.
  - Resend: new code invalidates the previous unused code of the same type (FR-021).
- **Rationale**: A numeric OTP entered in-app (clarification Q3→A) avoids deep-linking infrastructure,
  works when the email is opened on another device, and yields deterministic tests. Hashing at rest
  and single use satisfy FR-027.
- **Security note**: hashing a 6-digit code offers limited protection on its own (~10^6 keyspace). The
  primary defenses are the 15-minute expiry, the 5-attempt cap per code, and per-account/per-source
  rate limiting (R4); the hash only prevents casual plaintext exposure in a DB leak. This is an
  accepted trade-off for mobile OTP UX.
- **Alternatives considered**: Signed magic-link/deep link (better one-tap UX but needs universal-link
  setup and is harder to test on Expo); longer alphanumeric codes (marginal security gain, worse
  mobile entry UX). Rate limiting compensates for the small numeric keyspace.

## R4 · Rate limiting & lockout

- **Decision**: **`@nestjs/throttler`** for coarse per-IP/source limits on all auth endpoints, plus a
  **per-account failure counter** persisted with the account for sign-in and code verification.
  Baselines (configurable): sign-in 5 failures per account within 15 min → temporary lockout window;
  code resend 1/min and 5/hour per account; reset-request throttled per source (FR-013, FR-026).
- **Rationale**: Combines source-based and account-based throttling as required by the edge cases;
  Mongo-backed counters need no extra infrastructure for pilot scale.
- **Alternatives considered**: Redis-based sliding windows (better at scale, unnecessary now);
  IP-only throttling (misses distributed credential stuffing against one account).

## R5 · Transactional email provider (OTP delivery)

- **Decision**: Deliver OTP emails through a **`MailPort` interface** with an initial **Resend**
  adapter for the MVP pilot; the port keeps the provider swappable.
- **Rationale**: Resend offers a simple API, a free tier adequate for a 3–5 family pilot, and good
  deliverability for transactional email, minimizing setup for a solo developer. The port abstraction
  (Principle VI, hexagonal) means switching to Amazon SES or Mailgun later is an adapter change only.
- **Alternatives considered**: Amazon SES (lowest cost at scale, more setup/domain verification
  overhead up front); SendGrid/Mailgun (comparable; chosen against on DX/pricing for a tiny pilot).
- **Flag (revisit at planning close)**: provider account, sending domain/DKIM setup, and the monthly
  cost cap are pilot-launch prerequisites and appear as decisions in the constitution's post-pilot
  list. If you have a provider preference or an existing account, the adapter is the only change.

## R6 · Input validation & uniform error responses

- **Decision**: `class-validator` DTOs with a global `ValidationPipe` (whitelist + forbid unknown
  properties) for all requests; a shared error filter maps auth failures to **uniform, generic
  responses** so "unknown email" and "wrong password" are indistinguishable (FR-014, FR-022,
  SC-008/SC-011).
- **Rationale**: Server-side validation is mandatory (FR-017); centralizing the uniform-response
  mapping prevents accidental account enumeration through differing status codes or timing.
- **Alternatives considered**: Ad-hoc per-handler validation (error-prone, inconsistent messages).

## R7 · Log redaction (no secrets / no financial data)

- **Decision**: A logging redaction utility + interceptor that strips `password`, `newPassword`,
  `code`, `accessToken`, `refreshToken`, `authorization`, and any monetary fields from request/response
  logs and error reports; security events are logged as typed events with account id + event type only.
- **Rationale**: Directly enforces Principle II and FR-015/FR-027; verified by a dedicated test
  (SC-007).
- **Alternatives considered**: Relying on developer discipline (rejected — the constitution makes this
  non-negotiable and testable).

## Resolved unknowns summary

| Unknown (from Technical Context) | Resolution |
|----------------------------------|------------|
| Password hashing choice | argon2id (R1) |
| Session/token approach | JWT access + opaque rotating refresh, hashed, reuse-detected (R2) |
| OTP format & lifetimes | 6-digit numeric, hashed, single-use, 15 min, 5 attempts (R3) |
| Rate-limit / lockout thresholds | throttler + per-account counters, configurable baselines (R4) |
| Email provider | MailPort + Resend adapter for MVP, swappable (R5) |
| Validation & enumeration safety | class-validator + uniform error filter (R6) |
| Log redaction | redaction interceptor + typed security events (R7) |

All Technical Context unknowns are resolved. No `NEEDS CLARIFICATION` remains.
