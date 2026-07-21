# Data Model: Quality Gates & Test Reliability (QLT-01)

**Feature**: QLT-01 · Quality gates & test reliability
**Date**: 2026-07-20

QLT-01 adds **no persisted collection** and no product entity. Its "model" is the **quality-gate configuration**
(version-controlled) plus the **test-isolation contract**. This document defines those.

## Configuration: Quality-Gate Definition *(version-controlled)*

| Element | Where | Content |
|---------|-------|---------|
| Required checks | `.github/workflows/ci.yml` (`quality-gates` job) + `docs/quality-gates.md` | typecheck, lint, unit tests, e2e tests, build, coverage (high-risk), scoped audit |
| Coverage scope | `apps/api/jest.cov.config.js` (`collectCoverageFrom`) | family scope/role **guards**, family-scoped **`*.repository.ts`**, **balance/derivation services** |
| Coverage source | `apps/api/jest.cov.config.js` (single config, `testMatch` unit + e2e) | **unit + e2e** specs run together, merged coverage (so unit-tested pure logic and e2e-tested guards/repos both count) |
| Coverage threshold | `apps/api/jest.cov.config.js` (`coverageThreshold`) | **90%** statements / branches / functions / lines on the scope |
| Audit scope | `scripts/audit-api.mjs` | blocks on `apps/api` **production** deps; reports mobile + `devDependencies` |
| Accepted risks | `package.json` `pnpm.auditConfig.ignoreGhsas`/`ignoreCves` (mirrored in `docs/security-checklist.md`) | the only way an `apps/api`-prod advisory is allowed through |
| Time budget | `docs/quality-gates.md` | the agreed full-gate budget (≤ ~10 min) |

## Test reliability contract *(e2e)*

- **One shared in-memory mongod** (started once in `global-setup.js`), unchanged.
- **Flake mitigation**: `jest.retryTimes(2)` (`test/retry-flaky.js`, via `setupFilesAfterEnv`) re-runs a
  transiently-failed test; a **CI step-level re-run** (fresh process, up to 3 attempts) covers the rare
  `beforeAll` failure `jest.retryTimes` cannot catch; `workerIdleMemoryLimit` is kept as hygiene.
- **Guarantee**: a transiently-failed test does not leave the suite red (green in practice), while a genuine
  defect fails every attempt (FR-001/FR-002). The residual flake is **process-level resource pressure**, not DB
  state — four isolation approaches did not remove it (documented in `docs/quality-gates.md`).

## High-risk coverage scope (the ≥ 90% set)

| Group | Representative paths |
|-------|----------------------|
| Authorization guards | `src/families/guards/family-scope.guard.ts`, `family-role.guard.ts` |
| Family-scoped repositories | `src/**/**.repository.ts` (accounts, financial-accounts, categories, movements, transfers, budgets, families, memberships) |
| Balance / derivation services | `src/movements/movement-balance.service.ts`, `movement-spend.service.ts`, `movement-summary.service.ts`, `src/transfers/transfer-balance.service.ts`, `src/financial-accounts/financial-accounts.service.ts`, `src/budgets/budgets.service.ts` |

(The exact glob list lives in `jest.cov.config.js`; it may be tuned in implementation so the scope matches the
authorization + money-movement code and no more.)

## Validation rules

- The coverage run **fails** if any metric on the scope is below 90% (FR-006).
- The scoped audit **fails** on any high/critical advisory in the `apps/api` prod set not in the accepted-risk
  allowlist (FR-004/FR-005); it never fails on mobile/dev-only advisories but always prints them.
- The isolation setup MUST assign a **unique** db per file (collision-free); a fixed shared db is a defect.
- No secret, monetary amount, or note content appears in coverage/audit/test output (FR-007).

## Notes

- **No product code or persistence changes** — test config, a coverage config, a CI script, and docs.
- The gate configuration is the single source of truth for "what green means"; branch protection makes the
  `quality-gates` job required to merge.
