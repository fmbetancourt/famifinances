# Quickstart · Validating Mobile Auth & Session (FAM-8)

Runnable validation guide for FAM-8. It proves the three user stories and the four success criteria
end-to-end. Implementation detail lives in `data-model.md`, `contracts/session-provider.md`, and
(after `/speckit-tasks`) `tasks.md`.

## Prerequisites

- API running with auth + families modules: `pnpm --filter @famifinances/api start:dev`
  (defaults to `http://localhost:3000/api/v1`).
- Mobile env (optional): set `EXPO_PUBLIC_API_BASE` if the API is not on `localhost:3000/api/v1`.
  On a physical device, point it at your machine's LAN IP.
- `pnpm install` at the repo root (adds the new mobile test devDependencies).

## Run the app

```bash
pnpm --filter @famifinances/mobile start          # Expo dev server
# then press 'a' (Android), 'i' (iOS), or scan the QR on a physical device (DoD)
```

## Automated checks

```bash
pnpm --filter @famifinances/mobile typecheck      # TS strict, no `any`
pnpm --filter @famifinances/mobile test           # jest-expo: session, password-policy, interceptor
```

## Scenario validation

### US1 — Sign in & secure session persistence (P1)

1. Launch the app unauthenticated → you land on **Sign in**.
2. Enter valid credentials → you land on the main screen (or **onboarding** if the account has no
   family). **(SC-001: within ~1.5 s.)**
3. **Force-close** and reopen the app → you land **directly** on the main/onboarding screen with **no
   credential prompt** (FR-008 cold-start restore).
4. Let the access token expire, then trigger any authenticated action → it succeeds without a
   re-login (FR-002 transparent refresh). **(SC-002.)**
5. While signed out, try to deep-link a protected route → you are redirected to **Sign in**.
   **(SC-004.)**

### US2 — Registration & email verification (P1)

1. On **Sign up**, type a weak password → the screen lists the **missing** requirements in real time
   (FR-003); the submit stays disabled/blocked until all rules pass.
2. Submit a valid email + a ≥12-char complex password → you are routed to **Verify email**.
3. Enter the 6-digit OTP → the account becomes verified and you proceed to the main screen (or
   onboarding if no family, FR-007).

### US3 — Password reset & secure logout (P2)

1. **Forgot password** → enter your email → you always see the same confirmation (no enumeration) and
   land on **Reset password**.
2. Enter the emailed code + a new valid password → success routes you to **Sign in**; sign in with
   the new password works.
3. From the main screen, tap **Sign out** → tokens are wiped from SecureStore, the server session is
   revoked, and you return to **Sign in**. Reopening the app does **not** restore the session.

### Edge cases (spec)

- **Airplane mode during cold-start refresh** → the app does not wipe credentials; it shows a
  retriable offline/unauthenticated state and recovers when connectivity returns.
- **Revoked refresh token on cold start** → `/auth/token/refresh` returns 401/403 → SecureStore is
  cleared → **Sign in** shows "Your session has expired. Please sign in again."
- **Concurrent calls during token expiry** → a single refresh runs; parallel requests coalesce and
  all resolve with the rotated token (interceptor single-flight).

## Expected outcomes → Success Criteria

| Check | Criterion |
|-------|-----------|
| Valid sign-in reaches main/onboarding within ~1.5 s | SC-001 |
| Expired access token refreshes with no lost request / no re-login | SC-002 |
| No token/password/financial data in logs (test + manual `console` review) | SC-003 |
| Protected routes unreachable while unauthenticated | SC-004 |

## Onboarding note (scope)

`(family)/onboarding.tsx` is a **placeholder** in FAM-8 — it only proves FR-007 navigation. The full
Create-family / Join-by-code UI ships in **FAM-9**.
