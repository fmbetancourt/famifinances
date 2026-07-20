# Quickstart: API Security Hardening (SEC-01)

**Feature**: SEC-01 · API security hardening
**Date**: 2026-07-20

Validates the edge hardening end to end: security headers on every response, deny-by-default CORS, a body-size
limit, stricter credential rate limits, verified error/log/secret hygiene, and the CI dependency scan.
Behaviors: [contracts/security.md](./contracts/security.md); configuration:
[data-model.md](./data-model.md); decisions: [research.md](./research.md).

## Prerequisites

- Repo bootstrapped (`pnpm install`) with `helmet` added; the AUTH-01 module present.
- API runnable via the same harness as prior features; e2e uses `mongodb-memory-server` (serial, `maxWorkers 1`).
- Test env may set `CORS_ALLOWED_ORIGINS`, `REQUEST_BODY_LIMIT`, `AUTH_RATE_LIMIT`, `AUTH_RATE_TTL_MS` to
  exercise the configurable behaviors.

## Run

```bash
pnpm --filter @famifinances/api test         # unit (cors-origin predicate, config)
pnpm --filter @famifinances/api test:e2e     # security e2e
pnpm audit --audit-level=high                # dependency scan (also a CI step)
```

## Scenario 1 — Security headers on every response (US1, P1)

1. Call any endpoint (e.g. `GET /api/v1/auth/me` unauthenticated, or a public route).
2. **Expect** the response to include `Strict-Transport-Security` (with `max-age`), `X-Content-Type-Options:
   nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and to **omit** `X-Powered-By`.
3. `GET /api/docs` still renders the Swagger UI.

**Pass**: required headers present on all routes; no `X-Powered-By`; docs page works.

## Scenario 2 — CORS allowlist (US2, P1)

1. With `CORS_ALLOWED_ORIGINS=https://app.famifinances.cl`, send a request with `Origin:
   https://app.famifinances.cl` → response grants that origin (`Access-Control-Allow-Origin`).
2. Send a request with `Origin: https://evil.example` → that origin is **not** granted cross-origin access.
3. Send a request with **no `Origin`** → processed normally (200/expected).
4. With an empty allowlist, any browser `Origin` is denied (deny-by-default).

**Pass**: allowlisted origin allowed; unlisted denied; no-Origin unaffected; empty list denies all.

## Scenario 3 — Body-size limit (US3, P1)

1. `POST` a valid endpoint with a JSON body larger than `REQUEST_BODY_LIMIT` (e.g. a >100kb note field) →
   **413**, not processed.
2. A normal-sized request to the same endpoint → succeeds.

**Pass**: oversized body → 413; normal body processed.

## Scenario 4 — Credential rate limit (US4, P1)

1. With `AUTH_RATE_LIMIT=5`, `POST /api/v1/auth/login` with wrong credentials 5 times from the same client →
   each returns its normal auth error.
2. The 6th attempt within the window → **429** with a generic message (no account enumeration).
3. A single paced login by a legitimate user → not throttled.

**Pass**: throttled after the threshold per IP; generic 429; paced use unaffected; layered with account lockout.

## Scenario 5 — Error / log / secret hygiene (US5, P1)

1. Trigger a validation error, a 404, a 401, and (via a stub) an unexpected 500 → **no** response contains a
   stack trace, database/driver text, or secret; the 500 body is the generic message.
2. `POST /auth/password/reset/request` for a registered and an unregistered email → **uniform** response (no
   enumeration).
3. Capture stdout/stderr across the above → no secret, token, password, monetary amount, or note content.
4. Boot the app with `JWT_SECRET` unset → **fails fast** with a config error.

**Pass**: no internal detail leaks; no enumeration; no sensitive data in logs; fail-fast on missing secret.

## Scenario 6 — Dependency scan & checklist (US6, P2)

1. `pnpm audit --audit-level=high` runs locally and in CI quality-gates; a high/critical advisory fails it (or
   is recorded as accepted).
2. Review `docs/security-checklist.md` → secrets-outside-repo, backups + **tested restore**, and enforced TLS
   are each confirmed before the pilot.

**Pass**: the dependency scan gates the build; the pre-pilot manual checklist is satisfied and recorded.

## Done When

- [ ] Scenarios 1–6 pass (5 automated; 6 partly manual).
- [ ] Security headers present + `X-Powered-By` absent on all routes — SC-001.
- [ ] CORS deny-by-default with allowlist; no-Origin unaffected — SC-002.
- [ ] Oversized bodies → 413 — SC-003.
- [ ] Credential endpoints throttled per IP; paced use unaffected — SC-004.
- [ ] No internal detail in errors; no enumeration; no sensitive data in logs — SC-005/SC-006.
- [ ] CI dependency scan active; pre-pilot checklist recorded — SC-007/SC-008.
