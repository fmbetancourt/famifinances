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

QLT-01 replaced the report-only audit with `node scripts/audit-api.mjs` (CI, **blocking**): it fails the build
on any high/critical advisory in the **`apps/api` production dependency set** (the deployed server), while
mobile-app and `devDependency` advisories are **reported but non-blocking**. A NEW `apps/api`-prod advisory not
listed below fails CI.

**Accepted `apps/api`-prod advisories** (baselined in `package.json` `pnpm.auditConfig.ignoreGhsas`). All are
**transitive** via `@nestjs/*` with no upstream fix and **not on the deployed request path** (no file uploads →
`multer` unused; `lodash`/`js-yaml` are transitive utilities). Re-review each release and drop from the list
when an upstream fix lands.

| GHSA id | Package | Via | On request path? | Rationale | Reviewer | Review date |
|---------|---------|-----|------------------|-----------|----------|-------------|
| GHSA-xf7r-hgr6-v32p | multer | @nestjs/platform-express | No (no uploads) | transitive, no upstream fix | _pending_ | 2026-07-20 |
| GHSA-v52c-386h-88mc | multer | @nestjs/platform-express | No (no uploads) | transitive, no upstream fix | _pending_ | 2026-07-20 |
| GHSA-5528-5vmv-3xc2 | multer | @nestjs/platform-express | No (no uploads) | transitive, no upstream fix | _pending_ | 2026-07-20 |
| GHSA-72gw-mp4g-v24j | multer | @nestjs/platform-express | No (no uploads) | transitive, no upstream fix | _pending_ | 2026-07-20 |
| GHSA-r5fr-rjxr-66jc | lodash | @nestjs/config | No | transitive utility | _pending_ | 2026-07-20 |
| GHSA-52cp-r559-cp3m | js-yaml | @nestjs/* | No | transitive utility | _pending_ | 2026-07-20 |

**Pre-pilot review (required)**: confirm the accepted list above is still justified and that `audit-api.mjs`
passes (no unaccepted `apps/api`-prod advisory).

## Sign-off

- [ ] All of §1–§3 satisfied and §4 risks reviewed. **Approver**: ______  **Date**: ______
