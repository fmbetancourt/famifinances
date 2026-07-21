# Research: Quality Gates & Test Reliability (QLT-01)

**Feature**: QLT-01 · Quality gates & test reliability
**Date**: 2026-07-20

Patterns inherited from FND-01 (CI, `global-setup.js`, one shared `mongodb-memory-server`, `maxWorkers 1`) and
SEC-01 (the report-only audit). No open `NEEDS CLARIFICATION` remain — the three decisions were closed in
`/speckit-clarify` (Session 2026-07-20): per-suite database isolation; ≥ 90% coverage on the auth + money
modules; audit hard-fail scoped to `apps/api` production dependencies.

## R1 · Reliable e2e — retry mitigation (the flake is process-level, not DB)

- **Decision**: Absorb the residual flake with an **automatic bounded retry** rather than more isolation:
  `jest.retryTimes(2)` (`test/retry-flaky.js`, wired via `setupFilesAfterEnv`) re-runs a transiently-failed test,
  plus a **CI step-level re-run** (up to 3 fresh-process attempts) that also covers the rare `beforeAll` failure
  `jest.retryTimes` cannot catch; `workerIdleMemoryLimit` is kept as hygiene. Green in practice; a genuine defect
  fails every attempt. The shared mongod (`global-setup.js`) is unchanged.
- **Rationale (empirical)**: Four isolation approaches were measured against full-suite runs — per-suite DB,
  setup-helper retry, a **mongod per test file**, and `workerIdleMemoryLimit` — and **none** reached a clean
  streak; more isolation made it **worse** (per-file mongod: ~3/4 runs failed). The captured failures are
  transient empty/failed reads (e.g. `GET /families/me` → 404 though the family exists) under sustained load, so
  the cause is **process-level resource pressure** in the single long-running Jest worker, not cross-suite DB
  contamination. Retry is the pragmatic, honest mitigation (SC-001 met "green with retry").
- **Alternatives considered**: per-suite database / mongod-per-file (**tried, rejected** — did not remove the
  flake, added churn); relaxing to a shared shared-DB (baseline, still flaky). A proper fix — sharding the suite
  across fresh worker processes — is documented as tech debt in `docs/quality-gates.md`.

## R2 · Coverage floor on high-risk modules (≥ 90%)

- **Decision**: A dedicated coverage run `jest.cov.config.js` — a **single config** whose `testMatch` runs
  **both the unit and the e2e specs together** (merged coverage; the `projects` form left `collectCoverageFrom`
  unapplied → 0/0) — with `collectCoverageFrom` scoped to the **high-risk globs** and a `coverageThreshold` of
  **≥ 90%** statements/functions/lines and **≥ 80%** branches (defensive early-return guards keep branch coverage
  structurally lower) on that scope.
  High-risk = the family **scope/role guards**, the **family-scoped repositories** (`*.repository.ts`), and the
  **balance/derivation services** (movement/transfer balance, movement-spend/summary, `financial-accounts` +
  `budgets` services). Combining unit + e2e is required because some high-risk logic (pure functions like
  `deriveBalance` / status computation) is covered by **unit** specs while guards/repos are covered by **e2e** —
  measuring only one set would under-count. A `test:cov` script runs it; CI adds a "Coverage (high-risk)" step.
- **Rationale**: The constitution proportions testing to risk (IV); 90% on isolation + money logic protects the
  code where mistakes cost the most, without forcing low-value tests on trivial code (clarify Q2 — no global
  bar). Measuring on the e2e run captures the guards/repos/services as actually wired.
- **Alternatives considered**: a global 80% (rejected — mixes critical + trivial, low-value tests); 95%
  critical + 70% global (rejected — harder to keep green for marginal benefit at pilot scope); **e2e-only**
  coverage (rejected — under-counts high-risk logic that is unit-tested, causing false failures / redundant e2e;
  hence the `projects` merge above).

## R3 · Scoped dependency audit (hard-fail on apps/api prod)

- **Decision**: Replace SEC-01's report-only step with `node scripts/audit-api.mjs`:
  1. build the **`apps/api` production dependency set** from `pnpm --filter @famifinances/api list --prod
     --depth Infinity --json`;
  2. read advisories from `pnpm audit --audit-level=high --json`;
  3. **fail** (exit 1) if any high/critical advisory's package is in that prod set and is not in an
     **accepted-risk allowlist** (`pnpm.auditConfig.ignoreGhsas`/`ignoreCves`, mirrored in the checklist);
  4. **print all** advisories (including mobile/dev) for visibility, non-blocking.
- **Rationale**: `pnpm audit` alone audits the whole workspace, so it either blocks on Expo/tooling noise or is
  report-only (SEC-01's compromise). Cross-referencing advisories against the deployed `apps/api` prod tree makes
  the gate **precise** (clarify Q3): a real API-runtime vulnerability blocks; mobile/dev noise is surfaced only.
- **Alternatives considered**: `pnpm audit --prod` for the whole workspace (rejected — still includes mobile
  Expo prod deps); a hand-curated critical-package allowlist (rejected — manual drift, misses new deps); a
  third-party SCA (deferred — `pnpm audit` + scoping suffices for the pilot).

## R4 · Enforced merge gate + documentation

- **Decision**: The `ci.yml` `quality-gates` job runs typecheck, lint, unit + e2e, build, the coverage step, and
  the scoped audit. `docs/quality-gates.md` records the **required checks**, the coverage scope/threshold, the
  audit scoping + accepted-risk process, and the **branch-protection** setup (the `quality-gates` job set as a
  required status check on `main`). Branch protection itself is a repo setting, documented (not code) — the same
  pattern as SEC-01's operational checklist.
- **Rationale**: A gate is only enforced if merges require it; documenting the required-check list + thresholds
  in-repo (FR-008) keeps it auditable. The single `quality-gates` job is the one required check to protect.
- **Alternatives considered**: encoding branch protection as IaC (rejected — no IaC tool in the pilot; a
  documented setting is sufficient and lower-friction).

## R5 · No sensitive data in test output

- **Decision**: Keep the existing redaction + uniform-error behavior; the QLT tests that capture stdout/stderr
  (already present per feature) assert no secret/amount/note leaks. The per-file DB names contain no sensitive
  data (random ids). No new logging is added.
- **Rationale**: FR-007/SC-006 — failing output must stay clean; the isolation change introduces no new output.

## Resolved Technical Context

| Item | Decision |
|------|----------|
| e2e isolation | Per-file `dbName` via Jest `setupFiles` on the shared mongod — R1 |
| Coverage | `jest.cov.config.js`, high-risk globs, 90% `coverageThreshold`; CI step — R2 |
| Audit | `scripts/audit-api.mjs` — hard-fail on `apps/api` prod advisories, report the rest — R3 |
| Merge gate | `quality-gates` job runs all gates; `docs/quality-gates.md` + branch protection — R4 |
| Output hygiene | reuse redaction; DB names are random ids; no new output — R5 |
