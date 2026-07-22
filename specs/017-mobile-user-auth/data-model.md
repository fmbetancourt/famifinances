# Phase 1 · Data Model: Mobile User Authentication & Access Control (FAM-8)

This is a **client-side** feature: there is no database schema. The "entities" are the in-memory
session model and the on-device secure storage. Shared wire DTOs are reused verbatim from
`@famifinances/contracts` (no new or changed contract).

## Client Entities

### SessionState (in-memory, React context)

The single source of truth for routing and identity. Held in a `SessionProvider`; **never persisted
to unencrypted storage** and **never logged** (FR-006, Principle II).

| Field      | Type                                                      | Notes |
|------------|----------------------------------------------------------|-------|
| `status`   | `'loading' \| 'authenticated' \| 'unauthenticated'`      | Drives root/group routing. `loading` covers cold-start restore so no protected screen flashes. |
| `user`     | `AccountSummary \| null`                                  | Identity from `GET /auth/me`; `null` unless `authenticated`. |
| `familyId` | `string \| null`                                         | From `GET /families/me`; `null` ⇒ route to onboarding (FR-007). |

> **Token fields are intentionally excluded.** The spec's conceptual "Session State" lists
> `accessToken`/`refreshToken`; on the client these are satisfied by **SecureStore** (below), not
> React state, to minimize leak surface (research D4). The context exposes only non-secret, derived
> status/identity.

**State transitions**

```text
              cold start / bootstrap
  (loading) ──────────────────────────► /auth/me via authFetch (auto-refresh on 401)
     │                                        │
     │                             success ───┼─► /families/me
     │                                        │        ├─ 2xx ─► authenticated, familyId set   → (app)
     │                                        │        └─ 403/404 ─► authenticated, familyId=null → (family)/onboarding
     │                                        │
     │                             401/403 (refresh failed) ─► clearTokens() ─► unauthenticated → (auth)/sign-in ("session expired")
     │                             network error ───────────► unauthenticated (offline, retriable; tokens kept)
     │
  sign-in / verify success ─► saveTokens() ─► re-bootstrap identity+family ─► authenticated
  sign-out ─────────────────► revoke + clearTokens() ─► unauthenticated → (auth)/sign-in
```

### SecureTokenStore (on-device, `expo-secure-store`)

Hardware-backed encrypted storage; the **only** persisted state (FR-001, FR-006). Managed by the
existing `storage/secure-token-store.ts` (unchanged).

| Key                | Value                 | Lifecycle |
|--------------------|-----------------------|-----------|
| `ff_access_token`  | access JWT (`string`) | written on login/verify/refresh; cleared on sign-out / refresh-failure |
| `ff_refresh_token` | refresh token (`string`) | rotated on each refresh; cleared on sign-out / refresh-failure |

### PasswordPolicy (pure validator, `session/password-policy.ts`)

Client-side mirror of the API policy for **real-time feedback** (FR-003, US2-AS3). Pure and
synchronous; the server remains the source of truth.

| Rule id       | Requirement                     |
|---------------|---------------------------------|
| `minLength`   | ≥ 12 characters                 |
| `uppercase`   | at least one A–Z                |
| `lowercase`   | at least one a–z                |
| `number`      | at least one 0–9                |
| `special`     | at least one non-alphanumeric   |

`evaluate(password: string): { valid: boolean; missing: PasswordRuleId[] }` — the UI renders each
unmet rule as a text item (never color alone, Principle VII).

## Reused Wire DTOs (`@famifinances/contracts`, unchanged)

- **`AccountSummary`** `{ accountId; email; emailVerified }` — from `/auth/register`, `/auth/me`,
  `/auth/email/verify`.
- **`TokenPair`** `{ accessToken; refreshToken; tokenType: 'Bearer'; expiresIn }` — from `/auth/login`,
  `/auth/token/refresh`.
- **`FamilySummary` / `FamilyDetail`** `{ familyId; name; role; … }` — from `GET /families/me`; only
  `familyId` presence is consumed by this slice.
- **`LoginRequest`, `RegisterRequest`, `RefreshRequest`, `EmailRequest`, `ResetConfirmRequest`,
  `FieldError`, `ValidationErrorBody`** — request/error shapes already wired in `api/client.ts`.

## Validation & Invariants

- **INV-1** (Principle II): No field of `SessionState` ever contains a raw token; a test asserts the
  auth code path writes no token/password to `console`.
- **INV-2** (Principle I): The app issues **no** request carrying a client-supplied `familyId`;
  membership is read-only from `/families/me`.
- **INV-3** (FR-002): At most one refresh rotation is in flight; concurrent 401s coalesce (already
  enforced by `refresh-interceptor.ts`, covered by a new test).
- **INV-4** (SC-004): No screen under `(app)` renders while `status !== 'authenticated'`.
