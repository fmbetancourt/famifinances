---

description: "Task list for AUTH-01 · User Authentication & Access Control"
---

# Tasks: User Authentication & Access Control (AUTH-01)

**Input**: Design documents from `/specs/001-user-auth/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/auth.openapi.yaml, quickstart.md

**Tests**: INCLUDED. The constitution (Principle IV · Test-First) and the spec's Definition of Done
mandate tests alongside implementation, with mandatory coverage of authorization, no-enumeration, and
no-secrets-in-logs. Test tasks are written FIRST and must FAIL before implementation.

**Organization**: Tasks are grouped by user story (US1–US7) for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story the task belongs to (US1–US7)
- All paths are repository-relative for the monorepo (`apps/api`, `apps/mobile`, `packages/contracts`).

## Path Conventions (from plan.md)

- API: `apps/api/src/...`, tests in `apps/api/test/...` and `*.spec.ts` alongside source
- Mobile: `apps/mobile/app/...`, `apps/mobile/src/features/auth/...`
- Shared contracts: `packages/contracts/...`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Monorepo, apps, tooling, containerization

- [X] T001 Initialize pnpm monorepo with workspaces `apps/*` and `packages/*` in `package.json` + `pnpm-workspace.yaml`
- [X] T002 Scaffold NestJS API app in `apps/api/` (Nest project, `main.ts`, `app.module.ts`)
- [ ] T003 Scaffold Expo + Expo Router + TypeScript app in `apps/mobile/`
- [X] T004 [P] Configure TypeScript strict mode (no `any`) and shared `tsconfig.base.json` at repo root
- [X] T005 [P] Configure ESLint + Prettier (named-exports rule, import ordering) across the workspace in `.eslintrc.cjs`
- [X] T006 [P] Configure Jest for the API in `apps/api/jest.config.ts` and for mobile in `apps/mobile/jest.config.ts`
- [X] T007 [P] Add `Dockerfile` for `apps/api` and `docker-compose.yml` (api + MongoDB) at repo root
- [X] T008 [P] Define typed environment config (`@nestjs/config` schema: `MONGODB_URI`, `JWT_SECRET`, `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`, `OTP_TTL`, `MAIL_PROVIDER_API_KEY`, `MAIL_FROM_ADDRESS`) in `apps/api/src/config/env.validation.ts`

**Checkpoint**: Workspace builds; API and mobile apps boot; env validation fails fast on missing secrets.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cross-cutting infrastructure every user story depends on

**⚠️ CRITICAL**: No user story work begins until this phase is complete

- [X] T009 Create Mongoose connection module in `apps/api/src/database/database.module.ts`
- [X] T010 [P] Scaffold `packages/contracts` with shared auth DTO types mirroring `contracts/auth.openapi.yaml` in `packages/contracts/src/auth/index.ts`
- [X] T011 [P] Configure global `ValidationPipe` (whitelist + forbidNonWhitelisted + transform) in `apps/api/src/main.ts`
- [X] T012 [P] Implement log-redaction interceptor stripping password/token/code/monetary fields, plus typed security-event logger, in `apps/api/src/common/logging/redaction.interceptor.ts`
- [X] T013 [P] Implement uniform error filter (no account enumeration; generic messages) in `apps/api/src/common/filters/uniform-error.filter.ts`
- [X] T014 [P] Configure `@nestjs/throttler` global baseline + per-route overrides in `apps/api/src/app.module.ts`
- [X] T015 [P] Define `HashingPort` and implement argon2id `PasswordService` in `apps/api/src/auth/services/password.service.ts`
- [ ] T016 [P] Define `MailPort` interface + Resend adapter + dev console stub in `apps/api/src/mail/mail.module.ts`
- [X] T017 Create `Account` Mongoose schema (normalized unique email, passwordHash, emailVerified, status, lockout fields) and `AccountRepository` in `apps/api/src/accounts/account.schema.ts`
- [X] T018 [P] Configure Swagger/OpenAPI UI at `/api/docs` sourced from decorators in `apps/api/src/main.ts`
- [X] T019 [P] Mobile: implement `expo-secure-store` token store, base typed API client, and `AuthContext`/`useAuth` scaffolding in `apps/mobile/src/features/auth/`

**Checkpoint**: DB connects; shared contracts compile; validation, redaction, uniform errors, throttling, hashing, mail port, and the Account entity are all available.

---

## Phase 3: User Story 1 - Register a new account (Priority: P1) 🎯 MVP

**Goal**: A person creates an account (email starts unverified); duplicates and weak passwords are rejected without enumeration.

**Independent Test**: Register a valid email+password → account created; duplicate email → non-committal rejection; weak password / malformed email → validation error.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T020 [P] [US1] Contract/e2e test for `POST /auth/register` (201, duplicate 409 non-committal, weak pw 400, bad email 400) in `apps/api/test/register.e2e-spec.ts`
- [X] T021 [P] [US1] Unit test for password strength policy in `apps/api/src/auth/services/password-policy.spec.ts`
- [X] T022 [P] [US1] Unit test for email normalization/uniqueness (case + whitespace) in `apps/api/src/accounts/account.repository.spec.ts`

### Implementation for User Story 1

- [X] T023 [US1] Implement password strength policy validator in `apps/api/src/auth/services/password-policy.ts`
- [X] T024 [P] [US1] Create `RegisterDto` (class-validator) in `apps/api/src/auth/dto/register.dto.ts`
- [X] T025 [US1] Implement `AuthService.register` (normalize email, non-committal uniqueness, argon2id hash, create account `emailVerified=false`) in `apps/api/src/auth/auth.service.ts`
- [X] T026 [US1] Implement `POST /auth/register` in `apps/api/src/auth/auth.controller.ts`
- [X] T027 [P] [US1] Mobile sign-up screen (email+password, one primary action, non-color-only errors) in `apps/mobile/app/(auth)/sign-up.tsx`

**Checkpoint**: Registration works and is independently testable — MVP baseline.

---

## Phase 4: User Story 2 - Sign in and obtain a session (Priority: P1)

**Goal**: A registered person signs in and receives an access + rotating refresh token pair; wrong/unknown credentials get a uniform 401; repeated failures lock out.

**Independent Test**: Correct credentials → token pair; wrong password and unknown email → identical 401; N failures → throttled/locked.

### Tests for User Story 2 ⚠️ (write first, must fail)

- [X] T028 [P] [US2] Contract/e2e test for `POST /auth/login` (200 pair; unknown email == wrong password 401) in `apps/api/test/login.e2e-spec.ts`
- [X] T029 [P] [US2] Unit test for `TokenService` (access sign/verify, refresh hash + rotation) in `apps/api/src/auth/services/token.service.spec.ts`
- [X] T030 [P] [US2] Integration test for per-account lockout after failed attempts in `apps/api/test/login-lockout.e2e-spec.ts`

### Implementation for User Story 2

- [X] T031 [P] [US2] Create `RefreshSession` schema + repository (tokenHash [SHA-256], rotationChainId, expiresAt TTL, revokedAt) in `apps/api/src/sessions/refresh-session.schema.ts`
- [X] T032 [US2] Define `TokenPort` and implement `TokenService` (JWT access [HS256], opaque refresh [SHA-256 hashed], rotation, rotation-chain ids) in `apps/api/src/auth/services/token.service.ts`
- [X] T033 [P] [US2] Create `LoginDto` in `apps/api/src/auth/dto/login.dto.ts`
- [X] T034 [US2] Implement `AuthService.login` (verify password, lockout counters, issue token pair, persist session) in `apps/api/src/auth/auth.service.ts`
- [X] T035 [US2] Implement `POST /auth/login` in `apps/api/src/auth/auth.controller.ts`
- [X] T036 [P] [US2] Mobile sign-in screen + persist tokens via secure store in `apps/mobile/app/(auth)/sign-in.tsx`

**Checkpoint**: Register + sign-in work end to end.

---

## Phase 5: User Story 3 - Access protected resources only when authenticated (Priority: P1)

**Goal**: Protected endpoints require a valid access token and derive identity solely from the session; disabled accounts and invalid tokens are rejected.

**Independent Test**: No token → 401; expired/tampered → 401; valid token → 200 and identity taken from `sub` even when a foreign `accountId` is supplied.

**Depends on**: US2 (needs issued access tokens to exercise the guard).

### Tests for User Story 3 ⚠️ (write first, must fail)

- [X] T037 [P] [US3] Integration test for guard (no token/expired/tampered → 401; valid → 200) in `apps/api/test/protected-access.e2e-spec.ts`
- [X] T038 [P] [US3] Authorization test: identity from `sub`, foreign `accountId` in body ignored (FR-011/SC-004) in `apps/api/test/authorization.e2e-spec.ts`

### Implementation for User Story 3

- [X] T039 [P] [US3] Implement `JwtStrategy` (verify access token, load account, reject disabled) in `apps/api/src/auth/strategies/jwt.strategy.ts`
- [X] T040 [US3] Implement `JwtAuthGuard` in `apps/api/src/auth/guards/jwt-auth.guard.ts`
- [X] T041 [P] [US3] Implement `@CurrentUser` decorator that reads identity only from the validated session in `apps/api/src/auth/decorators/current-user.decorator.ts`
- [X] T042 [US3] Implement `GET /auth/me` returning `AccountSummary` in `apps/api/src/auth/auth.controller.ts`
- [X] T043 [P] [US3] Mobile: attach bearer token to API client + route guard/redirect for protected screens in `apps/mobile/src/features/auth/api/client.ts`

**Checkpoint**: P1 slice complete — register + login + protected access (recommended demo MVP).

---

## Phase 6: User Story 4 - Stay signed in with secure renewal (Priority: P2)

**Goal**: Expired access token is renewed with a rotating refresh token; reused refresh tokens are rejected and revoke the chain.

**Independent Test**: Expired access + valid refresh → new pair; replayed refresh → 401 and chain revoked.

**Depends on**: US2 (sessions/TokenService).

### Tests for User Story 4 ⚠️ (write first, must fail)

- [X] T044 [P] [US4] Contract/e2e test for `POST /auth/token/refresh` (rotation issues new pair) in `apps/api/test/refresh.e2e-spec.ts`
- [X] T045 [P] [US4] Integration test for reuse detection revoking the whole chain in `apps/api/test/refresh-reuse.e2e-spec.ts`

### Implementation for User Story 4

- [X] T046 [P] [US4] Create `RefreshDto` in `apps/api/src/auth/dto/refresh.dto.ts`
- [X] T047 [US4] Implement `AuthService.refresh` (validate hash, rotate, reuse-detection revoke chain) in `apps/api/src/auth/auth.service.ts`
- [X] T048 [US4] Implement `POST /auth/token/refresh` in `apps/api/src/auth/auth.controller.ts`
- [X] T049 [P] [US4] Mobile: auto-refresh interceptor on 401 with retry in `apps/mobile/src/features/auth/api/refresh-interceptor.ts`

**Checkpoint**: Sessions survive access-token expiry safely.

---

## Phase 7: User Story 5 - Sign out and revoke a session (Priority: P2)

**Goal**: Signing out revokes the session's refresh token so it can no longer be used.

**Independent Test**: After logout, the refresh token and protected access are rejected.

**Depends on**: US2 (sessions).

### Tests for User Story 5 ⚠️ (write first, must fail)

- [X] T050 [P] [US5] Contract/e2e test for `POST /auth/logout` revoking the session in `apps/api/test/logout.e2e-spec.ts`

### Implementation for User Story 5

- [X] T051 [US5] Implement `AuthService.logout` (revoke the presented session) in `apps/api/src/auth/auth.service.ts`
- [X] T052 [US5] Implement `POST /auth/logout` (auth-guarded) in `apps/api/src/auth/auth.controller.ts`
- [X] T053 [P] [US5] Mobile: sign-out action clears secure store and routes to sign-in in `apps/mobile/src/features/auth/hooks/use-sign-out.ts`

**Checkpoint**: Full session lifecycle (login → refresh → logout) works.

---

## Phase 8: User Story 6 - Verify email with a one-time code (Priority: P2)

**Goal**: A person verifies email via a 6-digit code; unverified accounts are soft-gated out of family/financial actions; resend invalidates the previous code.

**Independent Test**: Correct code → verified; unverified account blocked from a guarded family/financial action; expired/used/wrong code → 400; resend invalidates prior code.

**Depends on**: US1 (register wiring), Foundational MailPort.

### Tests for User Story 6 ⚠️ (write first, must fail)

- [X] T054 [P] [US6] Contract/e2e test for `POST /auth/email/verify` (200 verified; invalid/expired/used 400) in `apps/api/test/verify-email.e2e-spec.ts`
- [X] T055 [P] [US6] Integration test for soft gate (unverified account blocked, verified account allowed) exercising the test-only guarded route from T062 in `apps/api/test/verified-gate.e2e-spec.ts`
- [X] T056 [P] [US6] Integration test for resend invalidating the previous unused code in `apps/api/test/verify-resend.e2e-spec.ts`

### Implementation for User Story 6

- [X] T057 [P] [US6] Create `OneTimeCode` schema + repository (type, codeHash, expiresAt TTL, attemptCount, consumedAt) in `apps/api/src/one-time-codes/one-time-code.schema.ts`
- [X] T058 [US6] Implement `OneTimeCodeService` (CSPRNG 6-digit, argon2 hash, expiry, attempts, single-use, invalidate prior) in `apps/api/src/one-time-codes/one-time-code.service.ts`
- [X] T059 [US6] Wire verification-code issuance into `AuthService.register` and send via `MailPort` (FR-018) in `apps/api/src/auth/auth.service.ts`
- [X] T060 [P] [US6] Create `CodeDto` in `apps/api/src/auth/dto/code.dto.ts`
- [X] T061 [US6] Implement `POST /auth/email/verify` and `POST /auth/email/verify/resend` in `apps/api/src/auth/auth.controller.ts`
- [X] T062 [US6] Implement `EmailVerifiedGuard` / soft-gate decorator that reads the authoritative `emailVerified` flag from the account (not a token claim), for family/financial actions (consumed by FAM-01), plus a temporary test-only guarded route to exercise it within AUTH-01, in `apps/api/src/auth/guards/email-verified.guard.ts`
- [X] T063 [P] [US6] Mobile verify-email screen (OTP entry + resend) in `apps/mobile/app/(auth)/verify-email.tsx`

**Checkpoint**: Email verification and the soft gate are in place.

---

## Phase 9: User Story 7 - Reset a forgotten password (Priority: P2)

**Goal**: A person resets their password via an emailed code; success revokes all sessions, marks the email verified, and only the new password works.

**Independent Test**: Reset request uniform for registered/unregistered email; valid code + strong new password → all prior sessions rejected + email verified; invalid/expired code → 400.

**Depends on**: US2 (sessions to revoke), US6 (OneTimeCode + MailPort).

### Tests for User Story 7 ⚠️ (write first, must fail)

- [X] T064 [P] [US7] Contract/e2e test for `POST /auth/password/reset/request` uniform response (registered == unregistered) in `apps/api/test/reset-request.e2e-spec.ts`
- [X] T065 [P] [US7] Integration test for `reset/confirm`: revokes all sessions + marks verified + old tokens 401 in `apps/api/test/reset-confirm.e2e-spec.ts`
- [X] T066 [P] [US7] Integration test for invalid/expired/used reset code → 400 in `apps/api/test/reset-invalid.e2e-spec.ts`

### Implementation for User Story 7

- [X] T067 [P] [US7] Create `EmailDto` and `ResetConfirmDto` in `apps/api/src/auth/dto/reset.dto.ts`
- [X] T068 [US7] Implement `AuthService.requestPasswordReset` (uniform response; issue reset code via MailPort only if account exists) in `apps/api/src/auth/auth.service.ts`
- [X] T069 [US7] Implement `AuthService.confirmPasswordReset` (validate code, enforce strength, set new hash, revoke all sessions, mark verified) in `apps/api/src/auth/auth.service.ts`
- [X] T070 [US7] Implement `POST /auth/password/reset/request` and `POST /auth/password/reset/confirm` in `apps/api/src/auth/auth.controller.ts`
- [X] T071 [P] [US7] Mobile forgot-password + reset-password screens (request + OTP + new password) in `apps/mobile/app/(auth)/forgot-password.tsx` and `apps/mobile/app/(auth)/reset-password.tsx`

**Checkpoint**: All user stories independently functional.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Verification, hardening, and documentation across stories

- [X] T072 [P] No-secrets-in-logs test asserting no password/token/code/monetary value across the full flow (SC-007) in `apps/api/test/log-privacy.e2e-spec.ts`
- [X] T073 [P] OpenAPI ↔ implementation parity check (generated spec matches `contracts/auth.openapi.yaml`) in `apps/api/test/openapi-parity.spec.ts`
- [X] T074 [P] Verify `packages/contracts` types compile against both apps (no `any`) via a type-check task
- [X] T075 Security hardening pass: tune argon2id params and throttler/lockout thresholds in `apps/api/src/config/security.ts`
- [X] T076 [P] Document env vars, mail provider setup, and run instructions in `apps/api/README.md`
- [X] T077 Execute `specs/001-user-auth/quickstart.md` end-to-end validation and record results
- [X] T078 [P] Latency smoke check asserting registration→signed-in and sign-in server flows meet SC-001 (<2 min) / SC-002 (<30 s) budgets in `apps/api/test/auth-latency.smoke-spec.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3–9)**: All depend on Foundational.
  - US1 (P1): independent.
  - US2 (P1): independent (adds sessions/TokenService).
  - US3 (P1): depends on US2 (needs access tokens).
  - US4 (P2), US5 (P2): depend on US2 (sessions).
  - US6 (P2): depends on US1 (register wiring) + Foundational MailPort.
  - US7 (P2): depends on US2 (revoke sessions) + US6 (OneTimeCode + MailPort).
- **Polish (Phase 10)**: Depends on all targeted stories.

### Within Each User Story

- Tests are written and MUST FAIL before implementation.
- Models/schemas before services; services before endpoints; core before mobile integration.

### Parallel Opportunities

- Setup: T004–T008 in parallel.
- Foundational: T010–T016, T018, T019 in parallel (T017 after T009; T009 first).
- Within a story, all `[P]` tests run together, and `[P]` models/DTOs run together before their service.
- With capacity: US1 and US2 can proceed in parallel after Foundational; US3/US4/US5 follow US2; US6 follows US1; US7 follows US2+US6.

---

## Parallel Example: User Story 2

```bash
# Tests first (parallel):
Task: "Contract test POST /auth/login in apps/api/test/login.e2e-spec.ts"       # T028
Task: "Unit test TokenService in apps/api/src/auth/services/token.service.spec.ts" # T029
Task: "Integration test lockout in apps/api/test/login-lockout.e2e-spec.ts"     # T030

# Then parallel scaffolding:
Task: "RefreshSession schema in apps/api/src/sessions/refresh-session.schema.ts" # T031
Task: "LoginDto in apps/api/src/auth/dto/login.dto.ts"                           # T033
```

---

## Implementation Strategy

### MVP First

- **Minimal deployable slice**: Phase 1 + Phase 2 + **US1** (registration).
- **Recommended demo MVP**: through **US3** (register + sign-in + protected access) — the full P1 set,
  which establishes the session identity FAM-01 will build on.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 → US2 → US3 (P1 core) → validate/demo.
3. US4, US5 (session lifecycle) → US6 (verification + soft gate) → US7 (reset).
4. Polish: privacy/parity/hardening + quickstart validation.

---

## Notes

- `[P]` = different files, no dependency on an incomplete task.
- `[Story]` label maps each task to a spec user story for traceability.
- Constitution gates covered explicitly: identity-from-session (T038), no-enumeration (T028/T064),
  no-secrets-in-logs (T012/T072), hashed secrets (T015/T057/T058), OpenAPI contract (T018/T073),
  shared typed contracts (T010/T074).
- Verify each test fails before implementing; commit after each task or logical group (conventional commits).
