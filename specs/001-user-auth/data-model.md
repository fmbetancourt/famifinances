# Phase 1 Data Model: AUTH-01

**Feature**: User Authentication & Access Control
**Date**: 2026-07-16
**Store**: MongoDB via Mongoose. Collections: `accounts`, `refreshSessions`, `oneTimeCodes`.

All timestamps are UTC. No monetary or financial fields exist in this feature. Secrets (password,
refresh token, OTP) are persisted only as hashes and never logged.

## Entity: Account (`accounts`)

Represents one person's identity and credentials. One person → exactly one account. Family membership
is modeled separately in FAM-01.

| Field | Type | Rules |
|-------|------|-------|
| `_id` | ObjectId | Primary key; used as `sub` in access tokens. |
| `email` | string | **Unique**, stored normalized (trimmed, lowercased). Valid email format. |
| `passwordHash` | string | argon2id hash. Never returned, never logged. |
| `emailVerified` | boolean | Defaults `false` at registration (FR-018). |
| `status` | enum `active` \| `disabled` | Defaults `active`. `disabled` accounts are rejected (FR-016). |
| `failedLoginCount` | number | For per-account lockout (R4/FR-013). Reset on success. |
| `lockedUntil` | Date \| null | Set when lockout threshold exceeded; requests denied until passed. |
| `createdAt` | Date | Set on creation. |
| `updatedAt` | Date | Maintained by Mongoose. |

**Indexes**: unique index on `email` (normalized). 

**Validation rules** (from requirements):
- `email` normalized case-insensitively and trimmed before uniqueness check (FR-003, Edge Cases).
- Password strength enforced **before** hashing (FR-002) — not stored on the account.
- Uniqueness violation returns a non-committal response (FR-004, no enumeration).

**State transitions**:
- `emailVerified`: `false → true` on successful verification (FR-020) or successful password reset
  (FR-025). Never reverts in this feature.
- `status`: `active → disabled` is an administrative action (outside this feature) but MUST be honored
  by session validation.
- Lockout: `failedLoginCount` increments on failed sign-in; at threshold sets `lockedUntil`; cleared
  on successful sign-in.

## Entity: RefreshSession (`refreshSessions`)

Represents one authenticated session's rotating refresh credential. Enables logout and revoke-all.

| Field | Type | Rules |
|-------|------|-------|
| `_id` | ObjectId | Primary key. |
| `accountId` | ObjectId (ref Account) | Owning account. |
| `tokenHash` | string | SHA-256 hash of the current opaque refresh token. Never store plaintext. |
| `rotationChainId` | string (uuid) | Identifies the rotation chain for reuse detection. Named to avoid collision with the `Family` domain concept. |
| `expiresAt` | Date | ~30 days from issue; TTL index expires the document. |
| `revokedAt` | Date \| null | Set on logout, rotation-supersession, reuse detection, or reset-all. |
| `createdAt` | Date | Issue time. |
| `lastUsedAt` | Date | Updated on each successful refresh. |

**Indexes**: `accountId`; `tokenHash`; TTL index on `expiresAt`.

**State transitions / rules**:
- On login: create a new session with a fresh `rotationChainId` (FR-006/FR-007).
- On refresh: verify `tokenHash` matches a **non-revoked, non-expired** session; then rotate — issue a
  new token, update `tokenHash`, and invalidate the previous value (FR-008).
- **Reuse detection**: if a presented token hashes to a session already rotated/revoked, revoke every
  session sharing that `rotationChainId` (suspected theft; Edge Cases).
- On logout: set `revokedAt` for that session (FR-012).
- On password reset: set `revokedAt` for **all** sessions of the account (FR-024, Q2→A).
- A revoked or expired session is treated as unauthenticated (FR-009).

## Entity: OneTimeCode (`oneTimeCodes`)

Represents a pending email-verification or password-reset challenge.

| Field | Type | Rules |
|-------|------|-------|
| `_id` | ObjectId | Primary key. |
| `accountId` | ObjectId (ref Account) | Owning account. |
| `type` | enum `email_verification` \| `password_reset` | Challenge type. |
| `codeHash` | string | argon2id hash of the 6-digit code. Never store/log plaintext. |
| `expiresAt` | Date | 15 minutes from issue; TTL index expires the document. |
| `consumedAt` | Date \| null | Set when the code is successfully used (single-use, FR-027). |
| `attemptCount` | number | Incremented on each verify attempt; max 5 then invalid. |
| `createdAt` | Date | Issue time. |

**Indexes**: `accountId` + `type`; TTL index on `expiresAt`.

**State transitions / rules**:
- Issue: creating a new code of a given `type` invalidates any previous **unused** code of the same
  type for that account (FR-021).
- Verify: matches only a **non-consumed, non-expired** code within `attemptCount` limit; on success set
  `consumedAt`. Wrong/expired/used codes are rejected without revealing the code (FR-020/FR-023).
- Email verification success → `Account.emailVerified = true`.
- Password reset success → set new `passwordHash`, mark `emailVerified = true` (FR-025), revoke all
  `refreshSessions` for the account (FR-024).

## Relationships

```text
Account (1) ──< (N) RefreshSession
Account (1) ──< (N) OneTimeCode
```

## Derived / enforced invariants

- Identity for any protected request is derived from the verified access token's `sub`, never from a
  request body/param (FR-011). The soft gate for family/financial actions reads the **authoritative
  `emailVerified` flag from the account record** (not a token claim), so verification takes effect
  immediately (FR-019, US6-AS1, Q1→B).
- No document in this feature stores plaintext secrets or any monetary value.
- TTL indexes guarantee expired sessions and codes are physically removed, reducing exposure.
