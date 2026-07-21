# Quality Gates Contract (QLT-01)

**Feature**: QLT-01 · Quality gates & test reliability
**Date**: 2026-07-20

QLT-01 exposes **no runtime API** — its contract is the set of **observable gate behaviors** the CI pipeline and
test harness must exhibit. These are the assertions the validation checks against.

## 1 · Reliable e2e (FR-001/FR-002)

| Condition | Expected |
|-----------|----------|
| Full e2e suite on unchanged code | **Green on every run** — a transiently-failed test is retried automatically |
| A transient environmental failure | Absorbed by `jest.retryTimes(2)` + a CI step-level re-run (fresh process) |
| A genuine defect | Fails **every** attempt → the suite stays red (retry does not mask real bugs) |
| A single suite run in isolation | Passes (no cross-suite dependency) |

## 2 · Enforced merge gate (FR-003/FR-008)

| Condition | Expected |
|-----------|----------|
| A change failing typecheck / lint / a test / build | `quality-gates` job **fails** → merge blocked |
| A change passing all required checks | `quality-gates` job **passes** → merge allowed |
| Required-check set + thresholds | Version-controlled in `ci.yml` + `docs/quality-gates.md` |

## 3 · Scoped dependency audit (FR-004/FR-005)

| Condition | Expected |
|-----------|----------|
| High/critical advisory in an `apps/api` **production** dependency | `scripts/audit-api.mjs` **exits non-zero** → build fails |
| High/critical advisory only in mobile or `devDependencies` | Reported in output; **build passes** |
| Advisory accepted in `pnpm.auditConfig.ignoreGhsas`/`ignoreCves` (with rationale in the checklist) | Not blocking; recorded + auditable |
| Every run | Prints all high/critical advisories for visibility |

## 4 · Coverage floor on high-risk logic (FR-006)

| Condition | Expected |
|-----------|----------|
| Coverage of the auth + money modules ≥ 90% (stmts/branches/functions/lines) | Coverage run **passes** |
| Any of those metrics < 90% on the scope | Coverage run **fails** → build fails |
| Coverage scope + threshold | Defined in `apps/api/jest.cov.config.js` (version-controlled) |

## 5 · Output hygiene (FR-007)

| Condition | Expected |
|-----------|----------|
| Any test/coverage/audit output, including failures | Contains no secret, monetary amount, or note content |

## Commands (the gate surface)

```bash
pnpm --filter @famifinances/api typecheck
pnpm lint
pnpm --filter @famifinances/api test           # unit
pnpm --filter @famifinances/api test:e2e        # e2e (per-suite DB isolation)
pnpm --filter @famifinances/api test:cov        # coverage gate (high-risk ≥ 90%)
pnpm --filter @famifinances/api build
node scripts/audit-api.mjs                       # scoped dependency audit (hard-fail on apps/api prod)
```
