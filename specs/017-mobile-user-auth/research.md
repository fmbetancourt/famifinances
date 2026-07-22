# Phase 0 · Research: Mobile User Authentication & Access Control (FAM-8)

All Technical Context unknowns were resolved by inspecting the existing codebase and the two
clarifications recorded in the spec. There are **no open `NEEDS CLARIFICATION` items**. The three
scope forks below were decided with the product owner on 2026-07-22.

## D1 — Family-membership resolution for FR-007

- **Decision**: After successful sign-in/verification and on every cold start, the app calls the
  existing `GET /families/me`. A `2xx` means the user has a family (→ `(app)`); a `403`/`404` means
  no family (→ `(family)/onboarding`). No new endpoint; **no contract change**.
- **Rationale**: `GET /families/me` already resolves family scope from the session server-side
  (FamilyScopeGuard), which is exactly the Principle I contract. Extending `AccountSummary`/`/auth/me`
  with `familyId` would mutate a shared contract and the API for information already reachable —
  needless drift (Principles V, VI).
- **Alternatives considered**: Add `familyId: string | null` to `AccountSummary` + `AuthenticatedUser`
  + `me` handler (one request at boot). Rejected: cross-feature contract/API change for a marginal
  one-round-trip saving; the two boot requests run in parallel anyway.

## D2 — Family Onboarding screen scope

- **Decision**: 017 ships a **placeholder** onboarding route (`(family)/onboarding.tsx`) as the
  FR-007 navigation target. The full Create-family / Join-by-6-char-code UI is deferred to **FAM-9**.
- **Rationale**: FR-004 scopes 017 to the five auth screens + session; FR-007 only requires that a
  familyless user *lands* in onboarding. The backend (`POST /families`, `POST /families/join`) already
  exists, so FAM-9 is a UI-only follow-up. Keeping 017 a vertical, shippable auth slice honors
  Principle V and the Must-first cadence.
- **Alternatives considered**: Build minimal Create/Join UI now. Rejected: expands 017 beyond the
  auth slice and duplicates planning that belongs to a dedicated family-onboarding mobile feature.

## D3 — Mobile test harness

- **Decision**: Introduce `jest-expo` + `@testing-library/react-native` in `apps/mobile` and cover
  the session bootstrap/reducer, the password-policy validator, and the refresh interceptor's
  single-flight rotation; component tests for sign-in and sign-up validation feedback.
- **Rationale**: Constitution IV mandates tests proportioned to risk; session restoration, token
  rotation, and access gating are the highest-risk logic in the app and are currently untested
  (mobile is source-only). `jest-expo` is the canonical Expo preset and adds **devDependencies only**.
- **Alternatives considered**: Stay source-only + physical-device validation. Rejected: leaves the
  security-critical session/rotation logic without executable regression, which a solo developer on a
  12-week horizon cannot rely on manually (Principle IV rationale).

## D4 — Session state shape & storage boundary

- **Decision**: `SessionState = { status: 'loading' | 'authenticated' | 'unauthenticated'; user:
  AccountSummary | null; familyId: string | null }`. Tokens are **not** held in React state — they
  live only in SecureStore and are read by the fetch client/interceptor on demand.
- **Rationale**: FR-006 / Principle II — keeping raw tokens out of the React tree and any serializable
  state minimizes leak surface (no accidental logging, no persistence to unencrypted storage). The UI
  only needs identity + membership + a coarse status to route; it never needs the token value.
- **Alternatives considered**: Hold `accessToken`/`refreshToken` in context (matches the spec's
  "Session State" entity literally). Rejected on privacy grounds; the entity's token fields are
  satisfied by SecureStore, and context exposes only derived, non-secret status. Documented in
  `data-model.md`.

## D5 — Routing & access enforcement pattern

- **Decision**: Enforce access at the **route-group layout** level. `(app)/_layout.tsx` redirects to
  sign-in when `status === 'unauthenticated'`; `(auth)/_layout.tsx` redirects into `(app)` when
  authenticated; the root `_layout.tsx` renders a loading state while `status === 'loading'` so no
  protected screen renders before the session is known.
- **Rationale**: Expo Router groups + `<Redirect>`/imperative `router.replace` are the idiomatic
  guard mechanism and evaluate once per group entry rather than per screen. This removes the
  per-screen `GET /auth/me` round-trip in the current `use-protected-route`, directly helping SC-001
  and SC-004.
- **Alternatives considered**: Keep the per-screen `useProtectedRoute` hook. Rejected: N extra
  round-trips, flash-of-protected-content risk, and duplicated guard logic across screens.

## D6 — Cold-start refresh & error routing (edge cases)

- **Decision**: On boot, `session-bootstrap` reads tokens from SecureStore, then calls `/auth/me`
  through `authFetch` (which already performs single-flight refresh on 401). If refresh fails with
  401/403, `authFetch` clears SecureStore; bootstrap resolves to `unauthenticated` and the root
  redirect sends the user to sign-in with the "session expired" message. Network failures during
  boot resolve to a retriable `unauthenticated`-but-offline state rather than wiping tokens
  (spec Edge Cases).
- **Rationale**: Reuses the already-implemented and reviewed `refresh-interceptor` (single in-flight
  rotation, concurrent-request coalescing) instead of reimplementing rotation in the bootstrap path.
- **Alternatives considered**: Bespoke refresh in bootstrap. Rejected: duplicates rotation logic and
  risks the token-theft double-use the interceptor already guards against.
