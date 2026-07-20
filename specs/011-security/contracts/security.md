# Security Contract (SEC-01)

**Feature**: SEC-01 · API security hardening
**Date**: 2026-07-20

SEC-01 exposes **no new endpoints or payloads** — its contract is the set of **observable security behaviors**
that every response and the credential endpoints must exhibit. These are the assertions the e2e suite verifies.

## 1 · Security response headers (all routes) — FR-001/FR-009

Every response (any method, any route, any API version) MUST include:

| Header | Required value |
|--------|----------------|
| `Strict-Transport-Security` | present with a `max-age` (e.g. `max-age=15552000; includeSubDomains`) |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `no-referrer` |

And MUST **omit**:

| Header | Requirement |
|--------|-------------|
| `X-Powered-By` | absent (no server-identifying banner) |

Swagger UI at `GET /api/docs` MUST still render (CSP tuned, not breaking the docs page).

## 2 · CORS (browser cross-origin) — FR-002

| Request | Behavior |
|---------|----------|
| Cross-origin from an **allowlisted** origin | `Access-Control-Allow-Origin` echoes that origin (access granted) |
| Cross-origin from a **non-allowlisted** origin | No `Access-Control-Allow-Origin` for that origin (access not granted) |
| Request with **no `Origin`** (native app, server-to-server) | Processed normally (never blocked by CORS) |
| Preflight `OPTIONS` from an allowlisted origin | Succeeds; from an unlisted origin, not granted |
| Empty/unset allowlist | Deny-by-default (no cross-origin browser access granted) |

## 3 · Request body-size limit — FR-003

| Request | Response |
|---------|----------|
| JSON body over `REQUEST_BODY_LIMIT` (default 100kb) | **413 Payload Too Large**, not processed |
| JSON body within the limit | Processed normally |

## 4 · Credential-endpoint rate limit — FR-004/FR-005

Applies to: `POST /api/v1/auth/login`, `/auth/register`, `/auth/password/reset/request`,
`/auth/password/reset/confirm`, `/auth/email/verify`, `/auth/email/verify/resend`.

| Condition | Response |
|-----------|----------|
| Attempts ≤ `AUTH_RATE_LIMIT` (default 5) per `AUTH_RATE_TTL_MS` (60s) per IP | Processed normally |
| Next attempt after the threshold within the window | **429 Too Many Requests**, generic message (no account enumeration, no internal detail) |
| After the window elapses | Attempts allowed again |

Layered on the existing per-account sign-in lockout (5 failures / 15 min).

## 5 · Error / log / secret hygiene — FR-006/FR-007/FR-008

| Case | Guarantee |
|------|-----------|
| Validation error (400) | `{ message, errors: [{ field, rule }] }` — no stack/driver/secret |
| Not found / unauthorized (404/401) | Generic `{ message }` — no internal detail |
| Unexpected error (500) | `{ message: "An unexpected error occurred." }`; detail only in redacted server logs |
| `POST /auth/password/reset/request` | **Uniform response** whether or not the email exists (no enumeration) |
| Any log/analytics line | Contains no secret, token, password, monetary amount, or note content |
| Missing/invalid required secret at boot | Process **fails fast** (no insecure start) |

## 6 · Build / operational gate — FR-011/FR-012 (US6)

| Gate | Requirement |
|------|-------------|
| CI dependency audit | `pnpm audit --audit-level=high` runs in quality-gates; a high/critical advisory fails the build (or is explicitly accepted) |
| Pre-pilot manual checklist (`docs/security-checklist.md`) | Secrets outside the repo; backups with a **tested restore** (evidence recorded); enforced TLS at the platform |

## Error body shapes (reused, unchanged)

```json
{ "message": "string" }
```

```json
{ "message": "Validation failed", "errors": [{ "field": "string", "rule": "string" }] }
```
