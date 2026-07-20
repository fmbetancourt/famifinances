# Data Model: API Security Hardening (SEC-01)

**Feature**: SEC-01 · API security hardening
**Date**: 2026-07-20

SEC-01 adds **no persisted collection** and no user-facing entity. Its "model" is the **security configuration**
(typed, validated at startup, externally supplied with secure defaults) and the resulting **security constants**.
This document defines those settings and their validation rules.

## Configuration: EnvironmentVariables (extended)

New optional variables joining the existing fail-fast `EnvironmentVariables` (FND-01). All have secure defaults
so the app boots without them, but they are externally configurable (FR-010).

| Variable | Type | Default | Rule |
|----------|------|---------|------|
| `CORS_ALLOWED_ORIGINS` | string (opt) | `""` (deny all cross-origin browser access) | Comma-separated origin list; empty = deny-by-default. |
| `REQUEST_BODY_LIMIT` | string (opt) | `100kb` | Max JSON body size (bytes/`kb`/`mb` suffix); oversized → 413. |
| `AUTH_RATE_LIMIT` | int (opt) | `5` | Max credential-endpoint attempts per window, per IP (≥ 1). |
| `AUTH_RATE_TTL_MS` | int (opt) | `60000` | Credential rate-limit window in ms (≥ 1000). |

Existing (unchanged, referenced): `MONGODB_URI`, `JWT_SECRET` (required — fail-fast, FR-007), token TTLs, mail
config; `THROTTLE` (global 30/60s baseline).

## Derived constants: security.ts (extended)

| Constant | Shape | Meaning |
|----------|-------|---------|
| `AUTH_THROTTLE` | `{ limit: number; ttlMs: number }` | Per-IP credential rate limit (from `AUTH_RATE_LIMIT`/`AUTH_RATE_TTL_MS`; default 5 / 60000). |
| `CORS` | `{ allowedOrigins: string[] }` | Parsed allowlist from `CORS_ALLOWED_ORIGINS`. |
| `BODY_LIMIT` | `string` | The JSON body-size limit. |
| `SECURITY_HEADERS` | helmet options | HSTS max-age, frameguard DENY, `nosniff`, `no-referrer`, hide `X-Powered-By`, Swagger-safe CSP. |

## Behavior (applied globally at bootstrap)

- **Headers** (FR-001/FR-009): helmet applies `SECURITY_HEADERS` to every response; `X-Powered-By` removed.
- **CORS** (FR-002): an origin predicate allows no-`Origin` requests and allowlisted origins; everything else is
  denied cross-origin access. Empty allowlist ⇒ deny all.
- **Body limit** (FR-003): the JSON parser rejects bodies over `BODY_LIMIT` with **413**.
- **Credential rate limit** (FR-004/FR-005): `@Throttle` override on the AUTH-01 credential routes → **429**
  (generic, non-revealing) after `AUTH_THROTTLE.limit` attempts per IP per window; layered on the per-account
  lockout.

## Validation rules

- `AUTH_RATE_LIMIT` ≥ 1; `AUTH_RATE_TTL_MS` ≥ 1000 (validated in `EnvironmentVariables`).
- `REQUEST_BODY_LIMIT` a valid byte-size string; `CORS_ALLOWED_ORIGINS` a comma list of origins.
- Missing/invalid required secrets (`MONGODB_URI`, `JWT_SECRET`) ⇒ **fast boot failure** (existing, FR-007).
- All config is read from the environment; **no secret is committed** to the repo (FR-008, verified in the
  pre-pilot checklist).

## Relationships

- **Security Configuration → all routes** *(global)*: headers, CORS, and the body limit are applied at
  bootstrap and cover every current and future endpoint.
- **AUTH_THROTTLE → AUTH-01 credential routes**: the per-route override; layered over the per-account lockout.
- No relationship to any financial collection — SEC-01 reads and stores no family data.

## Notes

- **No persistence, no new module** — configuration + bootstrap wiring only.
- **Secure defaults**: the app is safe out-of-the-box (deny-by-default CORS, 100kb bodies, 5/min auth); ops
  tightens/loosens via env.
- **US6 checklist** is a living doc (`docs/security-checklist.md`), not application state.
