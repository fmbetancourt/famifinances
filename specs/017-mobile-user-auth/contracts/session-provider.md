# Contract · Mobile Session Provider & API Consumption (FAM-8)

This feature exposes **no new HTTP contract**. Its "contract" is twofold: (1) the **in-app
Session API** other screens depend on, and (2) the **existing API endpoints** the mobile app
consumes (all already implemented in `apps/api`, documented in OpenAPI). Both are pinned here so
FAM-9 and later mobile features build against a stable surface.

## 1. In-app Session API (`src/features/auth/session/session-context.tsx`)

```ts
// Public surface consumed by screens and route-group layouts.
export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';
// Why an unauthenticated status arose (spec Edge Cases): none | expired | offline.
export type SessionReason = 'none' | 'expired' | 'offline';

export interface SessionState {
  readonly status: SessionStatus;
  readonly user: AccountSummary | null;   // from @famifinances/contracts; null unless authenticated
  readonly familyId: string | null;       // null ⇒ route to onboarding (FR-007)
  readonly reason: SessionReason;          // 'expired' ⇒ show "session expired"; 'offline' ⇒ reattempt on foreground
}

export interface SessionApi extends SessionState {
  /** Persist tokens then (re)load identity + family membership. Called by sign-in / verify-email. */
  establishSession(tokens: TokenPair): Promise<void>;
  /** Re-run identity + membership resolution against the API (post-verify, manual refresh). */
  reload(): Promise<void>;
  /** Best-effort server revocation, clear SecureStore, → unauthenticated. Called by Sign Out. */
  signOut(): Promise<void>;
}

export function SessionProvider(props: { children: React.ReactNode }): JSX.Element;
export function useSession(): SessionApi;   // throws if used outside <SessionProvider>
```

**Guarantees**

- `useSession()` never exposes a raw access/refresh token (Principle II / FR-006).
- `establishSession` and `reload` set `status` to `authenticated` only after `/auth/me` succeeds.
- `familyId` reflects the last `/families/me` result; `403`/`404` ⇒ `null`.
- `signOut` always ends in `status === 'unauthenticated'` and cleared SecureStore, even if the
  server revocation call fails (best-effort), reusing `hooks/use-sign-out.ts` semantics.

## 2. Consumed API endpoints (existing — reference only, no change)

| Method & path                     | Purpose in this slice                          | Auth | Notes |
|-----------------------------------|------------------------------------------------|------|-------|
| `POST /auth/register`             | US2 sign-up                                     | none | 201 `AccountSummary`; then `verify-email` |
| `POST /auth/login`                | US1 sign-in                                     | none | 200 `TokenPair` → `establishSession` |
| `POST /auth/token/refresh`        | FR-002 transparent rotation                     | none (refresh token in body) | single-flight in `refresh-interceptor.ts` |
| `POST /auth/logout`               | US3 sign-out revocation                          | Bearer | 204; body carries the refresh token |
| `GET  /auth/me`                   | Identity for `SessionState.user`                | Bearer | 200 `AccountSummary`; drives `authenticated` |
| `POST /auth/email/verify`         | US2 OTP verification                             | Bearer | 200 `AccountSummary` → `reload` |
| `POST /auth/email/verify/resend`  | US2 resend code                                  | Bearer | 202 |
| `POST /auth/password/reset/request` | US3 forgot password                            | none | 202 uniform (no enumeration) |
| `POST /auth/password/reset/confirm` | US3 reset password                             | none | 204; all sessions revoked server-side |
| `GET  /families/me`               | **FR-007** family-membership resolution          | Bearer | 2xx ⇒ has family; **403/404 ⇒ onboarding** |

**Family-resolution contract (FR-007)**

```text
establishSession / reload / bootstrap:
  GET /auth/me           2xx → user set
  GET /families/me       2xx → familyId = body.familyId → route (app)
                         403/404 → familyId = null       → route (family)/onboarding
                         network error → surfaced as retriable offline state
```

## Contract Tests (mobile, `jest-expo`)

- `establishSession` with a valid `TokenPair` → `status` becomes `authenticated` and `user` is set.
- `/families/me` → 403 ⇒ `familyId === null` (onboarding path); → 200 ⇒ `familyId` populated.
- `useSession()` outside `<SessionProvider>` throws.
- `signOut()` clears SecureStore and sets `unauthenticated` even when `POST /auth/logout` rejects.
- No `console.*` call in the session/auth path receives a token or password string (FR-006).
