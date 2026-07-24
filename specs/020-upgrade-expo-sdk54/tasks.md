---
description: "Task list for Expo SDK 54 upgrade (FAM-26)"
---

# Tasks: Upgrade Mobile App to Expo SDK 54 (FAM-26)

**Input**: Design documents from `/specs/020-upgrade-expo-sdk54/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: No **new** test authoring is requested. This is a dependency-version migration; the
existing mobile suite (10 files) is the regression gate (spec AC3). "Test" tasks below run and
verify the existing suite — they do not add TDD tests.

**Nature of this feature**: The substantive change is a single dependency edit set, so the
real work concentrates in **Phase 2 (Foundational)**. The two user stories are **independent
validation surfaces** on top of that change: US1 = physical-device Expo Go loads; US2 =
monorepo typecheck/tests/contracts stay green. Either can be validated first once Phase 2 is done.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files/independent, no dependency on incomplete tasks)
- **[Story]**: US1 / US2 (Setup, Foundational, Polish carry no story label)
- All paths are relative to repo root `/Users/fmbetancourt/IdeaProjects/finanzas-app/famifinances/`

---

## Phase 1: Setup (Baseline & Environment)

**Purpose**: Confirm a clean, reproducible starting point before touching dependencies.

- [X] T001 Confirm active branch is `020-upgrade-expo-sdk54`. Treat the already-present `apps/mobile/{tsconfig.json,expo-env.d.ts,.gitignore}` changes as **part of this upgrade** and keep them: `tsconfig.json` adds `.expo/types/**/*.ts` to `include` (typed-routes regeneration, research R4); `expo-env.d.ts` returns to the generated stub and is now gitignored via the new `apps/mobile/.gitignore`. Verify nothing reads a `process.env.EXPO_PUBLIC_*` typing that the removed manual declaration used to provide (Expo `expo/types` now supplies it) — confirm in T012.
- [X] T002 [P] Verify the runtime is Node v24.18.0 and pnpm is the active package manager (`node -v`, `pnpm -v`); never use npm/yarn.
- [X] T003 [P] Capture the pre-upgrade baseline: record current versions from `apps/mobile/package.json` (expo ~51, react 18.2.0, react-native 0.74.0, expo-router ~3.5.0) into the PR description as the "before" state.

**Checkpoint**: Clean tree, correct toolchain, documented baseline.

---

## Phase 2: Foundational (Dependency Migration — BLOCKS US1 & US2)

**Purpose**: Apply the Expo SDK 54 version set. This is the core change; no user story can be
validated until it is complete. See [research.md](./research.md) R1–R5 and [data-model.md](./data-model.md).

**⚠️ CRITICAL**: No user-story validation (Phase 3/4) can begin until this phase is complete.

- [X] T004 In `apps/mobile/`, run `npx expo install expo@^54.0.0` then `npx expo install --fix` to rewrite Expo-owned dependencies to the validated SDK 54 pins (expo ~54, react 19.1.0, react-native 0.81.x, expo-router ~6.0.0, expo-secure-store ~15.0.0, babel-preset-expo ~54, jest-expo ~54, @types/react ~19.1).
- [X] T005 Reconcile the React-19 test tooling in `apps/mobile/package.json` that `expo install --fix` does not own (research R3): remove `react-test-renderer` from `devDependencies` and set `@testing-library/react-native` to `^13`.
- [X] T006 From repo root, run `pnpm install` to produce a workspace-consistent lockfile; confirm the install completes with **no unresolved peer-dependency errors** (spec Edge Case). If peers conflict, reconcile versions per research R1 — do not fall back to SDK 52/53.
- [X] T007 [P] Verify `apps/mobile/app.json` invariants are intact and unchanged: `expo.newArchEnabled: true`, `plugins: ["expo-router","expo-secure-store"]`, `experiments.typedRoutes: true`, and `main` = `expo-router/entry` in `package.json`.
- [X] T008 [P] Verify `apps/mobile/jest.config.js` `transformIgnorePatterns` `.pnpm` allow-list still matches SDK 54 sources, and `apps/mobile/babel.config.js` still uses the single `babel-preset-expo` preset (research R4).

**Checkpoint**: `apps/mobile/package.json` shows the SDK 54 set with `react-test-renderer`
removed; `pnpm install` is clean. US1 and US2 validation can now proceed (in parallel).

---

## Phase 3: User Story 1 — Expo Go SDK 54 Compatibility on Physical Devices (Priority: P1) 🎯 MVP

**Goal**: A physical device running Expo Go SDK 54 bundles and renders the app without the
version-mismatch red screen (FR-002, SC-001, AC2).

**Independent Test**: Run `pnpm --filter @famifinances/mobile start`, scan the QR with Expo Go
SDK 54 on a physical phone, and confirm the home/sign-in screen renders with no version dialog.

- [X] T009 [US1] Run `pnpm --filter @famifinances/mobile start` once and confirm the dev server **initializes cleanly with no bundler/startup errors** (FR-002), bundling and regenerating typed-route + `expo-env.d.ts` types (`.expo/types`) and clearing any stale SDK 51 cache (research R4/R5).
- [X] T010 [US1] Scan the QR code with **Expo Go SDK 54** on a physical Android or iOS device and confirm no "Project is incompatible with this version of Expo Go" red screen appears (resolves the FAM-26 bug, SC-001/AC2).
- [X] T011 [US1] Verify on-device that the initial screen renders cleanly with **no fatal red-box errors** from `expo-router`, `expo-secure-store`, or the New Architecture (FR-004). Record any non-fatal yellow-box deprecation notices for follow-up rather than treating them as blockers.

**Checkpoint**: The original FAM-26 incompatibility is gone; app loads on-device via Expo Go 54.

---

## Phase 4: User Story 2 — Monorepo & Contract Compilation Integrity (Priority: P2)

**Goal**: TypeScript strict mode, shared `@famifinances/contracts`, and the full test suite stay
green after the upgrade (FR-003, AC3, AC4, SC-002, SC-003). See [contracts/README.md](./contracts/README.md).

**Independent Test**: `pnpm --filter @famifinances/mobile typecheck`, `pnpm typecheck`, and
`pnpm test` all pass with zero regressions.

- [X] T012 [P] [US2] Run `pnpm --filter @famifinances/mobile typecheck` and confirm exit code 0 with 0 TypeScript errors under `@types/react@19` (SC-002/FR-003); introduce **no** `any` to silence errors.
- [X] T013 [P] [US2] Run workspace-wide `pnpm typecheck` and confirm `@famifinances/contracts` imports in `apps/mobile/src/features/auth/**` still compile under strict mode with no contract drift (AC4). If a contract type must change, STOP — that is out of scope for this feature (contracts/README.md).
- [X] T014 [US2] Run `pnpm --filter @famifinances/mobile test` (10 files under `app/**/__tests__` and `src/features/auth/**/__tests__`) and confirm 100% pass; in particular `no-secret-logging.test.ts` still passes (Constitution II guard). Reconcile any RNTL v12→v13 API break in-place — do not pin React back to 18.
- [X] T015 [US2] Run full monorepo `pnpm test` and confirm 100% pass with no regressions in `apps/api` or `packages/contracts` (SC-003).

**Checkpoint**: Typecheck + tests + contracts all green across the workspace.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Record evidence, finalize the change, and close the loop on Jira/DoD.

- [ ] T016 [P] Paste the actual `npx expo install --fix` output and the final `apps/mobile/package.json` diff into the PR as the source-of-truth record of exact patch pins (research R1).
- [ ] T017 [P] Run through [quickstart.md](./quickstart.md) Steps 1–5 as the final acceptance pass and check off the acceptance mapping table (AC1–AC4, SC-001–003).
- [ ] T018 Commit with a Conventional Commit message (e.g. `chore(mobile): upgrade apps/mobile to Expo SDK 54 (FAM-26)`), open the PR, and transition FAM-26 accordingly with a summary of on-device validation.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup. **BLOCKS US1 and US2** — the dependency
  migration must land before any validation is meaningful.
- **User Stories (Phase 3 & 4)**: Both depend only on Phase 2. Once Phase 2 is done, US1 and
  US2 are independent and can be validated in parallel (device test vs. CI checks).
- **Polish (Phase 5)**: Depends on US1 and US2 passing.

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 only. Independent of US2.
- **US2 (P2)**: Depends on Phase 2 only. Independent of US1 (does not require a device).

### Within Phases

- Phase 2 is sequential T004 → T005 → T006 (each mutates deps/lockfile); T007 and T008 are
  read-only verifications that can run in parallel after T006.
- US1 is sequential (T009 bundles before T010/T011 observe on-device).
- US2: T012 and T013 are parallel typecheck reads; T014 before T015 (widen scope).

### Parallel Opportunities

- T002, T003 (Setup) in parallel.
- T007, T008 in parallel after T006.
- **US1 and US2 in parallel** once Phase 2 completes (one person on the device, checks in CI).
- T012, T013 in parallel; T016, T017 in parallel.

---

## Parallel Example: after Phase 2 completes

```bash
# US2 static checks (no device needed) — run together:
pnpm --filter @famifinances/mobile typecheck      # T012
pnpm typecheck                                     # T013

# Meanwhile, US1 device validation on the phone:
pnpm --filter @famifinances/mobile start           # T009 → scan QR (T010, T011)
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1: Setup → clean baseline.
2. Phase 2: Foundational → the SDK 54 dependency migration (the actual fix).
3. Phase 3: US1 → confirm on a physical device that Expo Go 54 loads the app.
4. **STOP and VALIDATE**: the FAM-26 bug is resolved (SC-001). This is the demoable MVP.

### Incremental Delivery

1. Setup + Foundational → migration applied.
2. US1 → device compatibility restored → demo (MVP: bug closed).
3. US2 → monorepo integrity proven green → merge-ready.
4. Polish → evidence recorded, PR opened, FAM-26 transitioned.

---

## Notes

- [P] = independent/different concern, safe to parallelize; Phase 2 dep edits are **not** [P].
- The exact patch pins in the design docs are representative; `expo install --fix` output rules.
- The highest-risk step is T005 (React 19 test tooling); T014 is the gate that proves it.
- Do not introduce `any`, do not change `@famifinances/contracts`, do not disable `newArchEnabled`.
- Commit after each logical group; validate at each checkpoint before proceeding.

---

## Phase 6: Convergence

> Appended by `/speckit-converge`. Assesses current code vs. spec/plan/tasks. The device
> validation (T010–T011) and PR/close-out (T016–T018) remain as their existing open tasks and
> are intentionally not duplicated here.

- [X] T019 [P] Document and justify the four `expo-router@6` peer dependencies added to `apps/mobile/package.json` beyond the FR-001 enumerated set — `react-dom@19.1.0`, `expo-constants@~18.0.13`, `expo-linking@~8.0.12`, `@expo/metro-runtime@~6.1.2` — by recording them in `research.md` (extend R2/R3) and/or the PR description as required SDK 54 peers surfaced by `expo install`, per plan: FR-001 dep set (unrequested). Do not remove them: the Metro bundle and typecheck confirm they are needed.

---

## Phase 7: Convergence

> Appended by `/speckit-converge` (2nd pass). The device-validation tasks (T010–T011) and the
> earlier convergence task (T019) are now complete; the missing `expo-router@6` native peers
> found on-device are installed and recorded in research R6. The two items below are
> out-of-scope changes made during this session that should be reconciled before the upgrade PR.
> Note: the failing registration flow observed on-device is **not** in FAM-26's scope (US1/SC-001
> only requires the app to load under Expo Go SDK 54, which it does) and is being tracked as a
> separate PO-raised bug — it is intentionally not listed here.

- [ ] T020 [P] Reconcile the out-of-scope API dev helper — `MAIL_DEV_LOG_OTP` in `apps/api/src/config/env.validation.ts` plus the OTP-logging change and test in `apps/api/src/mail/providers/stub-mail.adapter.ts(.spec.ts)` — by moving it into its own commit/branch/PR (or documenting its inclusion), since it is not called for by FAM-26 spec/plan/tasks (unrequested). Do not revert: it is a deliberate, production-guarded dev aid.
- [ ] T021 [P] Reconcile the out-of-scope auth navigation links added to `apps/mobile/app/(auth)/sign-in.tsx` (Create-account / Forgot-password) by isolating them from the SDK 54 upgrade diff into a separate commit (or documenting their inclusion), since they are not called for by FAM-26 spec/plan/tasks (unrequested). Keep the upgrade's `ReactElement` change in the upgrade commit.
