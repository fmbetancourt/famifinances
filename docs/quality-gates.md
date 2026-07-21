# Quality Gates (QLT-01)

The version-controlled definition of what "green" means for FamiFinances. The CI `quality-gates` job runs every
required check; protecting that one job in branch protection enforces the whole gate on every merge.

## Required checks (the `quality-gates` job)

Run on every PR and push to `main` (`.github/workflows/ci.yml`):

| Check | Command | Blocks merge |
|-------|---------|--------------|
| Build shared contracts | `pnpm --filter @famifinances/contracts build` | yes |
| Type check (workspace) | `pnpm typecheck` | yes |
| Lint (workspace) | `pnpm lint` | yes |
| Dependency audit (deployed API) | `node scripts/audit-api.mjs` | yes |
| Unit + e2e tests | `pnpm test` | yes |
| Coverage (high-risk) | `pnpm --filter @famifinances/api test:cov` | yes |
| Build (API) | `pnpm --filter @famifinances/api build` | yes |

## Branch protection (manual repo setting)

Set on GitHub → Settings → Branches → branch protection rule for `main`:

- **Require a pull request before merging.**
- **Require status checks to pass** → select the **`quality-gates`** job as required.
- **Require branches to be up to date** before merging.

This is a repo setting (not code); record here when it is enabled: **enabled by** ______ **on** ______.

## Coverage floor (high-risk scope)

`apps/api/jest.cov.config.js` runs the unit + e2e specs together and enforces, on the **authorization +
money-movement** modules (family scope/role guards, family-scoped `*.repository.ts`, and the balance/derivation
services), a threshold of **≥ 90%** statements / functions / lines and **≥ 80%** branches (defensive early-return
guards keep branch coverage structurally lower). The build fails below the floor.

## Dependency audit scope

`scripts/audit-api.mjs` blocks the build on a high/critical advisory in the **`apps/api` production dependency
set** only; mobile and `devDependency` advisories are reported, non-blocking. Accepted risks are recorded in
`package.json` `pnpm.auditConfig.ignoreGhsas`/`ignoreCves` and mirrored in
[`security-checklist.md`](./security-checklist.md) §4.2.

## Time budget

The full local gate (typecheck, lint, unit, e2e, coverage, audit, build) should complete in **≤ ~10 minutes**
on the CI runner. The e2e suite dominates; keep it bounded.

## Known issue — e2e flakiness (tech debt)

The full e2e suite runs 80+ files serially in one long-lived Jest worker; under sustained load a **random**
suite's request transiently fails (all pass in isolation) — a **process-level resource-pressure** flake, **not**
a logic or DB-state bug. Four fixes were tried and did **not** make it fully deterministic (per-suite database,
setup-helper retry, a mongod per file, `workerIdleMemoryLimit`); notably, **more isolation made it worse**,
confirming the process-pressure cause. **Mitigation (accepted):** `jest.retryTimes(2)` (`test/retry-flaky.js`)
re-runs a transiently-failed test a bounded number of times, so the suite is green in practice while a genuine
defect — which fails every attempt — still fails deterministically. A proper fix (e.g. sharding the suite across
fresh worker processes) is future work.
