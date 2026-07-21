# Tasks: Capture Templates & Defaults (UX-01)

**Feature**: UX-01 · Plantillas y defaults de captura
**Branch**: `013-capture-templates`
**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/capture.openapi.yaml`, `quickstart.md`

Tests are **included** — the constitution (Principle IV) makes authorization and money-movement
coverage mandatory, and every prior slice ships e2e + an OpenAPI-parity suite.

**Guard conventions** (from plan/research): reads use `JwtAuthGuard` + `FamilyScopeGuard`; writes add
`EmailVerifiedGuard` (guard order `FamilyScope → Email`, so no-family = 404 and unverified = 403);
**no `FamilyRoleGuard`** — any family member manages templates (FR-013).

---

## Phase 1: Setup

- [X] T001 [P] Add shared capture contract types in `packages/contracts/src/capture/index.ts` — `CaptureDefaults`, `CreateTemplateRequest`, `UpdateTemplateRequest`, `MovementTemplateSummary` (reuse `MovementType`), matching `contracts/capture.openapi.yaml`; export the module from `packages/contracts/src/index.ts`.

---

## Phase 2: Foundational (blocking prerequisites)

- [X] T002 Create `apps/api/src/capture/capture.module.ts` importing `FamiliesModule` (FamilyScopeGuard), `MovementsModule` (MovementRepository), `CategoriesModule` (CategoryRepository), `FinancialAccountsModule` (FinancialAccountRepository) and a placeholder `MongooseModule.forFeature([])` — **one-way deps, no `forwardRef`** — and register `CaptureModule` in `apps/api/src/app.module.ts`.
- [X] T003 [P] Create shared e2e helpers `apps/api/test/capture-helpers.ts` — register a verified user with a family, seed one active account and one expense/one income category, and expose auth headers + ids (mirror `budget-helpers.ts`/`dashboard-helpers.ts`).

**Checkpoint**: `CaptureModule` compiles and is wired; contract types are importable; helpers ready.

---

## Phase 3: User Story 1 — Capture defaults (Priority: P1) 🎯 MVP

**Goal**: A member's add-movement flow is pre-filled with their last-used account/category/type
(plus today's date), derived on read; only the amount remains to enter.

**Independent test**: With a member who recorded (account A, category X, expense), `GET /v1/capture-defaults`
returns A/X/expense/today; after recording B/Y it returns B/Y; with no movements it returns all-null.

- [X] T004 [US1] Add read-only `findLatestByMember(familyId, memberId)` to `apps/api/src/movements/movement.repository.ts` — latest `{ familyId, createdBy: memberId, deletedAt: null }` by `date desc, createdAt desc`, or `null` (reuses the `{ familyId, deletedAt, date }` index).
- [X] T005 [US1] Create `apps/api/src/capture/capture-defaults.service.ts` — derive `{ type, accountId, categoryId, date }` from the member's latest movement; null-out `accountId` when the account is archived/missing (`FinancialAccountRepository.findInFamily`), null-out `categoryId` when the category is archived/missing or its `kind !== type` (`CategoryRepository.findVisible`); `date` = today `YYYY-MM-DD`.
- [X] T006 [US1] Create `apps/api/src/capture/capture-defaults.controller.ts` — `GET /v1/capture-defaults` (`@Controller({ path: 'capture-defaults', version: '1' })`, `JwtAuthGuard` + `FamilyScopeGuard`, `@CurrentFamily` + `@CurrentUser`, `@ApiTags('capture')` + `@ApiBearerAuth`); register controller + service in `capture.module.ts`.
- [X] T007 [P] [US1] e2e `apps/api/test/capture-defaults.e2e-spec.ts` — empty (all-null), last-used derivation, auto-update after a new movement, broken-reference null-out (archive the account/category), and per-member/family scoping.

**Checkpoint**: US1 is independently shippable — capture defaults work end to end.

---

## Phase 4: User Story 2 — Movement templates: create & apply (Priority: P2)

**Goal**: A member creates named templates (type + category + account, optional amount/note) and the
client reads them to pre-fill the add-movement flow; broken references are flagged, not fatal.

**Independent test**: Create "Feria semanal" (expense, cat X, acct A); it appears in the list with
`accountAvailable/categoryAvailable = true`; a kind≠type or bad-reference create returns 400; a
duplicate name returns 409; a foreign id returns 404.

- [X] T008 [P] [US2] Create `apps/api/src/capture/movement-template.schema.ts` — collection `movementTemplates` with fields + indexes per `data-model.md` (`{familyId,name}` unique, `{familyId}`); register it in `MongooseModule.forFeature` in `capture.module.ts`.
- [X] T009 [P] [US2] Create `apps/api/src/capture/dto/create-template.dto.ts` — `name`/`type`/`accountId`/`categoryId` required, `amount?`/`note?` optional, with `class-validator` + `@ApiProperty` decorators (positive-int amount, maxlengths).
- [X] T010 [US2] Create `apps/api/src/capture/movement-template.repository.ts` — family-scoped `create`, `findInFamily`, `listByFamily`, `existsByName` (case-insensitive), plus a set-based `resolveAvailability(familyId, templates)` helper returning per-template `accountAvailable`/`categoryAvailable` (bounded queries, not N).
- [X] T011 [US2] Create `apps/api/src/capture/capture-templates.service.ts` — `create`/`list`/`get`; validate account active, category visible+active+`kind===type`, non-blank family-unique name (409), positive amount (reuse the TXN-01 validation shape); map to `MovementTemplateSummary` with availability flags; log ids only.
- [X] T012 [US2] Add `POST /v1/capture-templates`, `GET /v1/capture-templates`, `GET /v1/capture-templates/:templateId` to `apps/api/src/capture/capture-templates.controller.ts` — reads `JwtAuthGuard`+`FamilyScopeGuard`; POST adds `EmailVerifiedGuard`; `@ApiTags('capture')`+`@ApiBearerAuth`; register controller + service in `capture.module.ts`.
- [X] T013 [P] [US2] Unit `apps/api/src/capture/capture-templates.service.spec.ts` — kind≠type rejected, missing/archived account/category rejected, duplicate name → 409, non-blank amount rules (uses repository stubs).
- [X] T014 [P] [US2] e2e `apps/api/test/capture-template-crud.e2e-spec.ts` — create → list → get; a non-Owner **Member** can create (FR-013); availability flags true when refs intact.
- [X] T015 [P] [US2] e2e `apps/api/test/capture-template-validation.e2e-spec.ts` — kind≠type (400), missing/archived account or category (400), duplicate name (409), whitespace-only name (400), non-positive amount (400).
- [X] T016 [P] [US2] e2e `apps/api/test/capture-template-isolation.e2e-spec.ts` — a foreign family's template id → 404 on GET/PATCH/DELETE (Principle I).

**Checkpoint**: US2 is independently shippable — templates can be created, listed, read, and applied client-side.

---

## Phase 5: User Story 3 — Curate & maintain templates (Priority: P3)

**Goal**: Members rename/edit/delete templates, and templates/defaults degrade gracefully when a
referenced account/category is later removed.

**Independent test**: Edit a template (200); delete it (204, gone from list); archive a referenced
account and confirm the template lists with `accountAvailable: false` (not an error); a duplicate
rename returns 409.

- [X] T017 [P] [US3] Create `apps/api/src/capture/dto/update-template.dto.ts` — all fields optional (partial), same per-field validation as create.
- [X] T018 [US3] Extend `apps/api/src/capture/movement-template.repository.ts` with family-scoped `update` (findOneAndUpdate, `{new:true}`) and `deleteInFamily` (hard delete, returns deleted-or-null).
- [X] T019 [US3] Extend `apps/api/src/capture/capture-templates.service.ts` with `update` (re-validate effective type/account/category + family-unique rename → 409; require ≥1 field) and `delete` (404 when absent).
- [X] T020 [US3] Add `PATCH /v1/capture-templates/:templateId` and `DELETE /v1/capture-templates/:templateId` (204) to `apps/api/src/capture/capture-templates.controller.ts` — both add `EmailVerifiedGuard`; `@ApiBearerAuth`.
- [X] T021 [P] [US3] e2e `apps/api/test/capture-template-manage.e2e-spec.ts` — rename/edit (200), delete (204 + gone), duplicate rename (409), and broken-reference degradation: archive the account → list shows `accountAvailable: false` without erroring.

**Checkpoint**: All three stories are complete and independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T022 [P] e2e `apps/api/test/capture-openapi-parity.e2e-spec.ts` — the served Swagger for `/v1/capture-*` matches `specs/013-capture-templates/contracts/capture.openapi.yaml` (paths, methods, status codes, schema shapes), mirroring `budget-openapi-parity.e2e-spec.ts`.
- [X] T023 [P] e2e `apps/api/test/capture-log-privacy.e2e-spec.ts` — creating/updating a template with an amount + note emits **no** amount/note in captured logs (ids only), like `budget-log-privacy.e2e-spec.ts`.
- [X] T024 Run `pnpm --filter @famifinances/api test:cov` and confirm `movement-template.repository.ts` (family-scoped) meets QLT-01's ≥90% high-risk floor; add targeted unit cases if a branch is short.
- [X] T025 Validate the full gate locally: `pnpm --filter @famifinances/api typecheck && pnpm lint && pnpm --filter @famifinances/api build && pnpm --filter @famifinances/api test:e2e` (green, no flake); walk `quickstart.md` scenarios 1–6.

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T003)** block everything.
- **US1 (T004–T007)** depends only on Foundational — it is the **MVP** and can ship alone.
- **US2 (T008–T016)** depends on Foundational; independent of US1 (different files/endpoints).
- **US3 (T017–T021)** depends on **US2** (extends the same repository/service/controller and needs a template to curate).
- **Polish (T022–T025)** runs after the stories it exercises (parity/privacy after US2/US3; gate last).
- Within a phase, tasks touching the **same file** are sequential (e.g., T011→T019, T012→T020, T010→T018); `[P]` marks different-file, dependency-free tasks.

## Parallel Execution Examples

- **Foundational**: T003 `[P]` can run alongside T002 review once the module compiles.
- **US1**: T007 `[P]` (e2e) authored in parallel with T004–T006 (TDD).
- **US2**: T008/T009 `[P]` (schema, dto) together; then T010→T011→T012 (same-file chain); T013/T014/T015/T016 `[P]` (distinct test files) together.
- **US3**: T017 `[P]` (dto) alongside T018 review; T021 `[P]` after endpoints exist.
- **Polish**: T022/T023 `[P]` together; T024 then T025 last.

## Implementation Strategy

- **MVP = US1** (capture defaults): the highest-leverage, lowest-effort friction reducer; ships without any template code.
- **Incremental**: layer US2 (create/apply templates) then US3 (curate). Each phase ends at a green, independently testable checkpoint.
- **TDD**: write each story's e2e/unit alongside its implementation; keep the suite green (QLT-01 retry harness) and no amount/note in logs at every step.
