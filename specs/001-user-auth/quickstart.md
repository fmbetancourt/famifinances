# Quickstart & Validation: AUTH-01

**Feature**: User Authentication & Access Control
**Date**: 2026-07-16

This guide proves AUTH-01 works end-to-end. It references [data-model.md](./data-model.md) and
[contracts/auth.openapi.yaml](./contracts/auth.openapi.yaml) rather than duplicating them. It is a
run/validation guide — implementation belongs in `tasks.md` and the implementation phase.

## Prerequisites

- Node.js 20 LTS and pnpm installed.
- A running MongoDB (local Docker container or an Atlas dev cluster).
- Environment variables (never committed): `MONGODB_URI`, `JWT_SECRET`, `ACCESS_TOKEN_TTL` (e.g. `900`),
  `REFRESH_TOKEN_TTL` (e.g. `2592000`), `OTP_TTL` (e.g. `900`), `MAIL_PROVIDER_API_KEY`,
  `MAIL_FROM_ADDRESS`.
- For pilot email delivery, a configured Resend account and verified sending domain (see research R5).
  In local/dev, the MailPort uses a console stub that logs message metadata only — it does **not** log
  the OTP itself (FR-027 forbids logging codes). To obtain a code for manual testing, configure a real
  mail provider; the automated e2e tests read codes via a test-only `MailPort` (see `MailCollector`).

## Setup

```bash
pnpm install
# start MongoDB (example)
docker run -d --name famifinances-mongo -p 27017:27017 mongo:7
# run the API
pnpm --filter @famifinances/api start:dev
```

## Automated validation (authoritative)

Run the backend test suites; these encode the acceptance scenarios and constitution gates.

```bash
pnpm --filter @famifinances/api test        # unit
pnpm --filter @famifinances/api test:e2e    # integration/e2e (auth.e2e-spec, authorization.e2e-spec)
# Note: the mobile package has no automated tests yet — the auth screens/hooks are
# source-only in this slice; a mobile test harness is a follow-up.
```

Required passing checks (map to spec):

- **US1 Register**: valid registration → `201`; duplicate email → non-committal `409` (FR-004);
  weak password → `400`; malformed email → `400`.
- **US2 Sign in**: correct credentials → `200` token pair; wrong password and unknown email → identical
  `401` (SC-008); repeated failures → `429`/lockout (FR-013).
- **US3 Protected access**: no token → `401`; expired/tampered token → `401`; valid token → `200` and
  identity comes from the token `sub` even when a foreign `accountId` is supplied in the body
  (authorization test, FR-011/SC-004).
- **US4 Refresh**: expired access + valid refresh → new pair; reused refresh → `401` and chain revoked
  (FR-008/FR-009).
- **US5 Logout**: after logout the refresh token is rejected (FR-012).
- **US6 Verify email**: correct code → `200`, `emailVerified=true`; unverified account blocked from a
  family/financial action (soft gate, FR-019); expired/used/wrong code → `400`; resend invalidates the
  previous code (FR-021).
- **US7 Reset password**: reset request uniform for registered/unregistered email (SC-011); valid code +
  strong new password → `204`, all prior sessions rejected (SC-010), email marked verified (FR-025);
  invalid/expired/used code → `400`.
- **Privacy gate (SC-007)**: a log-inspection test asserts no password, token, code, or monetary value
  appears in logs across the full flow.
- **Performance budgets (SC-001/SC-002)**: a latency smoke check asserts the registration→signed-in and
  sign-in server flows stay within the SC-001 (<2 min) / SC-002 (<30 s) budgets. These are coarse guards,
  not load tests; end-to-end UX timing is also observed during the invited pilot.

## Manual smoke walkthrough (optional)

Using the OpenAPI contract (Swagger UI at `/api/docs` when the API runs), or the mobile app.
Note: obtaining the OTP for steps 5 and 7 requires a configured mail provider — the dev stub does not
expose the code (FR-027). For a fully self-contained run, use the automated e2e suite instead.

1. `POST /auth/register` with a new email + strong password → `201`. A verification code is emailed
   (delivered by your configured provider; the dev stub logs metadata only).
2. `POST /auth/login` → copy `accessToken` + `refreshToken`.
3. `GET /auth/me` with the bearer token → confirm `emailVerified: false`.
4. Attempt a family/financial action (once FAM-01 exists) → blocked pending verification.
5. `POST /auth/email/verify` with the OTP → `200`, `emailVerified: true`.
6. `POST /auth/token/refresh` with the refresh token → new pair; replay the old refresh token → `401`.
7. `POST /auth/password/reset/request` → note new OTP; `POST /auth/password/reset/confirm` → `204`;
   confirm the pre-reset tokens now return `401`.

## Expected outcome

All automated suites pass, the OpenAPI contract matches the implemented endpoints, and the privacy and
authorization gates hold. At that point AUTH-01 satisfies its Success Criteria and is ready to support
FAM-01 (family creation/join builds on the session identity established here).

## Validation run (recorded)

Executed on 2026-07-16 via `mongodb-memory-server` (no external DB), stub mail adapter:

- **Unit**: 3 suites, 10 tests passing.
- **E2E**: 17 suites, 31 tests passing (register, login, protected access, refresh + reuse detection,
  logout, email verification + soft gate, password reset, OpenAPI parity, and no-secrets-in-logs).
- **Typecheck** (`tsc --noEmit`, strict): PASS. **Build** (`nest build`): PASS.
- **Latency smoke**: register→signed-in ~245 ms (budget 120 000 ms, SC-001); sign-in ~39 ms
  (budget 30 000 ms, SC-002).
- **No-secrets-in-logs (SC-007)**: PASS — no password, token, or OTP appeared in captured stdout/stderr
  across the full flow.

Mobile screens (`apps/mobile`) are implemented as source aligned with the shared contracts but were
not built/run here (Expo toolchain not installed in this environment).
