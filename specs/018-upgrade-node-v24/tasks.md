---
description: "Task list for Node.js v24.18.0 Runtime Environment Upgrade (ENV-01 / FAM-23)"
---

# Tasks: Node.js v24.18.0 Runtime Environment Upgrade (ENV-01 / FAM-23)

**Input**: Design documents from `/specs/018-upgrade-node-v24/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/runtime-config.md ✅, quickstart.md ✅

**Tests**: No NEW automated tests are requested. This is a configuration-only upgrade; verification
reuses the existing API (unit + e2e) and mobile suites as quality gates (Principle IV). Test tasks
below are therefore **verification runs**, not new test files.

**Organization**: Tasks are grouped by user story (US1 = uniform execution, US2 = config parity).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2 (maps to spec.md user stories)
- Exact file paths are absolute-from-repo-root.

## ⚠️ Critical ordering note

Once `engine-strict=true` (T004) + `engines.node: ">=24.18.0"` (T003) land, **every** `pnpm`
command fails until the active Node is v24.18.0. The repo currently runs **v24.14.0**, so
**Phase 1 (install v24.18.0) MUST complete before Phase 3.** This is the intended fail-fast
behavior (validated in T009), not a bug.

---

## Phase 1: Setup (Shared Runtime Provisioning)

**Purpose**: Put the developer/CI shell on Node v24.18.0 so post-`engine-strict` verification can run.

- [X] T001 Install and activate Node.js v24.18.0 locally: `nvm install 24.18.0 && nvm use 24.18.0` (or `fnm install 24.18.0 && fnm use 24.18.0`); confirm `node -v` prints `v24.18.0`
- [X] T002 Enable Corepack and confirm the pinned package manager: `corepack enable` then `pnpm -v` prints `10.32.1`

**Checkpoint**: Shell is on v24.18.0 — engine-strict enforcement can be introduced safely.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure before user stories.

No additional foundational tasks: for this config-only feature the sole blocking prerequisite is
runtime provisioning, fully covered by Phase 1. Proceed to Phase 3.

**Checkpoint**: Foundation ready — user story implementation can begin.

---

## Phase 3: User Story 1 - Uniform Monorepo Node.js v24.18.0 Execution (Priority: P1) 🎯 MVP

**Goal**: The whole monorepo runs, tests, lints, and builds under Node v24.18.0 with native
modules intact and pnpm fail-fast enforced for older Node.

**Independent Test**: `node -v` → `v24.18.0`; then `pnpm install --frozen-lockfile` and
`pnpm typecheck && pnpm lint && pnpm test && pnpm build` are 100% green; and running any `pnpm`
command on Node `< 24.18.0` aborts before scripts run.

### Implementation for User Story 1

- [X] T003 [P] [US1] Set `engines.node` to `">=24.18.0"` (from `">=20"`) in `package.json` — contract C-1 (FR-001)
- [X] T004 [P] [US1] Create `.npmrc` at repo root containing `engine-strict=true` — contract C-4 (FR-007)
- [X] T005 [P] [US1] Change the base-stage image to `FROM node:24.18.0-alpine AS base` in `apps/api/Dockerfile` (leave derived stages untouched) — contract C-5 (FR-003)
- [X] T006 [P] [US1] Set `node-version: '24.18.0'` (quoted) and rename the step to "Set up Node 24.18.0" in `.github/workflows/ci.yml` — contract C-6 (FR-004)
- [X] T007 [US1] Run `pnpm install --frozen-lockfile`; confirm `argon2` and `mongodb-memory-server` build/resolve with **no** deprecation or `NODE_MODULE_VERSION` warnings (FR-005, SC-002) — depends on T003, T004
- [X] T008 [US1] Run the full quality gate `pnpm --filter @famifinances/contracts build && pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @famifinances/mobile test && pnpm build`; all green — including the mobile unit suite, since root `pnpm test` covers only API unit+e2e (SC-001) — depends on T007
- [X] T009 [US1] Verify fail-fast: `nvm use 20 && pnpm install` aborts with `ERR_PNPM_UNSUPPORTED_ENGINE` and runs no scripts, then `nvm use` back to v24.18.0 (SC-004) — depends on T003, T004
- [ ] T010 [US1] ⏳ PENDING (Docker daemon not running in this session) — Build and run the API container: `docker build -f apps/api/Dockerfile -t famifinances-api:node24 .` then `docker run --rm famifinances-api:node24 node -v` prints `v24.18.0` and argon2 compiled cleanly (FR-003, FR-005) — depends on T005. Dockerfile edit (T005) is complete; run this once Docker Desktop is started.

**Checkpoint**: US1 fully functional — monorepo green on v24.18.0, container on `node:24.18.0-alpine`, fail-fast proven. **This is the MVP.**

---

## Phase 4: User Story 2 - Environment Configuration & Tooling Parity (Priority: P2)

**Goal**: Every declaration surface (version files + documentation) explicitly and consistently
mandates Node.js v24.18.0, preventing environment drift.

**Independent Test**: Inspect `package.json` engines, `.nvmrc`, `.node-version`, and `README.md`;
all mandate v24.18.0 with zero stale "Node 20" references.

### Implementation for User Story 2

- [X] T011 [P] [US2] Create `.nvmrc` at repo root with a single line `24.18.0` — contract C-2 (FR-002)
- [X] T012 [P] [US2] Create `.node-version` at repo root with a single line `24.18.0` — contract C-3 (FR-002)
- [X] T013 [P] [US2] Update the prerequisites line `Node.js 20 LTS` → `Node.js v24.18.0` in `README.md` — contract C-7 (FR-006)
- [X] T014 [P] [US2] Update runtime references from "Node 20"/"Node.js 20 LTS" to `Node.js v24.18.0` in `specs/002-project-foundation/quickstart.md`, `research.md`, `plan.md`, and `contracts/ci-pipeline.md` — contract C-8 (FR-006)
- [X] T015 [US2] Run the consistency check from contract C-9: the stale-reference grep returns **no matches** and every surface resolves to `24.18.0` (SC-003) — depends on T011, T012, T013, T014 and US1 tasks T003, T005, T006

**Checkpoint**: US1 + US2 both hold — full local/CI/container/docs consistency (SC-003).

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final end-to-end validation and delivery.

- [~] T016 [P] Execute all five scenarios in `specs/018-upgrade-node-v24/quickstart.md` — Scenarios 1 (verify), 2 (fail-fast), 5 (consistency) ✅ done via T007–T009/T015; Scenario 3 (Docker) blocked on daemon (see T010); Scenario 4 (CI) validated on PR
- [ ] T017 Commit the upgrade with a conventional message, e.g. `chore(env): upgrade Node runtime to v24.18.0 (FAM-23)`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately. **Blocks Phase 3** (must be on v24.18.0 before engine-strict lands).
- **Foundational (Phase 2)**: Empty for this feature.
- **User Story 1 (Phase 3)**: Depends on Phase 1.
- **User Story 2 (Phase 4)**: Editing tasks (T011–T014) depend only on Phase 1; the consistency verification (T015) depends on the US1 edit tasks (T003, T005, T006) having landed.
- **Polish (Phase 5)**: Depends on US1 + US2 complete.

### Within User Story 1

- Edits T003, T004, T005, T006 are parallel (distinct files).
- T007 (install/native) needs T003 + T004 → T008 (full suite) needs T007.
- T009 (fail-fast) needs T003 + T004. T010 (docker) needs T005.

### Parallel Opportunities

- **Phase 1**: T001 → T002 (sequential; T002 needs the active runtime).
- **US1 edits**: T003, T004, T005, T006 all `[P]` — different files, apply together.
- **US2 edits**: T011, T012, T013, T014 all `[P]` — different files, apply together.
- **US1 verification**: T009 and T010 can run in parallel once their edit deps land; T008 gates on T007.

---

## Parallel Example: User Story 1 edits

```bash
# Apply the four US1 declaration edits together (distinct files):
Task: "Set engines.node to >=24.18.0 in package.json"          # T003
Task: "Create .npmrc with engine-strict=true"                  # T004
Task: "Set Dockerfile base to node:24.18.0-alpine"             # T005
Task: "Set CI setup-node node-version to '24.18.0'"            # T006
```

## Parallel Example: User Story 2 edits

```bash
Task: "Create .nvmrc = 24.18.0"                                # T011
Task: "Create .node-version = 24.18.0"                         # T012
Task: "README.md Node 20 LTS -> Node.js v24.18.0"             # T013
Task: "specs/002-project-foundation docs Node 20 -> v24.18.0" # T014
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: install & activate Node v24.18.0 (T001–T002).
2. Phase 3: land the four US1 edits, then verify install/native, full suite, fail-fast, and Docker (T003–T010).
3. **STOP and VALIDATE**: monorepo green on v24.18.0, container builds, fail-fast proven. Ship the MVP.

### Incremental Delivery

1. Setup → runtime ready.
2. US1 → executable upgrade proven (MVP).
3. US2 → parity/docs consistency locked in (SC-003).
4. Polish → full quickstart validation + commit.

---

## Notes

- `[P]` tasks = different files, no dependencies.
- No new test files — verification reuses existing suites (config-only feature, Principle IV).
- Reversible: `git checkout` the edited files and `git rm` the three new dotfiles (see quickstart Rollback).
- Commit in English, conventional format, per constitution Development Workflow.
