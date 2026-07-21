# Tasks: Local Reminders (NTF-01)

**Feature**: NTF-01 · Recordatorios locales
**Branch**: `014-local-reminders`
**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/reminder.openapi.yaml`, `quickstart.md`

Tests are **included** — the constitution (Principle IV) makes authorization coverage mandatory, and
every prior slice ships e2e + an OpenAPI-parity suite.

**Guard conventions** (from plan/research): reads use `JwtAuthGuard` + `FamilyScopeGuard`; writes add
`EmailVerifiedGuard` (guard order `FamilyScope → Email`); **no `FamilyRoleGuard`** — reminders are a
personal resource. Every query binds `ownerId` (`@CurrentUser().accountId`) + `familyId`
(`@CurrentFamily()`) from the session (Principle I).

---

## Phase 1: Setup

- [X] T001 [P] Add shared reminder contract types in `packages/contracts/src/reminder/index.ts` — `ReminderPurpose`, `ReminderCadence`, `ReminderWeekday`, `CreateReminderRequest`, `UpdateReminderRequest`, `ReminderSummary`, matching `contracts/reminder.openapi.yaml`; export the module from `packages/contracts/src/index.ts`.

---

## Phase 2: Foundational (blocking prerequisites)

- [X] T002 Create `apps/api/src/reminders/reminders.module.ts` importing `FamiliesModule` (FamilyScopeGuard) and a placeholder `MongooseModule.forFeature([])` — **one-way dep, no `forwardRef`** — and register `RemindersModule` in `apps/api/src/app.module.ts`.
- [X] T003 [P] Create shared e2e helpers `apps/api/test/reminder-helpers.ts` — a verified member with a family, a second member joined to the **same** family, a member of a **second** family, plus `createReminder`/`listReminders`/`getReminder`/`updateReminder`/`deleteReminder` request wrappers (mirror `capture-helpers.ts`).

**Checkpoint**: `RemindersModule` compiles and is wired; contract types importable; helpers ready.

---

## Phase 3: User Story 1 — Daily capture reminder (Priority: P1) 🎯 MVP

**Goal**: A member creates a daily capture reminder at a chosen time; it round-trips with all the
fields the device needs to schedule the local notification, enabled by default.

**Independent test**: `POST /v1/reminders {purpose:capture, cadence:daily, timeOfDay:"20:00"}` → 201
with `dayOfWeek:null, dayOfMonth:null, enabled:true`; `GET /v1/reminders` lists it; `GET /:id` returns it.

- [X] T004 [US1] Create `apps/api/src/reminders/reminder.schema.ts` — collection `reminders` with fields + index `{ownerId:1, createdAt:-1}` per `data-model.md`; register it in `MongooseModule.forFeature` in `reminders.module.ts`.
- [X] T005 [P] [US1] Create `apps/api/src/reminders/dto/create-reminder.dto.ts` — `purpose`/`cadence` enums (required), `timeOfDay` (required, `@Matches` 24h `HH:MM`), `dayOfWeek?` (enum), `dayOfMonth?` (`@IsInt` 1–31), `label?` (trimmed, `@MaxLength(80)`), with `class-validator` decorators.
- [X] T006 [US1] Create `apps/api/src/reminders/reminder.repository.ts` — per-member `create`, `listByOwner` (newest first), `findForOwner(ownerId, reminderId)`, `countByOwner`; every query binds `ownerId` + `familyId` (a foreign/malformed id → null).
- [X] T007 [US1] Create `apps/api/src/reminders/reminders.service.ts` — `create`/`list`/`get`; full validation (time pattern; cadence⇄selector coherence for daily/weekly/monthly; `custom`→non-blank label; per-member cap **20** → 409); map to `ReminderSummary`; log ids only (never the label).
- [X] T008 [US1] Create `apps/api/src/reminders/reminders.controller.ts` — `POST /v1/reminders` (`+EmailVerifiedGuard`), `GET /v1/reminders`, `GET /v1/reminders/:reminderId` (reads `JwtAuthGuard`+`FamilyScopeGuard`); `@CurrentUser`+`@CurrentFamily`; `@ApiTags('reminders')`+`@ApiBearerAuth`; register controller + service in `reminders.module.ts`.
- [X] T009 [P] [US1] e2e `apps/api/test/reminder-crud.e2e-spec.ts` — create a daily reminder, confirm defaults (`enabled:true`, null selectors), list, and get by id.

**Checkpoint**: US1 is independently shippable — a daily reminder works end to end.

---

## Phase 4: User Story 2 — Budget & review reminders (Priority: P2)

**Goal**: Weekly and monthly reminders with their day selectors are accepted and round-trip; every
incoherent or over-limit configuration is rejected. (Validation was built in US1; US2 proves it.)

**Independent test**: monthly (`dayOfMonth:1`) and weekly (`dayOfWeek:"monday"`) create → 201 with the
right selectors; `dayOfMonth:31` is accepted; bad time / wrong selector / blank custom label / 21st
reminder are all rejected.

> **Note (intentional)**: US2 has **no production tasks** — the full cadence/validation logic ships in
> US1 (T007), so weekly/monthly already work once US1 is done. US2 is the test phase that *proves* the
> weekly/monthly paths and the rejection matrix; this is by design (unified validation), not a coverage gap.

- [X] T010 [P] [US2] Unit `apps/api/src/reminders/reminders.service.spec.ts` — the validation matrix with repository stubs: daily rejects any selector; weekly requires `dayOfWeek` and rejects `dayOfMonth`; monthly requires `dayOfMonth` and rejects `dayOfWeek`; bad `timeOfDay`; `custom` blank label; cap 20 → 409.
- [X] T011 [P] [US2] e2e `apps/api/test/reminder-validation.e2e-spec.ts` — weekly + monthly happy paths (incl. `dayOfMonth:31` accepted), plus rejections: `24:00` time, daily-with-selector, weekly-without-day, monthly-without-day, custom-blank-label, and creating a 21st reminder → 409.

**Checkpoint**: US2 complete — all cadences and the validation contract hold.

---

## Phase 5: User Story 3 — Manage & silence reminders (Priority: P3)

**Goal**: A member edits a reminder, silences/re-enables it without deleting, and deletes it.

**Independent test**: `PATCH {timeOfDay:"21:30"}` → 200; `PATCH {enabled:false}` → 200 (retained,
silenced); `PATCH {enabled:true}` → 200; `DELETE` → 204 and it is gone from the list.

- [X] T012 [P] [US3] Create `apps/api/src/reminders/dto/update-reminder.dto.ts` — all fields optional (partial) plus `enabled?`, same per-field validation as create.
- [X] T013 [US3] Extend `apps/api/src/reminders/reminder.repository.ts` with per-member `update` (findOneAndUpdate `{new:true}`) and `deleteForOwner` (hard delete → boolean).
- [X] T014 [US3] Extend `apps/api/src/reminders/reminders.service.ts` with `update` (re-validate the **effective** cadence/selectors/purpose/label as a whole; require ≥1 field) and `delete` (404 when absent).
- [X] T015 [US3] Extend `apps/api/src/reminders/reminders.controller.ts` with `PATCH /v1/reminders/:reminderId` and `DELETE /v1/reminders/:reminderId` (204) — both add `EmailVerifiedGuard`.
- [X] T016 [P] [US3] e2e `apps/api/test/reminder-manage.e2e-spec.ts` — edit time (200), disable then re-enable (200, retained), delete (204 + gone), delete again (404), and an incoherent edit (e.g. switch to weekly without a day) → 400.

**Checkpoint**: all three stories complete and independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T017 [P] e2e `apps/api/test/reminder-isolation.e2e-spec.ts` — a second member of the same family cannot GET/PATCH/DELETE another member's reminder (404), and a member of a second family cannot either (Principle I, FR-006).
- [X] T018 [P] e2e `apps/api/test/reminder-openapi-parity.e2e-spec.ts` — the served Swagger for `/v1/reminders*` matches `specs/014-local-reminders/contracts/reminder.openapi.yaml` (5 endpoints), mirroring `capture-openapi-parity.e2e-spec.ts`.
- [X] T019 [P] e2e `apps/api/test/reminder-log-privacy.e2e-spec.ts` — creating/updating a reminder with a `custom` label emits **no** label text in captured logs (ids only).
- [X] T020 Run `pnpm --filter @famifinances/api test:cov` and confirm `reminder.repository.ts` (per-member) meets QLT-01's ≥90% high-risk floor; add targeted unit cases if a branch is short.
- [X] T021 Validate the full gate locally: `pnpm --filter @famifinances/api typecheck && pnpm lint && pnpm --filter @famifinances/api build && pnpm --filter @famifinances/api test:e2e`; walk `quickstart.md` scenarios 1–5.

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T003)** block everything.
- **US1 (T004–T009)** depends only on Foundational — it is the **MVP** and can ship alone.
- **US2 (T010–T011)** depends on US1 (it exercises the validation/paths built there); no new production code.
- **US3 (T012–T016)** depends on US1 — it extends the same repository/service/controller (needs a reminder to manage).
- **Polish (T017–T021)** runs after the stories it exercises (isolation/parity/privacy after US1–US3; gate last).
- Same-file chains are sequential: repo T006→T013, service T007→T014, controller T008→T015, module edited by T002/T004/T008. `[P]` marks different-file, dependency-free tasks.

## Parallel Execution Examples

- **Setup/Foundational**: T001 `[P]` then T003 `[P]` alongside T002 review.
- **US1**: T005 `[P]` (dto) with T004/T006 review; T009 `[P]` (e2e) authored alongside T006–T008.
- **US2**: T010 `[P]` (unit) and T011 `[P]` (e2e) together — different files.
- **US3**: T012 `[P]` (dto) alongside T013 review; T016 `[P]` after the endpoints exist.
- **Polish**: T017/T018/T019 `[P]` together; T020 then T021 last.

## Implementation Strategy

- **MVP = US1** (daily capture reminder): the highest-value nudge, shippable with no weekly/monthly UI.
- **Incremental**: US2 confirms the full cadence/validation contract; US3 adds management. Each phase
  ends at a green, independently testable checkpoint.
- **TDD**: write each story's e2e/unit alongside its implementation; keep the suite green (QLT-01 retry
  harness) and never log the label at any step.

---

## Phase 7: Convergence

- [X] T022 Add `familyId` alongside `ownerId` to the reminder repository read/write filters (`findForOwner`, `update`, `deleteForOwner`, `listByOwner`, `countByOwner`) so every query binds owner **and** family from the session, per `data-model.md` validation rules / `plan: per-member scope` defense-in-depth (partial). Isolation already holds via `ownerId`; this is belt-and-suspenders Principle-I scoping. Thread `familyId` from the controller (`@CurrentFamily`) into the repository methods.
