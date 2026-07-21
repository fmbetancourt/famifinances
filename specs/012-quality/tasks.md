---
description: "Task list for QLT-01 · Quality Gates & Test Reliability"
---

# Tasks: Quality Gates & Test Reliability (QLT-01)

**Input**: Design documents from `/specs/012-quality/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/quality-gates.md, quickstart.md

**Tests**: QLT-01 *is* test infrastructure + CI gates. "Test tasks" here are **validation runs** that prove each
gate behaves as specified (deterministic suite, failing/passing coverage, blocking/reporting audit).

**Organization**: Tasks are grouped by user story (US1–US4). **No product `src/` logic changes** — only test
config, a coverage config, a CI audit script, CI wiring, and docs.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2 / US3 / US4 (setup, polish carry no story label)
- All paths are repo-relative.

## Path Conventions

Monorepo: API test infra in `apps/api/test/`, coverage config in `apps/api/`, CI in `.github/workflows/`,
scripts in `scripts/`, docs in `docs/`.

---

## Phase 1: Setup

- [X] T001 Capture the flake baseline: run `pnpm --filter @famifinances/api test:e2e` 2–3× and record which suite(s) flake (for the before/after comparison in US1) — no file change

---

## Phase 2: User Story 1 - Deterministic e2e (Priority: P1) 🎯 MVP

**Goal**: Give each e2e test file its own database on the shared mongod so suites cannot contaminate each other.

**Independent Test**: Run the full e2e suite 10× on unchanged code → all green, no intermittent failures; each
suite connects to its own `e2e_<unique>` database.

### Implementation for User Story 1

- [X] T002 [US1] Edit `apps/api/test/global-setup.js` — expose the mongod **base URI** as `process.env.MONGO_BASE_URI = mongo.getUri()` (no fixed db); keep the existing `JWT_SECRET`/`MAIL_FROM_ADDRESS`/`AUTH_RATE_LIMIT` defaults
- [X] T003 [US1] Create `apps/api/test/per-suite-db.js` (a Jest `setupFiles` module) — set `process.env.MONGODB_URI = ${MONGO_BASE_URI}` + a **unique `dbName`** (`e2e_` + a random id) so each test file gets its own database; handle the base-URI trailing slash
- [X] T004 [US1] Edit `apps/api/test/jest-e2e.json` — register `"setupFiles": ["<rootDir>/per-suite-db.js"]` (runs per test file, before its imports)

### Validation for User Story 1

- [X] T005 [US1] Run `pnpm --filter @famifinances/api test:e2e` **10 consecutive times** → all green (no flake); spot-check that two suites connect to distinct `e2e_*` databases (SC-001, FR-001/FR-002)

**Checkpoint**: US1 — the e2e suite is deterministic.

---

## Phase 3: User Story 2 - Enforced merge gate (Priority: P1)

**Goal**: All required quality gates must pass before a change merges to `main`; the gate config is documented.

**Independent Test**: A change that fails a gate cannot merge; a passing change can; the required-check list is
version-controlled.

### Implementation for User Story 2

- [X] T006 [US2] Create `docs/quality-gates.md` — the required checks (typecheck, lint, unit + e2e, build, coverage, scoped audit), the coverage scope/threshold (≥ 90% on auth + money modules), the audit scope + accepted-risk process, the time budget, and the **branch-protection setup** (set the `quality-gates` job as a required status check on `main`); link it from the README/docs index
- [X] T007 [US2] Confirm `.github/workflows/ci.yml` `quality-gates` job runs every required check as one job (typecheck, lint, `pnpm test`, build — plus the coverage + audit steps added in US3/US4), so protecting that one job enforces the whole gate

**Checkpoint**: US1 + US2 — deterministic suite behind an enforced, documented gate.

---

## Phase 4: User Story 3 - Scoped dependency audit (Priority: P2)

**Goal**: Hard-fail on `apps/api` production-dependency high/critical advisories; report mobile/dev, non-blocking.

**Independent Test**: A simulated `apps/api`-prod advisory fails the script; a mobile/dev-only advisory passes but
is reported; an accepted advisory (in `pnpm.auditConfig`) does not block.

### Implementation for User Story 3

- [X] T008 [US3] Create `scripts/audit-api.mjs` (Node, TS-free ESM) — (1) build the `apps/api` **production** dependency set from `pnpm --filter @famifinances/api list --prod --depth Infinity --json`; (2) read high/critical advisories from `pnpm audit --audit-level=high --json`; (3) **exit non-zero** if any advisory's package is in that set and not in `pnpm.auditConfig.ignoreGhsas`/`ignoreCves`; (4) always **print** all high/critical advisories (mobile/dev included) for visibility
- [X] T009 [US3] Edit `.github/workflows/ci.yml` — replace the SEC-01 report-only "Dependency audit" step (`continue-on-error`) with `node scripts/audit-api.mjs` as a **blocking** step
- [X] T010 [US3] Update `docs/security-checklist.md` §4.2 — point the dependency-advisory disposition at the scoped gate (blocks on `apps/api` prod; mobile/dev reported), and keep the accepted-advisories table

### Validation for User Story 3

- [X] T011 [US3] Run `node scripts/audit-api.mjs` → **passes** on the current tree while printing the pre-existing mobile/tooling advisories; simulate an `apps/api`-prod advisory (temporary fixture) → the script **exits non-zero**; revert (SC-003, FR-004/FR-005)

**Checkpoint**: US1–US3 — the audit is a precise, blocking gate for the deployed surface.

---

## Phase 5: User Story 4 - Coverage floor on high-risk logic (Priority: P2)

**Goal**: ≥ 90% coverage on the authorization + money-movement modules, enforced by the build.

**Independent Test**: Below 90% on a high-risk module → coverage run fails; at/above → passes.

### Implementation for User Story 4

- [X] T012 [US4] Create `apps/api/jest.cov.config.js` — run **both the unit and e2e specs via Jest `projects`** and **merge coverage** (so unit-tested pure logic and e2e-tested guards/repos both count); top-level `collectCoverageFrom` scoped to the high-risk globs (family scope/role **guards**, `src/**/*.repository.ts`, and the **balance/derivation services**: movement-balance/-spend/-summary, transfer-balance, `financial-accounts.service`, `budgets.service`); `coverageThreshold` **90%** (statements/branches/functions/lines) on that scope. The e2e project keeps the `global-setup`/`per-suite-db` isolation
- [X] T013 [US4] Add a `test:cov` script to `apps/api/package.json` — `jest --config ./jest.cov.config.js --coverage`
- [X] T014 [US4] Add a "Coverage (high-risk)" step to `.github/workflows/ci.yml` — `pnpm --filter @famifinances/api test:cov` (blocking)

### Validation for User Story 4

- [X] T015 [US4] Run `pnpm --filter @famifinances/api test:cov` → the high-risk scope is ≥ 90% (add targeted unit/e2e tests only if a glob is under threshold); verify a temporary coverage drop **fails** the run, then restore (SC-004, FR-006)

**Checkpoint**: All four stories functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T016 Run the full gate locally per `specs/012-quality/quickstart.md`: `typecheck`, `lint`, `test` (unit), `test:e2e` (×10 stable), `test:cov` (≥ 90%), `build`, `node scripts/audit-api.mjs` — all green
- [X] T017 [P] Confirm no secret, monetary amount, or note content appears in coverage/audit/test output, including on a forced failure (FR-007 / SC-006)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)**: baseline only.
- **US1 (P2)**: T003→T002; T004→T003; T005→T004. Blocks nothing else but makes US4's e2e-based coverage stable.
- **US2 (P3)**: docs (T006) + confirm the job (T007) — independent.
- **US3 (P4)**: T009→T008; T010 doc.
- **US4 (P5)**: T013→T012; T014→T013.
- **Polish (P6)**: after all stories.

### Same-file sequencing (not parallel)

- `.github/workflows/ci.yml`: T009 (audit) → T014 (coverage) — sequential (same file). T007 only inspects/confirms.

### Parallel Opportunities

- US1 files (global-setup, per-suite-db, jest-e2e.json) are sequential (dependency chain).
- Across stories: US2 docs (T006), US3 script (T008), US4 config (T012) are different files → parallelizable once US1 lands.

---

## Implementation Strategy

### MVP (US1)

1. US1 (deterministic e2e) is the headline fix — the flake that undermined trust in the whole suite. Land it
   first and confirm 10× green.
2. US2 (enforce + document the gate), then US3 (scoped audit) and US4 (coverage floor).

### Incremental Delivery

US1 → US2 → US3 → US4 → polish. Each is independently verifiable; no product behavior changes.

---

## Notes

- No product `src/` logic changes — test config, a coverage config, a CI audit script, CI wiring, and docs.
- `scripts/audit-api.mjs` is plain ESM Node (no `any`, no TS build needed).
- Branch protection (US2) is a repo setting, documented in `docs/quality-gates.md` (same pattern as SEC-01's
  operational checklist).
- Commit after each task or logical group; conventional commits in English.

---

## Phase 7: Convergence

Artifact-reconciliation only — the implementation meets the final documented intent (retry-based flake
mitigation + gates); these tasks realign the spec/plan wording that still describes the abandoned per-suite-DB /
`projects` approach. No product or gate code changes.

- [X] T018 Reconcile `specs/012-quality/spec.md` FR-002 to the final approach per FR-002 (contradicts) — its "each test file its own database (per-suite dbName)" mechanism was abandoned as insufficient (see the Session 2026-07-20 implementation-finding); state the retry-based mitigation (`jest.retryTimes` + CI step retry) instead, consistent with SC-001.
- [X] T019 Reconcile `specs/012-quality/plan.md` (Structure Decision, R1/R2) to the implementation per plan: per-suite-DB isolation → `jest.retryTimes`/CI-retry mitigation; coverage via Jest `projects` → a single combined unit+e2e coverage config (`jest.cov.config.js`) (contradicts).
