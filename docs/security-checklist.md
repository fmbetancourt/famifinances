# Pre-Pilot Security Checklist (SEC-01)

**Purpose**: The operational security gate that MUST be satisfied and recorded before any external family joins
the pilot (constitution Principle II; SEC-01 US6 / FR-011). The automated controls (security headers, CORS,
body limits, credential rate limits, error/log/secret hygiene, dependency audit) are covered by code + CI; this
document captures the **manual** items and any accepted risks.

## 1 · Secrets outside the repository

- [ ] No secret is committed to the repo; all secrets come from the environment and are validated at startup
      (`apps/api/src/config/env.validation.ts` — required `MONGODB_URI`, `JWT_SECRET` fail fast if missing).
- [ ] Production secrets are stored in the deployment platform's secret manager (not in `.env` files in the
      image).

**Evidence / notes**: _record who verified and when._

## 2 · Backups with a tested restore

- [ ] Automated backups of the production database are configured (managed provider snapshot or scheduled dump).
- [ ] A **restore has been performed and verified** into a scratch environment (data readable, app boots).

**Evidence / notes**: _record the restore date, who performed it, and the outcome — this is a hard pilot gate._

## 3 · Transport encryption (TLS)

- [ ] TLS is enforced end-to-end at the managed platform; plain-HTTP is redirected or rejected.
- [ ] HSTS is served by the API (SEC-01 headers) and the platform does not downgrade it.

**Evidence / notes**: _record the platform TLS configuration checked._

## 4 · Accepted risks

### 4.1 · Register account-enumeration (accepted)

`POST /api/v1/auth/register` returns `409` when the email is already registered. This **reveals that an account
exists**, but is an **accepted tradeoff**: the user needs to know to sign in instead. Password reset stays
uniform (no enumeration). Revisit if abuse is observed.

### 4.2 · Dependency advisories

The CI "Dependency audit" step runs `pnpm audit --audit-level=high` on every build and **reports** advisories;
it is currently **non-blocking** because the monorepo tree carries pre-existing high advisories from the
**Expo/React-Native mobile app (not deployed)** and **build tooling** (`@nestjs/cli` → glob/tmp/picomatch),
plus a few unused API transitives (`multer` via platform-express, `lodash` via `@nestjs/config`). None of these
are on the **deployed API request path**.

**Pre-pilot review (required)**: review the latest audit output and confirm no high/critical advisory affects a
**runtime API code path**. Record the review below. When the deployed API surface is advisory-free, flip the CI
step to blocking (remove `continue-on-error`) — tracked in the QLT track.

| CVE / GHSA id | Package | On API runtime path? | Rationale / disposition | Reviewer | Review date |
|---------------|---------|----------------------|-------------------------|----------|-------------|
| _(review latest `pnpm audit` output before pilot)_ | — | — | — | — | — |

## Sign-off

- [ ] All of §1–§3 satisfied and §4 risks reviewed. **Approver**: ______  **Date**: ______
