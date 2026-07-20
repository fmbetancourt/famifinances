# Implementation Plan: API Security Hardening (SEC-01)

**Branch**: `011-security` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-security/`

## Summary

SEC-01 hardens the API **edge**, cross-cutting all modules: global **security response headers** (via helmet),
a **deny-by-default CORS allowlist** from the environment, a **request body-size limit**, and **stricter
per-IP rate limits** on the credential endpoints (login, register, password-reset request/confirm, email-code
verify/resend) layered on the existing global throttler and per-account lockout. It also **verifies and closes**
the existing error/log/secret hygiene (uniform errors, redacted logs, fail-fast env validation, no account
enumeration), adds an **automated dependency vulnerability scan** to CI, and records a **pre-pilot operational
checklist** (secrets-outside-repo, backups + tested restore, enforced TLS) as a manual gate. No new domain
module, no new collection — this is bootstrap/config/CI hardening plus tests.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`); Node.js 20 LTS; NestJS; Expo/React Native mobile.

**Primary Dependencies**: existing stack — NestJS, Express, `@nestjs/throttler`, `class-validator`. Adds
**`helmet`** (one well-scoped, industry-standard security-header middleware — justified under Principle V).
Reuses FND-01 (`EnvironmentVariables` fail-fast validation, `THROTTLE`/security constants) and AUTH-01 (the
credential controller routes) and the existing `UniformErrorFilter` + log redaction.

**Storage**: none new — SEC-01 touches no collection.

**Testing**: Jest + Supertest (e2e, `mongodb-memory-server`). Mandatory: security headers present + no
`X-Powered-By` (all routes); CORS allowlisted-origin allowed / unlisted denied / no-Origin passes; oversized
body → 413; credential-endpoint throttle → 429 after the threshold while paced use passes; error hygiene (no
stack/driver/secret across validation/404/401/500) + no account enumeration on reset; no secret/amount/note in
logs.

**Target Platform**: iOS/Android (Expo, native — sends no browser `Origin`); Node API in a container behind a
TLS-terminating managed platform.

**Performance Goals**: negligible per-request overhead (header middleware + an in-memory throttle check); no
new I/O.

**Constraints**: deny-by-default CORS; secure defaults, all externally configurable; secrets never in the repo
and validated at startup; no monetary amount / note / secret in logs or error output; headers/CORS/limits apply
**globally** (all routes + versions); Swagger docs (`/api/docs`) must keep working under the header policy.

**Scale/Scope**: invited pilot; the constitution's pilot gate (tested restore, isolation, no-financial-logs)
governs go-live.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Assessment | Status |
|---|-----------|------------|--------|
| I | Family Data Isolation (NON-NEGOTIABLE) | Edge hardening does not touch family scoping; existing FAM-01 guards remain the boundary. SEC-01 adds no path that widens access. | PASS |
| II | Financial Privacy by Design | This is the feature's core: security headers, deny-by-default CORS, body limits, stricter credential rate limits, verified no-leak errors/logs, secrets validated at startup, automated dependency scan. Strengthens II directly. | PASS |
| III | Derived Balance Integrity | Not applicable — no financial computation or storage is touched. | PASS |
| IV | Test-First & Definition of Done | TDD; e2e for headers/CORS/body-limit/rate-limit/error-hygiene authored with the config; DoD includes the CI dependency scan. | PASS |
| V | Modular Monolith Simplicity | Bootstrap/config + CI hardening; **one** justified dependency (`helmet`); no new module, collection, or infrastructure. The operational checklist is a doc, not new architecture. | PASS |
| VI | Shared, Documented Contracts | The observable security behaviors (required headers, CORS rules, 413/429) are documented as a contract; TS strict, no `any`; config typed + validated. | PASS |
| VII | Fast & Accessible Capture UX | Not applicable (edge/config). Throttle/oversize responses are clear and non-revealing. | PASS |

**Result (pre-Phase 0)**: No violations. `helmet` is a scoped, standard security dependency (not a Principle-V
concern); Complexity Tracking is empty.

**Post-Design re-check (after Phase 1)**: Re-evaluated against `research.md`, `data-model.md`, and
`contracts/security.md`. All gates hold: no isolation path changed (I); headers/CORS/limits/rate-limits +
verified hygiene + dependency scan strengthen privacy (II); bootstrap/config only, one dependency, no new module
(V); documented security contract (VI). No new violations.

## Project Structure

### Documentation (this feature)

```text
specs/011-security/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (security configuration model)
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── security.md      # Observable security behaviors (headers, CORS, 413, 429)
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root) — files SEC-01 adds / edits

```text
apps/api/
├── src/
│   ├── main.ts                         # EDITED: app.use(helmet(...)); enableCors(allowlist); JSON body limit
│   ├── config/
│   │   ├── env.validation.ts           # EDITED: CORS_ALLOWED_ORIGINS, REQUEST_BODY_LIMIT, AUTH_RATE_LIMIT, AUTH_RATE_TTL_MS (optional, secure defaults)
│   │   └── security.ts                 # EDITED: AUTH_THROTTLE, CORS defaults (deny-by-default), BODY_LIMIT, helmet/header options
│   ├── common/security/
│   │   └── cors-origin.ts              # NEW: build the deny-by-default origin check from the allowlist
│   └── auth/auth.controller.ts         # EDITED: @Throttle({ default: { limit: 5, ttl: 60s } }) on credential routes
├── package.json                        # EDITED: add `helmet`
.github/workflows/ci.yml                # EDITED: add a "Dependency audit" step (pnpm audit --audit-level=high)
docs/security-checklist.md              # NEW: US6 pre-pilot manual gate (secrets, backups+tested restore, TLS)
```

Reuses `apps/api/src/config/` (env + security constants), the `UniformErrorFilter` + log redaction, and the
existing `@nestjs/throttler` global guard (SEC-01 adds per-route overrides, not a new guard). No `apps/mobile`
changes (edge/config feature).

**Structure Decision**: Keep the established monorepo layout. SEC-01 is **bootstrap + config + CI** hardening,
not a domain module: security headers, CORS, and the body limit are applied globally in `main.ts` (so every
current and future route is covered); the credential rate limit reuses `@nestjs/throttler` via `@Throttle`
overrides on the AUTH-01 routes (per-IP), layered over the existing per-account sign-in lockout; new settings
join the typed, fail-fast `EnvironmentVariables` with secure defaults. Error/log/secret hygiene already exists
(`UniformErrorFilter`, redaction, env validation) and SEC-01 **verifies** it with tests rather than rebuilding
it. The dependency scan is a CI step; the operational checklist is a living doc (`docs/security-checklist.md`).
The only new dependency is `helmet` (standard, auditable). No new collection or infrastructure.

## Complexity Tracking

> No constitutional violations. `helmet` is a scoped, standard security dependency; no entries required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
