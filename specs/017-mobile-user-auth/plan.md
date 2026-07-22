# Implementation Plan: Mobile User Authentication & Access Control (AUTH-02 / FAM-8)

**Branch**: `017-mobile-user-auth` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-mobile-user-auth/`

## Summary

FAM-8 **completes the mobile authentication flow and session persistence** on top of the
already-shipped API auth surface (feature 001) and family surface (feature 003). The mobile app
already has the five auth screens and a working API-client layer (`login`, `register`, refresh
rotation, verification, secure token storage, sign-out). What is missing — and what this slice
delivers — is the **glue that makes it an app**: a **root routing skeleton** (`app/_layout.tsx`,
route groups), a **global Session State** provider that restores the session from SecureStore on
**cold start** (FR-008) and drives navigation, a **protected route group** that keeps
unauthenticated users out (SC-004), **client-side password-complexity validation** with real-time
feedback (FR-003), and a **family-membership redirect** to onboarding when the signed-in user has
no family (FR-007), resolved via the existing `GET /families/me` endpoint.

Two scope decisions frame the slice: (a) the **Family Onboarding screen is a placeholder route**
here — its full Create/Join UI is deferred to **FAM-9**; 017 only guarantees FR-007 navigation
lands somewhere sensible. (b) This slice **introduces the mobile test harness** (`jest-expo` +
React Native Testing Library) and covers the auth/session logic, moving `apps/mobile` off
source-only per Constitution Principle IV.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict, no `any`); React 18.2; React Native 0.74; Expo SDK 51;
Expo Router 3.5; pnpm 10; Node 20 LTS (tooling).

**Primary Dependencies**: `expo-router` (file-based routing + typed routes), `expo-secure-store`
(hardware-backed token storage — already a dependency), `@famifinances/contracts` (shared DTOs).
**New devDependencies only** for testing: `jest-expo`, `@testing-library/react-native`, `jest`,
`@types/jest`. **No new runtime dependency** — the session layer is built from React context + the
existing fetch client.

**Storage**: On-device `expo-secure-store` (OS keychain / keystore) for the access + refresh token
pair only. No other local persistence; the session `user`/`familyId` is derived at runtime from the
API (`/auth/me`, `/families/me`), never cached to unencrypted storage (FR-006).

**Testing**: `jest-expo` preset + React Native Testing Library. Unit/logic coverage for the session
reducer/bootstrap, the password-complexity validator, and the refresh interceptor's single-flight
rotation; component coverage for sign-in and sign-up validation feedback. Physical-device validation
per DoD for the cold-start and expired-token flows.

**Target Platform**: iOS and Android via Expo (mobile-first). `apps/mobile` only — **no API change**
this slice (both `/auth/me` and `/families/me` already exist).

**Project Type**: Mobile + API monorepo (`apps/mobile`, `apps/api`, `packages/contracts`); this
feature touches **`apps/mobile` only**.

**Performance Goals**: Cold-start session restore + first navigation within **1.5 s** on the SC-001
reference network (home Wi-Fi or 4G/LTE, RTT ≤ 100 ms). Bootstrap issues at most two parallelizable requests (`/auth/me`,
`/families/me`); a splash/loading state (`isLoading`) covers the gap so no protected screen flashes.

**Constraints**: Never write passwords/tokens/financial data to logs or unencrypted storage (FR-006,
Principle II); family scope is derived from the session, never client-supplied (Principle I — the
mobile only *reads* `/families/me`, it never sends a `familyId`); no biometrics for MVP (FR-008);
transparent single-flight refresh with request retry (FR-002); TS strict, no `any`, named exports,
shared contracts (Principle VI).

**Scale/Scope**: One route skeleton (`_layout` files + route groups `(auth)`, `(app)`,
`(family)`), one `SessionProvider` context + bootstrap, one password-policy validator wired into
sign-up (and reset-password), one placeholder onboarding route, and the mobile Jest harness. Five
existing screens get minimal wiring changes (navigation via session, validation feedback); the
existing API-client/interceptor/storage modules are reused as-is.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Assessment | Status |
|---|-----------|------------|--------|
| I | Family Data Isolation (NON-NEGOTIABLE) | The app **never** sends a `familyId`. Membership is read from `GET /families/me`, whose scope the server derives from the session (FamilyScopeGuard). A 403/404 → no family → onboarding. No cross-family data is fetched in this slice. | PASS |
| II | Financial Privacy by Design | Only the token pair touches on-device storage, in SecureStore (hardware-backed). `user`/`familyId` live in memory only. FR-006 forbids logging credentials/tokens; a test asserts the auth paths emit no token/password to `console`. | PASS |
| III | Derived Balance Integrity | No balances/movements in scope; the slice is auth + routing only. No stored balance touched. | PASS (N/A) |
| IV | Test-First & Definition of Done | This slice **adds** the mobile Jest harness and ships tests with the code for the session bootstrap, password validator, and refresh rotation (highest-risk logic). Cold-start + expired-token flows validated on a physical device per DoD (mobile UX change). | PASS |
| V | Modular Monolith Simplicity (YAGNI) | Session state is plain React context + a reducer — **no** Redux/state library, **no** WebSockets/live sync, **no** new runtime dependency. Onboarding is a placeholder (full UI deferred to FAM-9), avoiding speculative scope. | PASS |
| VI | Shared, Documented Contracts | Reuses `@famifinances/contracts` (`AccountSummary`, `TokenPair`, `FamilySummary`). **No contract drift**: FR-007 uses the existing `/families/me` rather than mutating `AccountSummary`. TS strict, no `any`, named exports (except Expo Router's required default screen exports). | PASS |
| VII | Fast & Accessible Capture UX | Each auth screen keeps one primary action; errors use text + icon, never color alone (already implemented, preserved). Password feedback lists missing rules as text. No CLP/amounts in scope. | PASS |

**Result**: PASS — no violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/017-mobile-user-auth/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── session-provider.md   # Mobile session context + API-consumption contract
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created here)
```

### Source Code (repository root)

```text
apps/mobile/
├── app/                              # Expo Router file-based routes
│   ├── _layout.tsx                   # NEW root layout: wraps app in <SessionProvider>, gates on isLoading
│   ├── index.tsx                     # NEW entry redirect: routes by session (app / auth / onboarding)
│   ├── (auth)/
│   │   ├── _layout.tsx               # NEW auth-group Stack; redirects OUT to (app) when authenticated
│   │   ├── sign-in.tsx               # navigate via session, not a hard-coded '/'
│   │   ├── sign-up.tsx               # + real-time password-policy feedback (FR-003)
│   │   ├── verify-email.tsx          # on success: refresh session → route by family
│   │   ├── forgot-password.tsx       # (unchanged)
│   │   └── reset-password.tsx        # + password-policy feedback for newPassword (FR-003)
│   ├── (app)/
│   │   ├── _layout.tsx               # NEW protected group: redirects to sign-in when unauthenticated (SC-004)
│   │   └── index.tsx                 # NEW minimal authenticated home (placeholder main screen) + Sign Out
│   └── (family)/
│       ├── _layout.tsx               # NEW family-onboarding group Stack
│       └── onboarding.tsx            # NEW placeholder (FR-007 target); full Create/Join UI → FAM-9
└── src/features/auth/
    ├── session/                      # NEW session state module
    │   ├── session-context.tsx       # SessionProvider + useSession(); reducer over SessionState
    │   ├── session-bootstrap.ts      # cold-start restore: SecureStore → /auth/me → /families/me
    │   └── password-policy.ts        # FR-003 validator: rules + evaluate() → missing-requirements list
    ├── storage/secure-token-store.ts # (reused)
    ├── api/{client,refresh-interceptor,session,verification}.ts  # (reused)
    └── hooks/{use-sign-out,use-protected-route}.ts               # use-sign-out reused; use-protected-route folded into (app)/_layout
```

**Structure Decision**: Mobile-only slice within the existing Expo Router app. Routing uses three
**Expo Router groups** — `(auth)`, `(app)`, `(family)` — each with a `_layout.tsx` that enforces
its access rule against the shared `SessionState`. The root `_layout.tsx` provides the single
`SessionProvider`, and `index.tsx` is the launch redirect. Auth logic stays under
`src/features/auth/` (feature-first), with a new `session/` sub-module for the state, bootstrap, and
password policy. The existing `use-protected-route` per-screen server round-trip is superseded by the
group-level guard reading `SessionState`, eliminating a network round-trip per protected screen
(supports SC-001).

## Complexity Tracking

> No Constitution violations. No entries required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
