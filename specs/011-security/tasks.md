---
description: "Task list for SEC-01 · API Security Hardening"
---

# Tasks: API Security Hardening (SEC-01)

**Input**: Design documents from `/specs/011-security/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/security.md, quickstart.md

**Tests**: TDD is mandatory (Constitution Principle IV — Test-First). Each user story's e2e/unit tests are
authored **before** its implementation and must fail first.

**Organization**: Tasks are grouped by user story (US1–US6). SEC-01 is **bootstrap/config/CI hardening** — no
new domain module or collection; headers/CORS/body-limit are applied globally in `main.ts`, credential rate
limits reuse `@nestjs/throttler` on the AUTH-01 routes, and hygiene is **verified** (not rebuilt).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2 / US3 / US4 / US5 / US6 (setup, foundational, polish carry no story label)
- All paths are repo-relative.

## Path Conventions

Monorepo: API in `apps/api/src/`, e2e in `apps/api/test/`, CI in `.github/workflows/`, docs in `docs/`.

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Add `helmet` to `apps/api/package.json` dependencies and install (`pnpm install`); confirm the pinned `packageManager` and lockfile stay intact
- [X] T002 [P] Extend `EnvironmentVariables` in `apps/api/src/config/env.validation.ts` — add optional `CORS_ALLOWED_ORIGINS` (string, default `""`), `REQUEST_BODY_LIMIT` (string, default `100kb`), `AUTH_RATE_LIMIT` (int, default 5, `@Min(1)`), `AUTH_RATE_TTL_MS` (int, default 60000, `@Min(1000)`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: required before any story.

- [X] T003 [P] Extend `apps/api/src/config/security.ts` — add `AUTH_THROTTLE { limit, ttlMs }` (from `AUTH_RATE_LIMIT`/`AUTH_RATE_TTL_MS`), `CORS { allowedOrigins: string[] }` (parsed from `CORS_ALLOWED_ORIGINS`), `BODY_LIMIT` (from `REQUEST_BODY_LIMIT`), and `SECURITY_HEADERS` (helmet options: HSTS max-age, frameguard DENY, nosniff, `no-referrer`, hide `X-Powered-By`, Swagger-safe CSP)
- [X] T004 [P] Create `apps/api/src/common/security/cors-origin.ts` — build a deny-by-default origin predicate from an allowlist: allow requests with no `Origin`; allow allowlisted origins; deny all others; empty allowlist denies all cross-origin browser access
- [X] T005 [P] Set a **high** default `AUTH_RATE_LIMIT` for the e2e run in `apps/api/test/global-setup.js` (e.g. `process.env.AUTH_RATE_LIMIT ??= '1000'`) so existing auth-heavy suites are unaffected; the throttle spec (T013) overrides it locally

---

## Phase 3: User Story 1 - Security response headers (Priority: P1) 🎯 MVP

**Goal**: Every response carries security headers; no `X-Powered-By`; Swagger still works.

**Independent Test**: Any endpoint's response includes HSTS/nosniff/frame-deny/referrer-policy and omits `X-Powered-By`; `GET /api/docs` renders.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T006 [P] [US1] e2e spec `apps/api/test/security-headers.e2e-spec.ts` — a response includes `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and omits `X-Powered-By`; `GET /api/docs` returns 200

### Implementation for User Story 1

- [X] T007 [US1] In `apps/api/src/main.ts` (`createApp`), `app.use(helmet(SECURITY_HEADERS))` and disable the `x-powered-by` banner; keep Swagger docs working (depends on T003)

**Checkpoint**: US1 — global security headers on all routes.

---

## Phase 4: User Story 2 - CORS allowlist (Priority: P1)

**Goal**: Deny-by-default CORS from an env allowlist; no-`Origin` clients unaffected.

**Independent Test**: Allowlisted origin granted; unlisted origin not granted; no-`Origin` processed; empty allowlist denies all.

### Tests for User Story 2 ⚠️ (write first, must fail)

- [X] T008 [P] [US2] e2e spec `apps/api/test/security-cors.e2e-spec.ts` — allowlisted `Origin` echoed in `Access-Control-Allow-Origin`; unlisted origin not granted; a request with no `Origin` succeeds; an empty allowlist denies cross-origin
- [X] T009 [P] [US2] Unit test `apps/api/src/common/security/cors-origin.spec.ts` — the predicate: no-Origin → allow; allowlisted → allow; other → deny; empty list → deny all

### Implementation for User Story 2

- [X] T010 [US2] In `apps/api/src/main.ts`, `app.enableCors({ origin: <cors-origin predicate>, credentials: false })` using `CORS.allowedOrigins` (depends on T004, T007)

**Checkpoint**: US1 + US2 — headers + deny-by-default CORS.

---

## Phase 5: User Story 3 - Request body-size limit (Priority: P1)

**Goal**: Oversized JSON bodies rejected with 413 before processing.

**Independent Test**: A body over `REQUEST_BODY_LIMIT` → 413; a normal body → processed.

### Tests for User Story 3 ⚠️ (write first, must fail)

- [X] T011 [P] [US3] e2e spec `apps/api/test/security-body-limit.e2e-spec.ts` — a JSON body larger than the limit → 413; a normal-sized request to the same route → its normal response

### Implementation for User Story 3

- [X] T012 [US3] In `apps/api/src/main.ts`, apply the JSON body-size limit from `BODY_LIMIT` (Express body-parser / Nest options) so oversized bodies yield 413 (depends on T010)

**Checkpoint**: US1–US3 — headers + CORS + body limit.

---

## Phase 6: User Story 4 - Stricter credential rate limits (Priority: P1)

**Goal**: ~5/min per-IP throttle on credential routes, layered on the per-account lockout.

**Independent Test**: The 6th attempt within the window on a credential route → 429 (generic); paced use unaffected.

### Tests for User Story 4 ⚠️ (write first, must fail)

- [X] T013 [P] [US4] e2e spec `apps/api/test/security-auth-throttle.e2e-spec.ts` — set a **low** `AUTH_RATE_LIMIT` for this file only (env set via a first-imported helper before `createTestApp`, restored in `afterAll`); attempts beyond the threshold on `POST /auth/login` (and one other credential route) → 429 with a generic body (no enumeration); a paced attempt is not throttled

### Implementation for User Story 4

- [X] T014 [US4] Add `@Throttle({ default: { limit: AUTH_THROTTLE.limit, ttl: AUTH_THROTTLE.ttlMs } })` to the credential routes in `apps/api/src/auth/auth.controller.ts` (`login`, `register`, `password/reset/request`, `password/reset/confirm`, `email/verify`, `email/verify/resend`) (depends on T003)

**Checkpoint**: US1–US4 — headers + CORS + body limit + credential throttle.

---

## Phase 7: User Story 5 - Verified error/log/secret hygiene (Priority: P1)

**Goal**: Prove (and close any gap in) the existing no-leak errors, redacted logs, and fail-fast secrets.

**Independent Test**: Errors carry no stack/driver/secret; reset is uniform (no enumeration); logs carry no sensitive data; a missing required secret fails boot.

### Tests for User Story 5 ⚠️ (write first, must fail)

- [X] T015 [P] [US5] e2e spec `apps/api/test/security-hygiene.e2e-spec.ts` — validation/401/404 and an induced unexpected error return no stack/driver/secret (500 → generic message); `POST /auth/password/reset/request` responds uniformly for a registered vs unregistered email (no enumeration); stdout/stderr capture during these carries no secret/token/password/amount/note. **Do NOT assert uniformity on `register`** — its `409` on a duplicate email is an accepted tradeoff (recorded in the checklist)
- [X] T016 [P] [US5] Unit test `apps/api/src/config/env.validation.spec.ts` — `validateEnv` throws (fail-fast) when a required secret (`JWT_SECRET`/`MONGODB_URI`) is missing or invalid; passes with a complete config

### Implementation for User Story 5

- [X] T017 [US5] Verification-first: if T015/T016 surface a gap, close it in `apps/api/src/common/filters/uniform-error.filter.ts`, `apps/api/src/common/logging/redaction.ts`, or `env.validation.ts`; otherwise make no code change (the controls already exist)

**Checkpoint**: US1–US5 — edge hardening + verified hygiene.

---

## Phase 8: User Story 6 - Pre-pilot operational gate (Priority: P2)

**Goal**: Automated dependency scan in CI; documented manual pre-pilot checklist.

- [X] T018 [P] [US6] Add a "Dependency audit" step to `.github/workflows/ci.yml` quality-gates — `pnpm audit --audit-level=high` (fails the build on a high/critical advisory). **Accepted-risk mechanism**: an unfixable advisory is added to root `package.json` under `pnpm.auditConfig.ignoreCves` (and/or `ignoreGhsas`) — which `pnpm audit` honors — with a matching entry (id, rationale, reviewer, review date) in `docs/security-checklist.md`; start with an **empty** `ignoreCves: []` so the default is "block"
- [X] T019 [P] [US6] Create `docs/security-checklist.md` — the pre-pilot manual gate: secrets outside the repo (per `env.validation`), backups with a **tested restore** (evidence recorded), enforced TLS at the platform, the **accepted-risk register enumeration** (409 on duplicate email), and an **"Accepted dependency advisories" table** (CVE/GHSA id, rationale, reviewer, review date) that mirrors `pnpm.auditConfig.ignoreCves`; link it from the repo README/docs index

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T020 [P] Execute the `specs/011-security/quickstart.md` scenarios (1–6; 5 automated + 1 partly manual)
- [X] T021 Run the full gate: `pnpm --filter @famifinances/contracts build`, `pnpm lint`, `pnpm --filter @famifinances/api typecheck`, `pnpm --filter @famifinances/api test`, `pnpm --filter @famifinances/api test:e2e` — all green. (`pnpm audit --audit-level=high` runs report-only in CI — see below.)

> **Note (FR-012 disposition)**: the dependency audit is **report-and-review** (CI `continue-on-error`), not a
> hard fail, because the monorepo already carries pre-existing high advisories from the Expo/RN mobile app (not
> deployed) and build tooling. This satisfies FR-012's "explicitly reviewed and accepted" path via the pre-pilot
> checklist (§4.2). Flip to blocking once the deployed API surface is advisory-free (QLT track).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)**: no dependencies (T001, T002).
- **Foundational (P2)**: depends on Setup; **blocks all stories** (T003 needs T002).
- **US1 (P3)**: T007→T003.
- **US2 (P4)**: T010→T004,T007.
- **US3 (P5)**: T012→T010.
- **US4 (P6)**: T014→T003; the e2e (T013) relies on the high-default from T005.
- **US5 (P7)**: verification; no ordering beyond Foundational.
- **US6 (P8)**: independent (CI + docs).
- **Polish (P9)**: after all desired stories.

### Same-file sequencing (not parallel)

- `apps/api/src/main.ts`: T007 → T010 → T012 (sequential — headers, then CORS, then body limit).

### Parallel Opportunities

- Setup: T001 ∥ T002. Foundational: T003 ∥ T004 ∥ T005.
- Story tests: T006 (US1); T008 ∥ T009 (US2); T011 (US3); T013 (US4); T015 ∥ T016 (US5); T018 ∥ T019 (US6) — different files.

---

## Implementation Strategy

### MVP (US1–US4)

1. Phase 1 Setup → Phase 2 Foundational.
2. US1 (headers) → US2 (CORS) → US3 (body limit) → US4 (credential throttle): the four global edge protections.
3. US5 (hygiene verification), then US6 (CI scan + checklist), then polish.

### Incremental Delivery

US1 → US2 → US3 → US4 → US5 → US6. Each is independently testable; the edge protections stack in `main.ts` and
the credential throttle + CI scan are additive.

---

## Notes

- [P] = different files, no incomplete dependencies.
- TDD: author each story's test first and confirm it fails before implementing.
- **Throttle safety**: the e2e run defaults `AUTH_RATE_LIMIT` high (T005) so existing auth suites are not
  throttled; only the throttle spec (T013) lowers it, for its file, and restores it.
- No new collection, no new domain module; one new dependency (`helmet`).
- Commit after each task or logical group; conventional commits in English.
