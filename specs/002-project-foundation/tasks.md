---

description: "Task list for FND-01 · Project Foundation (Monorepo, Environments, Docker, CI & Shared Contracts)"
---

# Tasks: Project Foundation (FND-01)

**Input**: Design documents from `/specs/002-project-foundation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ci-pipeline.md, quickstart.md

**Tests**: This is an infrastructure feature; it adds no runtime behavior of its own, so there are no
TDD test-writing tasks. Verification is done by running the existing suite through the new CI gates and
by the quickstart checks. The foundation's "test" is a reproducible green run + a blocking CI gate.

**IMPORTANT — much of FND-01 already exists.** AUTH-01 established most of the foundation. Tasks below
that are already satisfied are pre-marked `[X]`; only the genuinely remaining work is `[ ]`. The new
work is: make the **lint gate real** (install ESLint deps), add a **typecheck fan-out** + mobile
tooling, create the **CI workflow** and **branch protection**, complete the **mobile Expo bootstrap**,
and **document + verify** repeatability.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different files, no dependency on an incomplete task.
- **[Story]**: US1–US5 from spec.md.

---

## Phase 1: Setup (Shared Workspace) — already established by AUTH-01

- [X] T001 pnpm monorepo workspace (`apps/*`, `packages/*`) in `pnpm-workspace.yaml` + root `package.json`
- [X] T002 TypeScript strict base config in `tsconfig.base.json`
- [X] T003 Committed lockfile `pnpm-lock.yaml` + approved native builds in root `package.json` (`pnpm.onlyBuiltDependencies`)

---

## Phase 2: Foundational — already established by AUTH-01

- [X] T004 API container + datastore in `apps/api/Dockerfile` and `docker-compose.yml`
- [X] T005 Fail-fast environment validation + `apps/api/.env.example`
- [X] T006 Shared typed contracts package (`packages/contracts`) built to `dist`, consumed by both apps
- [X] T007 API test harness (unit + e2e via `mongodb-memory-server`) in `apps/api`

**Checkpoint**: Workspace, containers, env, contracts, and the API suite already run locally.

---

## Phase 3: User Story 1 - Reproducible clone-to-green (Priority: P1)

**Goal**: A clean checkout installs, builds, typechecks, lints, and tests green with documented commands.

**Independent Test**: Follow quickstart §1 on a clean checkout; every command exits 0, no manual steps.

- [X] T008 [US1] Add a `typecheck` script to `packages/contracts/package.json` and `apps/mobile/package.json`, and a root `typecheck` fan-out (`pnpm -r typecheck`) in `package.json` (API already has one)
- [X] T009 [US1] Reproducible install from the committed frozen lockfile (`pnpm-lock.yaml`)
- [X] T010 [US1] Verify the reproducible clone-to-green sequence (install → build → typecheck → lint → test) per `specs/002-project-foundation/quickstart.md` §1

**Checkpoint**: Documented single-command gates run green from a clean checkout.

---

## Phase 4: User Story 2 - Automated quality gates on every change (Priority: P1)

**Goal**: Every PR runs lint, typecheck, tests, and build automatically; a failure blocks the merge.

**Independent Test**: A PR that breaks a gate fails CI and is unmergeable; a passing PR merges (quickstart §2).

- [X] T011 [US2] Install `eslint` + `typescript-eslint` as root dev dependencies in `package.json` so the existing `eslint.config.mjs` flat config is executable
- [X] T012 [US2] Make the lint gate cover the whole workspace: set root `lint` in `package.json` to run ESLint across `apps/**` and `packages/**` (add package `lint` scripts or invoke `eslint .` at the root)
- [X] T013 [US2] Create `.github/workflows/ci.yml` per `specs/002-project-foundation/contracts/ci-pipeline.md`: `pnpm install --frozen-lockfile` → contracts build → `pnpm -r typecheck` → lint → API `test` + `test:e2e` → API build, with pnpm store and `mongodb-memory-server` binary caching
- [X] T014 [US2] Ensure the CI gates cover BOTH packages by wiring mobile `typecheck` + `lint` into `.github/workflows/ci.yml` (depends on T020/T021 for mobile tooling)
- [X] T015 [US2] Configure branch protection on `main` requiring the `quality-gates` status check (and up-to-date branch) via `gh api` — record the command in `specs/002-project-foundation/quickstart.md`

**Checkpoint**: A red gate blocks merge; a green gate allows it; both packages are exercised.

---

## Phase 5: User Story 3 - One-command containerized API (Priority: P2) — mechanism exists

**Goal**: `docker compose up` starts the API + datastore; missing secrets fail fast.

**Independent Test**: quickstart §4 (with and without `JWT_SECRET`).

- [X] T016 [US3] API + Mongo via `docker compose up --build` with fail-fast `JWT_SECRET` in `docker-compose.yml`
- [ ] T017 [US3] Verify the container run per `specs/002-project-foundation/quickstart.md` §4 (starts with `JWT_SECRET`; fails fast without)

---

## Phase 6: User Story 4 - Shared contracts with drift detection (Priority: P2) — mechanism exists

**Goal**: A breaking contract change fails a consumer's typecheck before merge.

**Independent Test**: quickstart §3.

- [X] T018 [US4] Contracts consumed by both apps via `@famifinances/contracts`; type-only imports make drift a compile-time failure
- [X] T019 [US4] Verify contract-drift detection: a breaking change to `packages/contracts` fails a consumer's `typecheck` (locally and in CI) per `specs/002-project-foundation/quickstart.md` §3

---

## Phase 7: User Story 5 - Bootable mobile base (Priority: P3)

**Goal**: The mobile app builds/starts from the repeatable base and resolves the shared contracts.

**Independent Test**: `expo start` launches the app from the workspace (quickstart §5).

- [X] T020 [P] [US5] Add mobile Expo config: `apps/mobile/app.json` (or `app.config.ts`), `apps/mobile/babel.config.js`, and `apps/mobile/tsconfig.json` (extends `tsconfig.base` + Expo/React Native types)
- [X] T021 [P] [US5] Add Expo/React dev dependencies and `typecheck` + `lint` scripts to `apps/mobile/package.json`
- [ ] T022 [US5] Verify the mobile app boots via `pnpm --filter @famifinances/mobile start` (`expo start`) and resolves `@famifinances/contracts` per `specs/002-project-foundation/quickstart.md` §5

**Checkpoint**: Mobile is typecheck-able in CI and bootable locally — closes the deferred AUTH-01 T003.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T023 [P] Add/update the root `README.md` with onboarding commands: install, build, typecheck, lint, test, run, container, and CI (FR-010)
- [ ] T024 Execute `specs/002-project-foundation/quickstart.md` end-to-end and record results
- [ ] T025 Open a throwaway PR that breaks a gate to confirm CI fails and blocks merge, then confirm a passing PR is mergeable (FR-008, SC-003)

---

## Dependencies & Execution Order

- **Phases 1–2 (Setup/Foundational)**: already complete (AUTH-01).
- **US1 (T008, T010)**: T008 (typecheck scripts) is a prerequisite for the CI typecheck (T013) and the mobile gate (T014).
- **US2 (T011–T015)**: T011 (eslint deps) blocks T012 (lint) and the CI lint step (T013). T013 (ci.yml) blocks T014 (mobile wired in), T015 (branch protection), and T025 (verify blocking).
- **US5 (T020–T022)**: T020/T021 (mobile tooling) block T014 (mobile in CI) and T022 (boot check).
- **Polish (T023–T025)**: after the commands and CI exist.

### Parallel Opportunities

- T020 and T021 (mobile config vs mobile package.json) can proceed together, then T014/T022.
- T023 (README) can be drafted in parallel once the command surface is finalized.

---

## Implementation Strategy

### Recommended order (remaining work only)

1. **US1 typecheck fan-out** (T008) — unblocks CI typecheck + mobile gate.
2. **US2 lint + CI** (T011 → T012 → T013) — the core value: automated blocking gates.
3. **US5 mobile bootstrap** (T020, T021) — so T014 can wire mobile into CI.
4. **Wire mobile into CI + branch protection** (T014, T015).
5. **Docs + verification** (T023, T017, T019, T022, T010, T024, T025).

### MVP scope

- **Minimal**: US1 + US2 (reproducible gates + CI blocking) — the foundation's core promise.
- **Complete**: add US5 (mobile bootable) + Polish for the full "repeatable base for mobile and API".

---

## Notes

- Pre-marked `[X]` tasks were satisfied by AUTH-01; `/speckit-implement` should skip them and build only
  the `[ ]` items. A follow-up `/speckit-converge` should then find nothing remaining.
- Branch protection (T015) is a repository setting applied once via `gh api`, outside the code diff.
- Constitution gates operationalized here: CI enforces Principle IV (tests block merge) and VI
  (typecheck of shared contracts + ESLint no-`any`); no production secrets run in CI (Principle II).
