# Quickstart: Quality Gates & Test Reliability (QLT-01)

**Feature**: QLT-01 · Quality gates & test reliability
**Date**: 2026-07-20

Validates that the automated gates are trustworthy: the e2e suite is deterministic, the merge gate is enforced,
the dependency audit is precise, and the high-risk coverage floor holds. Gate behaviors:
[contracts/quality-gates.md](./contracts/quality-gates.md); configuration: [data-model.md](./data-model.md);
decisions: [research.md](./research.md).

## Prerequisites

- Repo bootstrapped (`pnpm install`). No product runtime changes; this is test infra + CI.
- The e2e harness uses one shared `mongodb-memory-server` with **per-file databases** (QLT-01).

## Run

```bash
pnpm --filter @famifinances/api typecheck
pnpm lint
pnpm --filter @famifinances/api test            # unit
pnpm --filter @famifinances/api test:e2e         # e2e (isolated per suite)
pnpm --filter @famifinances/api test:cov         # coverage gate (high-risk ≥ 90%)
node scripts/audit-api.mjs                        # scoped dependency audit
```

## Scenario 1 — Deterministic e2e (US1, P1)

1. Run the full e2e suite **10 times** in a row on unchanged code.
2. **Expect** all 10 runs green, with **no** intermittent failure of a random heavy suite (the previous flake is
   gone).
3. Inspect a couple of suites: each connects to its own `e2e_<unique>` database (no shared DB).

**Pass**: 10/10 green; per-suite DB confirmed; no cross-suite contamination.

## Scenario 2 — Enforced merge gate (US2, P1)

1. On a scratch branch, introduce a type error (or a failing test) and push → the `quality-gates` job **fails**;
   with branch protection, the PR is **not mergeable**.
2. Fix it → the job passes and the PR becomes mergeable.
3. Confirm the required-check list + thresholds are in `ci.yml` and `docs/quality-gates.md`.

**Pass**: a failing gate blocks merge; a passing gate allows it; the config is version-controlled.

## Scenario 3 — Scoped dependency audit (US3, P2)

1. `node scripts/audit-api.mjs` on the current tree → **passes** (no unaccepted high advisory in the `apps/api`
   prod set), while still **printing** the pre-existing mobile/tooling advisories.
2. Simulate a high advisory on an `apps/api` prod dependency (or add its GHSA to a test fixture) → the script
   **exits non-zero** (build fails).
3. Add that GHSA to `pnpm.auditConfig.ignoreGhsas` with a rationale in `docs/security-checklist.md` → the script
   passes again (accepted, auditable).

**Pass**: blocks on an `apps/api`-prod advisory; reports mobile/dev; accepted risk is the only bypass.

## Scenario 4 — Coverage floor (US4, P2)

1. `pnpm --filter @famifinances/api test:cov` → **passes** with the auth + money modules at ≥ 90%.
2. Temporarily remove tests covering a high-risk module so its coverage drops below 90% → the coverage run
   **fails**.
3. Restore the tests → it passes.

**Pass**: the build fails below 90% on the high-risk scope; passes at/above.

## Done When

- [ ] Scenarios 1–4 pass (1–2 automated/CI; 3–4 verifiable locally).
- [ ] Full e2e suite: 10 consecutive green runs, zero flakes — SC-001.
- [ ] The `quality-gates` job is a required check on `main` — SC-002.
- [ ] Audit hard-fails on `apps/api` prod advisories, reports the rest — SC-003.
- [ ] Auth + money coverage ≥ 90%, enforced — SC-004.
- [ ] Gate completes within the time budget; no sensitive data in output — SC-005/SC-006.
