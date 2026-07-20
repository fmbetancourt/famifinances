# Research: API Security Hardening (SEC-01)

**Feature**: SEC-01 · API security hardening
**Date**: 2026-07-20

Patterns inherited from FND-01 (typed fail-fast env, `security.ts` constants, global throttler) and AUTH-01
(credential endpoints, `UniformErrorFilter`, log redaction). No open `NEEDS CLARIFICATION` remain — the three
decisions were closed in `/speckit-clarify` (Session 2026-07-20): deny-by-default CORS allowlist; ~5/min per-IP
credential rate limit; dependency scan automated in CI while backups/restore/secrets/TLS are a manual gate.

## R1 · Security response headers (helmet, global)

- **Decision**: Apply **helmet** in `main.ts` (`app.use(helmet(...))`) so every response carries HSTS (a
  `max-age`, e.g. 180 days), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`
  (frameguard), and a strict `Referrer-Policy` (`no-referrer`), and the `X-Powered-By` banner is removed
  (helmet `hidePoweredBy`; also `app.disable('x-powered-by')` on the underlying Express instance). helmet's
  Content-Security-Policy is **tuned/relaxed for the Swagger UI** at `/api/docs` (or CSP disabled for that
  path) since a JSON API otherwise renders no HTML.
- **Rationale**: helmet is the industry-standard, auditable header middleware; one small dependency covers a
  broad, global protection (FR-001/FR-009) with less risk than hand-rolled headers. Applying it in `main.ts`
  guarantees all current and future routes are covered.
- **Alternatives considered**: a hand-written `SecurityHeadersMiddleware` (rejected — reinvents a
  well-maintained lib, easier to get wrong); per-controller headers (rejected — not global, FR-009).

## R2 · CORS allowlist (deny-by-default, from env)

- **Decision**: `app.enableCors({ origin, credentials: false })` where `origin` is a function built from
  `CORS_ALLOWED_ORIGINS` (comma-separated env). The function **allows requests with no `Origin`** (native app /
  server-to-server) and, for browser requests, allows only origins in the list; an **empty/unset list denies
  all** cross-origin browser access (deny-by-default). A tiny `common/security/cors-origin.ts` builds and unit-
  tests this predicate.
- **Rationale**: The native RN client sends no `Origin`, so it must never be blocked; a future web/admin client
  is explicitly allowlisted (clarify Q1). Deny-by-default is the secure posture for a financial API (FR-002).
- **Alternatives considered**: reflect any origin (rejected — insecure); disable CORS entirely (rejected —
  blocks any future web client); a regex origin (deferred — an explicit list is clearer and safer for a pilot).

## R3 · Request body-size limit

- **Decision**: Cap the JSON body at a configurable `REQUEST_BODY_LIMIT` (default `100kb`) by configuring the
  Express body parser in `main.ts` (`app.use(json({ limit }))` / Nest body-parser options). An oversized body
  yields **413 Payload Too Large** before the handler runs.
- **Rationale**: All endpoints accept small JSON payloads (amounts, notes ≤ 280 chars, credentials); 100kb is
  generous yet caps memory-pressure/DoS from huge bodies (FR-003). Configurable for headroom.
- **Alternatives considered**: no limit (rejected — DoS vector); a per-route limit (unneeded — one global cap
  suffices at pilot scope).

## R4 · Stricter credential rate limits (per-IP, layered)

- **Decision**: Keep the global `THROTTLE` (30/60s, the `default` throttler). On the AUTH-01 credential routes
  (`login`, `register`, `password/reset/request`, `password/reset/confirm`, `email/verify`,
  `email/verify/resend`) apply `@Throttle({ default: { limit: AUTH_THROTTLE.limit, ttl: AUTH_THROTTLE.ttlMs } })`
  — a per-route **override** of the default throttler to **~5/60s per IP** (`AUTH_THROTTLE`, env-configurable).
  This **layers** on the existing per-account sign-in **lockout** (5 failures / 15 min) from FND/AUTH, giving
  per-IP (throttle) + per-account (lockout) protection.
- **Rationale**: `@Throttle` overrides are the clean `@nestjs/throttler` v6 pattern for stricter per-route
  limits without a second global throttler (which would over-restrict non-auth routes). Per-IP throttle +
  per-account lockout covers both brute-force and credential-stuffing (FR-004). Throttle rejections are **429**
  with a generic message (no enumeration, FR-005).
- **Alternatives considered**: a second named global throttler (rejected — applies to all routes); a custom
  per-identifier tracker keyed on the request email (deferred — the per-account lockout already covers the
  identifier dimension; per-IP throttle is the missing piece).

## R5 · Error / log / secret hygiene — verify & close

- **Decision**: SEC-01 **verifies** the existing `UniformErrorFilter` (generic messages; validation keeps
  field-level rules only; unknown errors → opaque 500 with redacted server log), the log `redact()` helper, and
  the fail-fast `validateEnv` (missing `MONGODB_URI`/`JWT_SECRET` → boot error). New e2e assert: no
  stack/driver/secret in any error body across validation/401/404/500; `password/reset/request` stays uniform
  regardless of whether the email exists (no enumeration). Any gap found is closed.
- **Rationale**: These controls already exist (FR-006/FR-007/FR-008 partly satisfied); SEC-01's value is
  proving them under test and closing gaps, not rebuilding (Principle V).
- **Alternatives considered**: a new global logging/error stack (rejected — the existing one is sufficient).

## R6 · Dependency scan in CI + operational checklist

- **Decision**: Add a **"Dependency audit"** step to `.github/workflows/ci.yml` quality-gates:
  `pnpm audit --audit-level=high` (fails the build on a high/critical advisory). **Accepted risk** is recorded
  via pnpm's native `pnpm.auditConfig.ignoreCves` / `ignoreGhsas` in root `package.json` (which `pnpm audit`
  honors) — starting **empty** (`ignoreCves: []`, i.e. block-by-default) — with a mirrored entry (id, rationale,
  reviewer, date) in `docs/security-checklist.md`. That checklist also captures the **manual** pre-pilot gate:
  secrets outside the repo (verified against `env.validation`), backups configured with a **tested restore**
  (evidence recorded), and enforced TLS at the platform. (FR-011/FR-012, US6.)
- **Rationale**: Automating the dependency scan makes it a repeatable gate (clarify Q3); the restore/secret/TLS
  items are operational and belong in a verifiable doc, not application tests.
- **Alternatives considered**: a third-party SCA service (deferred — `pnpm audit` is built-in and sufficient
  for the pilot); scripting the backup/restore now (out of scope — infra-dependent).

## Resolved Technical Context

| Item | Decision |
|------|----------|
| Headers | helmet in `main.ts`: HSTS, nosniff, frameguard DENY, no-referrer, hide `X-Powered-By`; CSP tuned for Swagger — R1 |
| CORS | env allowlist, deny-by-default, no-`Origin` allowed; `cors-origin.ts` predicate — R2 |
| Body limit | configurable JSON limit (default 100kb) → 413 — R3 |
| Auth rate limit | `@Throttle` override ~5/60s per IP on credential routes; layered on per-account lockout — R4 |
| Hygiene | verify `UniformErrorFilter` + redaction + fail-fast env; e2e for no-leak + no-enumeration — R5 |
| CI + checklist | `pnpm audit --audit-level=high` in CI; `docs/security-checklist.md` manual gate — R6 |
