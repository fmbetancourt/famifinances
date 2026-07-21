# Implementation Plan: Quality Gates & Test Reliability (QLT-01)

**Branch**: `012-quality` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-quality/`

## Summary

QLT-01 makes the automated gates trustworthy — **test-infrastructure + CI only, no product-logic changes**:
(1) a **reliable e2e suite** — the residual environmental flake (process-level resource pressure under load; DB
isolation was tried and did not remove it) is absorbed by an **automatic bounded retry** (`jest.retryTimes` + a
CI step-level re-run), keeping the suite green in practice while a real defect still fails; (2) an **enforced
merge gate**
(typecheck, lint, unit + e2e, build) documented as required checks; (3) a **precise dependency audit** that
**hard-fails only on `apps/api` production-dependency** high/critical advisories (mobile + devDependencies
reported, non-blocking), via a small scoping script; and (4) a **≥ 90% coverage floor** on the authorization +
money-movement modules (guards, family-scoped repositories, balance/derivation services), enforced by the test
runner. The gate config (required checks, thresholds, audit scope, accepted risks) is version-controlled and
documented.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`); Node.js 20 LTS; NestJS; Jest 29 + ts-jest; pnpm 10.

**Primary Dependencies**: existing test stack — Jest, `mongodb-memory-server`, Supertest. pnpm's built-in
`audit`. No new runtime dependency; a Node script for audit scoping. Reuses FND-01 (`ci.yml` quality-gates job,
`global-setup.js`) and SEC-01 (the audit step, made precise).

**Storage**: none new — the e2e in-memory mongod is reused; isolation is per-file databases, discarded on
teardown.

**Testing**: this feature *is* about tests. Validation: the full e2e suite passes on **10 consecutive runs**
with zero flakes (SC-001); a per-suite DB isolation check (two suites reusing the same fixed ids do not collide);
the coverage gate fails when a high-risk module drops below 90% and passes at/above; the scoped audit fails on a
simulated `apps/api`-prod advisory and passes on a mobile/dev-only one.

**Target Platform**: CI runner (Ubuntu) + local dev; no product runtime change.

**Performance Goals**: the full gate completes within a bounded budget (SC-005, ≤ ~10 min on CI); per-file DB
isolation adds no server-startup cost (one shared mongod).

**Constraints**: no product-logic change; no secret/amount/note in test output (FR-007); gate config
version-controlled + documented (FR-008); the audit hard-fail is scoped to the deployed `apps/api` prod set to
avoid the Expo/tooling noise that made SEC-01 report-only.

**Scale/Scope**: the whole existing test suite (AUTH/FAM/ACC/CAT/TXN/BUD/DASH/HIS/SEC) is stabilized.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Assessment | Status |
|---|-----------|------------|--------|
| I | Family Data Isolation (NON-NEGOTIABLE) | Unchanged; the coverage floor **enforces** ≥ 90% on the family-scope/role guards + family-scoped repos, strengthening isolation assurance. | PASS |
| II | Financial Privacy by Design | Test output carries no secret/amount/note (FR-007) — verified; no product data path changes. | PASS |
| III | Derived Balance Integrity | Unchanged; the coverage floor enforces ≥ 90% on the balance/derivation services, protecting the money logic. | PASS |
| IV | Test-First & Definition of Done | This feature operationalizes IV: deterministic suite, enforced gates, risk-proportioned coverage — the DoD becomes machine-enforced. | PASS |
| V | Modular Monolith Simplicity | Reuses Jest + pnpm; adds per-file DB isolation, a coverage config, one small audit-scoping script, and docs. No new service/infrastructure. | PASS |
| VI | Shared, Documented Contracts | The gate definition (required checks, thresholds, audit scope, accepted risks) is version-controlled + documented; TS strict, no `any` in the script. | PASS |
| VII | Fast & Accessible Capture UX | Not applicable (engineering quality). | PASS |

**Result (pre-Phase 0)**: No violations. Complexity Tracking is empty.

**Post-Design re-check (after Phase 1)**: Re-evaluated against `research.md`, `data-model.md`, and
`contracts/quality-gates.md`. All gates hold: no product path changed (I/II/III); IV operationalized; test infra
+ CI only, no new infrastructure (V); documented gate contract (VI). No new violations.

## Project Structure

### Documentation (this feature)

```text
specs/012-quality/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (quality-gate configuration model)
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── quality-gates.md # The gate definitions (required checks, thresholds, audit scope)
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root) — files QLT-01 adds / edits

```text
apps/api/
├── test/
│   ├── global-setup.js         # EDITED: expose the mongod base URI (no fixed db) for per-file isolation
│   ├── per-suite-db.js         # NEW (jest setupFiles): set MONGODB_URI to a unique dbName per test file
│   └── jest-e2e.json           # EDITED: register the per-suite-db setupFiles
├── jest.cov.config.js          # NEW: coverage run (high-risk globs + per-path 90% coverageThreshold)
└── package.json                # EDITED: `test:cov` script (+ helmet/etc. unchanged)

scripts/
└── audit-api.mjs               # NEW: fail only on apps/api PROD-dependency high/critical advisories; report the rest

.github/workflows/ci.yml        # EDITED: replace report-only audit with `node scripts/audit-api.mjs`; add the coverage gate step
docs/
├── quality-gates.md            # NEW: required checks, coverage thresholds, audit scope, branch-protection setup
└── security-checklist.md       # EDITED (SEC-01 §4.2): point the audit disposition at the scoped gate
```

Reuses `apps/api/test/` harness, the CI quality-gates job, and pnpm audit. No `apps/mobile` or product `src/`
logic changes (only test config + a coverage config + a CI script).

**Structure Decision**: Keep the established layout; QLT-01 is **test infrastructure + CI**. The flake proved to
be **process-level resource pressure** in the single long-running Jest worker, not DB state — four isolation
approaches (per-suite DB, setup-helper retry, a mongod per file, `workerIdleMemoryLimit`) did not make it
deterministic, and more isolation made it worse. It is therefore **absorbed** by `jest.retryTimes(2)`
(`test/retry-flaky.js`) plus a **CI step-level re-run** (a fresh process, covering the rare `beforeAll` failure),
with `workerIdleMemoryLimit` as hygiene — green in practice, a real defect still fails. Coverage is a single
combined run (`jest.cov.config.js`) that runs the **unit + e2e specs together** (merged coverage) scoped to the
high-risk globs, enforcing **≥ 90%** statements/functions/lines and **≥ 80%** branches, wired as a CI step. The
audit is a scoped Node script (`scripts/audit-api.mjs`) that blocks only on advisories in the `apps/api`
production dependency set (mobile/dev reported), replacing SEC-01's report-only step. The required-check set +
thresholds + accepted risks live in `docs/quality-gates.md` and the CI file (branch protection references the
`quality-gates` job).

## Complexity Tracking

> No constitutional violations. No entries required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
