# Physical-Device Validation Checklist: Mobile User Authentication (`017-mobile-user-auth`)

**Purpose**: Manual, on-device Definition-of-Done validation for FAM-8 (Constitution Principle IV —
mobile UX changes MUST be validated on a physical device). Covers **task T033** and the SC-001
latency measurement that automated tests cannot assert.
**Created**: 2026-07-22
**Feature**: [spec.md](../spec.md) · run guide: [quickstart.md](../quickstart.md)
**Scope**: iOS and Android physical devices (repeat the flows on at least one of each where available).

## Prerequisites

- [ ] DV001 API reachable from the device: `EXPO_PUBLIC_API_BASE` points at the machine's LAN IP (not `localhost`), and `apps/api` is running with the auth + families modules.
- [ ] DV002 App launched on a physical device via `pnpm --filter @famifinances/mobile start` (Expo Go or a dev build), not only a simulator/emulator.
- [ ] DV003 A test account exists (register + verify) and a second account **without** a family is available for the onboarding path.

## US1 — Sign in & secure session persistence (P1)

- [ ] DV004 Valid credentials on `sign-in.tsx` navigate to the main screen (or onboarding if no family). [US1-AC1, FR-007]
- [ ] DV005 **SC-001 latency**: with a stopwatch (or screen recording), the time from the sign-in submit tap to the first rendered destination screen is **≤ 1.5 s** on the reference network (home Wi-Fi or 4G/LTE, RTT ≤ 100 ms). Record the measured value: ______ s. [SC-001]
- [ ] DV006 Force-close the app and reopen it → lands **directly** on the main/onboarding screen with **no** credential prompt (session restored from SecureStore). [FR-008, US1-AC1]
- [ ] DV007 **Transparent refresh**: after the access token expires (wait out its TTL, or shorten it in a dev API), tap "Sync session" on the home screen → it succeeds with **no** re-login and **no** visible error. [FR-002, SC-002, US1-AC2]
- [ ] DV008 While signed out, deep-link/navigate to a protected route → redirected to sign-in. [SC-004, US1-AC3]

## US2 — Registration & email verification (P1)

- [ ] DV009 On `sign-up.tsx`, a weak password lists the **missing** requirements in real time and the submit button stays disabled until all rules pass. [FR-003, US2-AS3]
- [ ] DV010 A valid email + ≥12-char complex password routes to `verify-email.tsx`; entering the 6-digit OTP verifies the account and routes to the app or onboarding. [US2-AS1, US2-AS2, FR-007]

## US3 — Password reset & secure logout (P2)

- [ ] DV011 "Forgot password" shows the same confirmation regardless of whether the email exists (no enumeration), then `reset-password.tsx` accepts the code + a new valid password (real-time policy feedback shown). Sign in with the new password works. [US3-AC1, FR-003]
- [ ] DV012 "Sign out" wipes local tokens and returns to sign-in; reopening the app does **not** restore the session. [US3-AC2, FR-005]

## Edge cases & security

- [ ] DV013 **Revoked/expired session**: with a revoked refresh token, a cold start clears SecureStore and shows "Your session has expired. Please sign in again." on the sign-in screen. [spec Edge Cases, FR-011-adjacent]
- [ ] DV014 **Offline restore**: enable airplane mode, then cold-start → credentials are **not** wiped; an offline notice is shown. Restore connectivity and return the app to the foreground → the session is reattempted and restored silently. [spec Edge Cases]
- [ ] DV015 **Concurrent expiry**: trigger several protected requests at once on an expired access token → all succeed after a **single** refresh (no logout / no lost payloads). [FR-002, spec Edge Cases]
- [ ] DV016 **No secret leakage**: with the dev console/logcat attached during the full flow, confirm no password or token value appears in logs. [FR-006, SC-003]

## Accessibility (Principle VII)

- [ ] DV017 All error/status messages are conveyed with text (and an icon), never color alone; each screen presents a single primary action.

## Sign-off

- [ ] DV018 All applicable items above pass on a physical device; note device model(s) and OS version(s): ______________________. This closes task **T033** and the DoD device gate for FAM-8.
