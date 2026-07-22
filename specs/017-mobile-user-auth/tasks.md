---
description: "Task list for Mobile User Authentication & Access Control (AUTH-02 / FAM-8)"
---

# Tasks: Mobile User Authentication & Access Control (AUTH-02 / FAM-8)

**Input**: Design documents from `/specs/017-mobile-user-auth/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/session-provider.md ✅

**Tests**: INCLUDED. The spec requires real-time validation (US2-AS3) and Constitution Principle IV
mandates tests for the security-critical session/rotation logic. This slice also introduces the
mobile Jest harness (research D3).

**Organization**: Tasks are grouped by user story. `apps/mobile` is the only app touched (no API
change — `/auth/me` and `/families/me` already exist).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1, US2, US3 (maps to spec.md user stories); omitted for Setup/Foundational/Polish
- All paths are repository-relative under `apps/mobile/`

## Path Conventions (this feature)

- Routes: `apps/mobile/app/**` (Expo Router file-based)
- Feature logic: `apps/mobile/src/features/auth/**`
- Tests: co-located `__tests__/` folders under the module they cover

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Introduce the mobile test harness (research D3) so subsequent tasks can ship tests.

- [X] T001 Add test devDependencies (`jest-expo`, `@testing-library/react-native`, `jest`, `@types/jest`) and set `"test": "jest"` in `apps/mobile/package.json`
- [X] T002 [P] Create Jest config using the `jest-expo` preset (transformIgnorePatterns for RN/Expo) in `apps/mobile/jest.config.js`
- [X] T003 [P] Create Jest setup file mocking `expo-secure-store` (in-memory) and `expo-router` navigation in `apps/mobile/jest.setup.ts`

**Checkpoint**: `pnpm --filter @famifinances/mobile test` runs (0 tests) without config errors.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Routing skeleton + Session context that ALL user stories depend on for navigation.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Define `SessionStatus`, `SessionState`, and `SessionApi` types (no token fields — see data-model INV-1) in `apps/mobile/src/features/auth/session/session-context.tsx`
- [X] T005 Implement `SessionProvider` + `useSession()` with `establishSession`/`reload`/`signOut` wired to existing `api/client.ts`, `api/session.ts`, and `hooks/use-sign-out.ts` (bootstrap wired in T018) in `apps/mobile/src/features/auth/session/session-context.tsx` (depends on T004)
- [X] T006 Create root layout wrapping the tree in `<SessionProvider>` and rendering a loading state while `status === 'loading'` (no protected screen flashes, INV-4) in `apps/mobile/app/_layout.tsx` (depends on T005)
- [X] T007 [P] Create launch redirect that routes by session (`authenticated`+family → `(app)`, `authenticated` no family → `(family)/onboarding`, else `(auth)/sign-in`) in `apps/mobile/app/index.tsx`
- [X] T008 [P] Create `(auth)` group layout (Stack) that redirects OUT to `(app)` when already authenticated in `apps/mobile/app/(auth)/_layout.tsx`
- [X] T009 [P] Create `(app)` protected group layout that redirects to `(auth)/sign-in` when `status === 'unauthenticated'` (SC-004) in `apps/mobile/app/(app)/_layout.tsx`
- [X] T010 [P] Create `(family)` group layout (Stack) in `apps/mobile/app/(family)/_layout.tsx`
- [X] T011 [P] Create placeholder authenticated home screen with a Sign Out action bound to `useSession().signOut` in `apps/mobile/app/(app)/index.tsx`
- [X] T012 [P] Create placeholder family-onboarding route (FR-007 target; full Create/Join UI deferred to FAM-9) in `apps/mobile/app/(family)/onboarding.tsx`

**Checkpoint**: App launches into the loading gate, then routes to sign-in; deep-linking a `(app)` route while signed out redirects to sign-in.

---

## Phase 3: User Story 1 - Sign In & Secure Session Persistence (Priority: P1) 🎯 MVP

**Goal**: Sign in with valid credentials, persist the session across restarts, transparently refresh
expired tokens, and keep unauthenticated users out of protected routes.

**Independent Test**: Enter valid credentials on `sign-in.tsx`, force-close and reopen the app, and
land directly on the main screen (or onboarding if no family) with no credential prompt.

### Tests for User Story 1 ⚠️ (write first, ensure they FAIL)

- [X] T013 [P] [US1] Unit test cold-start restore paths (valid tokens → authenticated; refresh 401 → cleared + unauthenticated; network error → retriable offline) in `apps/mobile/src/features/auth/session/__tests__/session-bootstrap.test.ts`
- [X] T014 [P] [US1] Unit test refresh interceptor single-flight rotation (concurrent 401s coalesce to one refresh; retry uses rotated token) in `apps/mobile/src/features/auth/api/__tests__/refresh-interceptor.test.ts`
- [X] T015 [P] [US1] Component test that an unauthenticated session renders the sign-in redirect, not `(app)` content (SC-004) in `apps/mobile/app/(app)/__tests__/protected-route.test.tsx`

### Implementation for User Story 1

- [X] T016 [US1] Implement family-membership resolver (`GET /families/me` via `authFetch`; `2xx` → `familyId`, `403/404` → `null`) in `apps/mobile/src/features/auth/api/family.ts`
- [X] T017 [US1] Implement `session-bootstrap` cold-start restore (SecureStore → `/auth/me` via `authFetch` → family resolver; map failures to `unauthenticated`/offline per data-model transitions) in `apps/mobile/src/features/auth/session/session-bootstrap.ts` (depends on T016)
- [X] T018 [US1] Run bootstrap on `SessionProvider` mount and have `establishSession`/`reload` resolve identity + family via T016/T017 in `apps/mobile/src/features/auth/session/session-context.tsx` (depends on T005, T017)
- [X] T019 [US1] Update sign-in to call `useSession().establishSession(tokens)` and route by family instead of hard-coded `'/'` in `apps/mobile/app/(auth)/sign-in.tsx` (depends on T018)
- [X] T020 [US1] Verify expired-token flow end-to-end: a `(app)` data call on an expired access token refreshes transparently and retries via the interceptor (FR-002, SC-002) — wiring check in `apps/mobile/app/(app)/index.tsx`
- [X] T037 [US1] Show a uniform, non-enumerating error on invalid sign-in (generic "invalid email or password", no account-existence disclosure) in `apps/mobile/app/(auth)/sign-in.tsx` (FR-011; depends on T019)

**Checkpoint**: US1 fully functional — sign in, persist across restart, transparent refresh, protected-route gating.

---

## Phase 4: User Story 2 - Account Registration & Email Verification (Priority: P1)

**Goal**: Register with a complex password (real-time validation), verify via 6-digit OTP, then land
in the app or onboarding.

**Independent Test**: Register on `sign-up.tsx` with a ≥12-char complex password, complete OTP on
`verify-email.tsx`, and confirm the account transitions to verified and routes correctly.

### Tests for User Story 2 ⚠️ (write first, ensure they FAIL)

- [X] T021 [P] [US2] Unit test `password-policy.evaluate()` (each rule; `valid`/`missing` output) in `apps/mobile/src/features/auth/session/__tests__/password-policy.test.ts`
- [X] T022 [P] [US2] Component test that sign-up lists missing password requirements in real time and blocks submit until valid (FR-003, US2-AS3) in `apps/mobile/app/(auth)/__tests__/sign-up.test.tsx`

### Implementation for User Story 2

- [X] T023 [P] [US2] Implement pure password-policy validator (rules: minLength≥12, uppercase, lowercase, number, special) in `apps/mobile/src/features/auth/session/password-policy.ts`
- [X] T024 [US2] Wire real-time missing-requirements feedback (text, not color alone — Principle VII) and disable submit until valid in `apps/mobile/app/(auth)/sign-up.tsx` (depends on T023)
- [X] T025 [US2] On OTP success, call `useSession().reload()` and route by family membership (FR-007) in `apps/mobile/app/(auth)/verify-email.tsx` (depends on T018)

**Checkpoint**: US1 AND US2 both work independently.

---

## Phase 5: User Story 3 - Password Reset & Secure Logout (Priority: P2)

**Goal**: Reset a forgotten password via emailed code, and explicitly sign out with full local +
server session teardown.

**Independent Test**: Trigger forgot-password, reset with the code + new password, sign in with the
new password; or tap Sign Out and confirm SecureStore is cleared and the app returns to sign-in.

### Tests for User Story 3 ⚠️ (write first, ensure they FAIL)

- [X] T026 [P] [US3] Component test that reset-password shows password-policy feedback for the new password in `apps/mobile/app/(auth)/__tests__/reset-password.test.tsx`
- [X] T027 [P] [US3] Unit test that `signOut` clears SecureStore and sets `unauthenticated` even when `POST /auth/logout` rejects (best-effort) in `apps/mobile/src/features/auth/session/__tests__/sign-out.test.ts`

### Implementation for User Story 3

- [X] T028 [US3] Apply password-policy feedback to the new-password field in `apps/mobile/app/(auth)/reset-password.tsx` (depends on T023)
- [X] T029 [US3] Ensure the Sign Out action routes through `useSession().signOut()` (server revoke + `clearTokens` + `unauthenticated`) in `apps/mobile/app/(app)/index.tsx` (depends on T005; shares `app/(app)/index.tsx` with T011/T020 — keep sequential, not parallel)
- [X] T030 [US3] Verify forgot-password → reset-password → sign-in flow (uniform no-enumeration response preserved) in `apps/mobile/app/(auth)/forgot-password.tsx`

**Checkpoint**: All three user stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Privacy hardening, validation gates, and DoD.

- [X] T031 [P] Add a no-logging test asserting the auth/session code path writes no token or password to `console` (FR-006, SC-003, INV-1) in `apps/mobile/src/features/auth/session/__tests__/no-secret-logging.test.ts`
- [X] T032 [P] Run `pnpm --filter @famifinances/mobile typecheck` and `pnpm --filter @famifinances/mobile test` — all green (TS strict, no `any`)
- [ ] T033 Physical-device validation per DoD following `specs/017-mobile-user-auth/quickstart.md`: cold-start restore, expired-token transparent refresh, sign-out teardown, and **measure sign-in → first rendered screen ≤ 1.5 s on the SC-001 reference network** (SC-001) — run the manual checklist `specs/017-mobile-user-auth/checklists/device-validation.md` (DV001–DV018)
- [X] T034 [P] Update `apps/mobile/README` (or `docs/`) with `EXPO_PUBLIC_API_BASE` and the auth route-group map
- [X] T035 [P] Handle HTTP 429 on credential screens with a friendly throttle message (no account enumeration), mirroring the `verify-email` resend handling, in `apps/mobile/app/(auth)/sign-in.tsx` and `apps/mobile/app/(auth)/sign-up.tsx` (FR-010)
- [X] T036 [P] Add a mobile unit-test step (`pnpm --filter @famifinances/mobile test`) to the CI workflow so SC-005 is enforced, in `.github/workflows/ci.yml`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories. T005 depends on T004; T006 depends on T005.
- **User Stories (Phase 3–5)**: All depend on Foundational completion.
  - US1 (P1) is the MVP and should land first (session persistence is its core).
  - US2 (P1) and US3 (P2) depend on Foundational; US2/US3 also reuse the session `reload`/`signOut` wired in US1's T018 but are otherwise independent.
- **Polish (Phase 6)**: Depends on the targeted user stories being complete.

### Key Cross-Task Dependencies

- T016 → T017 → T018 (family resolver → bootstrap → provider wiring)
- T018 consumed by T019 (sign-in), T025 (verify-email)
- T023 (password-policy) consumed by T024 (sign-up) and T028 (reset-password)
- T005 consumed by T029 (sign-out action)

### Parallel Opportunities

- Setup: T002, T003 in parallel after T001.
- Foundational: T007–T012 in parallel after T006 (distinct route files).
- US1 tests T013–T015 in parallel; US2 tests T021–T022 in parallel; US3 tests T026–T027 in parallel.
- Polish: T031, T032, T034, T035, T036 in parallel.

---

## Parallel Example: User Story 1 tests

```bash
# After Foundational, launch US1 tests together (they must fail first):
Task: "Unit test cold-start restore in src/features/auth/session/__tests__/session-bootstrap.test.ts"
Task: "Unit test refresh single-flight in src/features/auth/api/__tests__/refresh-interceptor.test.ts"
Task: "Component test protected-route redirect in app/(app)/__tests__/protected-route.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: Setup (test harness).
2. Phase 2: Foundational (SessionProvider + route skeleton) — CRITICAL, blocks everything.
3. Phase 3: US1 (sign-in + cold-start persistence + transparent refresh + protected routes).
4. **STOP and VALIDATE**: force-close/reopen restores session; expired token refreshes silently.
5. Demo the MVP.

### Incremental Delivery

1. Setup + Foundational → skeleton ready.
2. US1 → test independently → demo (MVP).
3. US2 → registration + password feedback + OTP → demo.
4. US3 → reset + secure logout → demo.
5. Polish → privacy test, typecheck/test gates, device validation.

---

## Notes

- [P] = different files, no dependencies on incomplete tasks.
- No API/contract changes this slice; `family.ts` only *reads* `/families/me` (Principle I — never sends `familyId`).
- Tokens never enter React state or logs (data-model INV-1/2, FR-006).
- Onboarding is a placeholder here; full Create/Join UI is FAM-9.
- Commit after each task or logical group; verify tests fail before implementing.

---

## Phase 7: Convergence

> Appended by `/speckit-converge` — remaining work to fully satisfy the spec Edge Cases.
> Baseline P1–P3 functionality is implemented and covered by tests; these close two
> edge-case behaviors that are specified but not yet realized in code.

- [X] T038 Surface an "expired session" reason from `bootstrapSession` through `SessionState` to `app/(auth)/sign-in.tsx` and display "Your session has expired. Please sign in again." on arrival after a revoked/invalid refresh token clears the session on cold start per spec: Edge Cases (revoked refresh cold start) (partial)
- [X] T039 Realize the pending-offline mode: propagate bootstrap's `offline` result through `SessionProvider` (currently dropped in `session-context.tsx`) and reattempt session restoration when connectivity returns, instead of routing straight to sign-in on a network failure during restore per spec: Edge Cases (network failure during refresh) (partial)
