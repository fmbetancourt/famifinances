---
description: "Task list for Fix API Docker Build and Health Check (FAM-25)"
---

# Tasks: Fix API Docker Build and Health Check (FAM-25)

**Input**: Design documents from `/specs/019-api-docker-healthcheck/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ (health-endpoint.md, dockerfile.md) ✅, quickstart.md ✅

**Tests**: The `/health` endpoint carries a **new e2e test** (`health.e2e-spec.ts`) — required by the
contract and the constitution's Test-First DoD (Principle IV). The container-level criteria (build,
boot, health) are verified via `docker build`/`docker run`/`docker inspect` rather than unit tests.

**Organization**: US1 = buildable container image (P1); US2 = health endpoint + HEALTHCHECK (P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2 (maps to spec.md user stories)
- Paths are absolute-from-repo-root.

## ⚠️ File-coordination note

Both stories edit `apps/api/Dockerfile`: US1 fixes the `build`/`runtime` stages (T002–T003), US2
appends the `HEALTHCHECK` to the `runtime` stage (T011). These are **not** parallel — T011 sequences
after T003. All other US2 work (src + test) is independent of US1 and can proceed in parallel.

---

## Phase 1: Setup

**Purpose**: Confirm the toolchain for building and running the container.

- [X] T001 Confirm the environment: Node v24.18.0 active (`node -v`) and Docker daemon running (`docker info`) from the repo root

**Checkpoint**: Toolchain ready.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure before user stories.

No foundational tasks: US1 (Dockerfile) and US2 (endpoint) are independent slices; the only shared
file is `apps/api/Dockerfile`, handled via the coordination note above. Proceed to Phase 3.

**Checkpoint**: Foundation ready.

---

## Phase 3: User Story 1 - Reliable API Container Image Build (Priority: P1) 🎯 MVP

**Goal**: `apps/api/Dockerfile` builds the API image end-to-end (no `nest: not found`) and the
runtime image boots on Node v24.18.0 while staying lean.

**Independent Test**: `docker build -t famifinances-api -f apps/api/Dockerfile .` exits 0; `docker
run famifinances-api node -v` → `v24.18.0`.

### Implementation for User Story 1

- [X] T002 [US1] Fix the `build` stage in `apps/api/Dockerfile`: add `COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules` and `COPY --from=deps /repo/packages/contracts/node_modules ./packages/contracts/node_modules` (alongside the existing root `node_modules` copy) so `nest` resolves for `pnpm --filter @famifinances/api build` — per contracts/dockerfile.md C-1 (FR-001, FR-002)
- [X] T003 [US1] Make the `runtime` stage in `apps/api/Dockerfile` lean **and** resolvable: ship only the API's production dependency tree (prefer `pnpm --filter @famifinances/api deploy --prod`, or a `--prod`-pruned `apps/api/node_modules`) so `node dist/main.js` boots without `MODULE_NOT_FOUND` and no `nest`/devDeps leak — per contracts/dockerfile.md C-2 (FR-005, US1/AC2). Same file as T002 → run after it
- [X] T004 [US1] Verify US1: `docker build -t famifinances-api -f apps/api/Dockerfile .` exits 0 (SC-001), then `docker run --rm famifinances-api node -v` prints `v24.18.0` (US1/AC1, US1/AC2) — depends on T002, T003

**Checkpoint**: US1 done — the container image builds and boots. **This is the MVP.**

---

## Phase 4: User Story 2 - Container Health Monitoring & Probe Endpoint (Priority: P2)

**Goal**: The API exposes an unauthenticated `GET /health` returning `{"status":"ok"}` at the
un-prefixed path, and the container reports `healthy` via a `HEALTHCHECK` directive.

**Independent Test**: `pnpm --filter @famifinances/api test:e2e -- health` is green (app level);
and, on the built image, `curl /health` → 200 and `docker inspect` → `"healthy"` (container level).

### Tests for User Story 2 (TDD — write first, ensure it FAILS before implementation) ⚠️

- [X] T005 [US2] Write `apps/api/test/health.e2e-spec.ts` using the shared `createApp()` harness, asserting A1 (`GET /health` → 200 + `{"status":"ok"}`), A2 (no `Authorization` header needed), A3 (`GET /api/v1/health` → 404), A4 (rapid repeats not `429`) — per contracts/health-endpoint.md. Run it and confirm it FAILS (endpoint not yet implemented)

### Implementation for User Story 2

- [X] T006 [P] [US2] Create `apps/api/src/health/health.controller.ts`: `@SkipThrottle()` `@Controller({ path: 'health', version: VERSION_NEUTRAL })` with `@Get() check(): { status: 'ok' } { return { status: 'ok' }; }` — no guards, no DB injection (FR-003)
- [X] T007 [P] [US2] Create `apps/api/src/health/health.module.ts` declaring `HealthController` (no providers)
- [X] T008 [US2] Register `HealthModule` in the `imports` of `apps/api/src/app.module.ts` — depends on T007
- [X] T009 [US2] In `apps/api/src/app.setup.ts`, change `app.setGlobalPrefix('api')` to exclude the health route: `app.setGlobalPrefix('api', { exclude: [{ path: 'health', method: RequestMethod.GET }] })` (import `RequestMethod` from `@nestjs/common`) so it resolves at `/health` (FR-004 path)
- [X] T010 [US2] Run `pnpm --filter @famifinances/api test:e2e -- health`; `health.e2e-spec.ts` now passes (A1–A4, SC-002) — depends on T005, T006, T007, T008, T009
- [X] T011 [US2] Append the `HEALTHCHECK` directive to the `runtime` stage of `apps/api/Dockerfile`: `HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1` — per contracts/dockerfile.md C-3 (FR-004). Same file as T002/T003 → run after T003
- [X] T012 [US2] Verify US2 container level: `docker build`, then `docker run -d --name fami-api -p 3000:3000 -e JWT_SECRET=dev-only-secret famifinances-api`; assert `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/health` → 200 (US2/AC1) and `docker inspect --format='{{json .State.Health.Status}}' fami-api` → `"healthy"` within 30s (US2/AC2, SC-003); then `docker rm -f fami-api` — depends on T004, T010, T011

**Checkpoint**: US1 + US2 done — image builds, boots, serves `/health`, and reports `healthy`.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T013 [P] Verify runtime leanness (FR-005): `docker run --rm famifinances-api sh -c 'ls node_modules/.bin/nest 2>/dev/null && echo LEAK || echo lean'` prints `lean` (quickstart Scenario 4)
- [X] T014 Regression: `pnpm --filter @famifinances/api test && pnpm --filter @famifinances/api test:e2e` stays fully green (no impact from the prefix-exclude change)
- [X] T015 Execute `specs/019-api-docker-healthcheck/quickstart.md` end-to-end and check every Definition-of-Done box
- [ ] T016 Commit with a conventional message, e.g. `fix(api): repair Docker workspace build and add /health check (FAM-25)`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **US1 (Phase 3)**: after Setup. T003 after T002 (same file); T004 after T002+T003.
- **US2 (Phase 4)**: app-level work (T005–T010) depends only on Setup and is independent of US1;
  T011 (Dockerfile HEALTHCHECK) sequences after US1's T003 (same file); T012 (container verify)
  depends on T004 (buildable image) + T010 (endpoint) + T011 (HEALTHCHECK).
- **Polish (Phase 5)**: after US1 + US2.

### Within User Story 2

- TDD: T005 (write failing test) before implementation.
- T006 and T007 are parallel (distinct new files); T008 needs T007; T009 is an independent file.
- T010 (test green) gates on T006–T009. T012 gates on T004 + T010 + T011.

### Parallel Opportunities

- **US1 vs US2 (app level)**: T002–T004 (Dockerfile) can proceed in parallel with T005–T010
  (src/test), by different developers — they touch disjoint files until T011.
- **Within US2**: T006 `[P]` and T007 `[P]` together; T005 (test) can be written up front.

---

## Parallel Example: US2 endpoint scaffolding

```bash
# After the failing test (T005) is in place:
Task: "Create apps/api/src/health/health.controller.ts"   # T006
Task: "Create apps/api/src/health/health.module.ts"       # T007
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: confirm Node v24.18.0 + Docker.
2. Phase 3: fix `build` + `runtime` stages, verify `docker build` exits 0 and boots (T002–T004).
3. **STOP and VALIDATE**: a buildable, bootable image. Ship the MVP.

### Incremental Delivery

1. Setup → toolchain ready.
2. US1 → image builds & boots (MVP).
3. US2 → `/health` endpoint (e2e-green) + `HEALTHCHECK` → container reports `healthy`.
4. Polish → leanness check, regression suite, quickstart, commit.

### Parallel Team Strategy

- Dev A: US1 (Dockerfile build/runtime fix).
- Dev B: US2 app endpoint (test-first, controller/module/wiring).
- Integrate at T011/T012 (HEALTHCHECK + container verification).

---

## Notes

- `[P]` = different files, no dependencies.
- TDD for the endpoint: T005 must fail before T006–T009 make it pass.
- Keep the runtime image lean (FR-005) — the build fix must not drag `nest`/devDeps into runtime.
- `/health` is version-neutral and prefix-excluded on purpose; do **not** add it to the `/api/v1`
  OpenAPI surface.
- Commit in English, conventional format, per constitution Development Workflow.
