---

description: "Task list for CAT-01 · System & Family Categories"
---

# Tasks: System & Family Categories (CAT-01)

**Input**: Design documents from `/specs/005-categories/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/categories.openapi.yaml, quickstart.md

**Tests**: INCLUDED (constitution Principle IV · Test-First). Mandatory coverage: system-default seeding
(non-empty both kinds, idempotent), cross-family isolation (custom scoped by session family, foreign id →
404), system-defaults read-only (rename/archive → 403), kind immutable, validation (name trimmed, kind
enum), no category names in logs. Test tasks are written FIRST and must FAIL before implementation.

**Organization**: Grouped by user story (US1–US5). Builds on AUTH-01 (`JwtAuthGuard`, `@CurrentUser`,
`EmailVerifiedGuard`) and FAM-01 (`FamilyScopeGuard`, `@CurrentFamily`) — reused, not rebuilt. Applies the
ACC-01 conventions: `FamilyScopeGuard` before `EmailVerifiedGuard` on writes (no-family → 404), name trimmed
before validation, DTO whitelist rejects unknown fields.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on an incomplete task.
- **[Story]**: US1–US5 from spec.md.

---

## Phase 1: Setup (Shared Contracts)

- [X] T001 [P] Add category DTO types (`CategoryKind`, `CategoryScope`, `CategoryStatusFilter`, `CreateCategoryRequest`, `UpdateCategoryRequest`, `CategorySummary`) mirroring `contracts/categories.openapi.yaml` in `packages/contracts/src/category/index.ts` and re-export from `packages/contracts/src/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The Category entity, its visibility-scoped repository, and the idempotent system-default seeder

**⚠️ CRITICAL**: No user story work begins until this phase is complete

- [X] T002 [P] Create `Category` Mongoose schema (scope `system|family`, kind `income|expense`, name, `familyId` null|ObjectId ref Family **indexed**, `archivedAt` null|Date, `createdBy` null|ObjectId ref Account, timestamps) with a **partial unique index** on `{ scope, kind, name }` where `scope = 'system'` in `apps/api/src/categories/category.schema.ts`
- [X] T003 Create `CategoryRepository` — custom queries bound to `familyId`: `listVisible(familyId, { kind, status })` (system + own active custom), `findVisible(familyId, id)` (system OR own family), `createCustom`, `renameCustom(familyId, id, name)`, `setArchived(familyId, id, archivedAt)`, `upsertSystem(kind, name)` in `apps/api/src/categories/category.repository.ts`
- [X] T004 [P] Create the curated default category set (income + expense) and an idempotent seeder that upserts each by `{ scope: 'system', kind, name }` in `apps/api/src/categories/category.seed.ts`
- [X] T005 Wire `CategoriesModule` (`MongooseModule.forFeature` for Category; import `FamiliesModule` for `FamilyScopeGuard`/`@CurrentFamily`; `OnModuleInit` runs the seeder; provide `CategoriesService` + `CategoryRepository`) and register it in `apps/api/src/categories/categories.module.ts` and `apps/api/src/app.module.ts`

**Checkpoint**: The Category entity + visibility-scoped repository exist; system defaults are seeded on boot.

---

## Phase 3: User Story 1 - See the family's categories (Priority: P1) 🎯 MVP

**Goal**: A member of a brand-new family sees a usable set of categories (system defaults, both kinds) with zero setup.

**Independent Test**: verified member of a new family → `GET /categories` → non-empty set with both income
and expense defaults, each labelled with its kind; no-family → 404.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T006 [P] [US1] e2e for `GET /categories` on a brand-new family (non-empty; both `income` and `expense` defaults present; each has a kind and `scope: system`; `?kind=` filters; no-family → 404 [FamilyScopeGuard]) in `apps/api/test/list-categories.e2e-spec.ts`

### Implementation for User Story 1

- [X] T007 [P] [US1] Create `ListCategoriesQuery` (`kind?` `income|expense`, `status?` `active|archived|all` default `active`) in `apps/api/src/categories/dto/list-categories.query.ts`
- [X] T008 [US1] Implement `CategoriesService.listCategories` (system defaults + the family's active custom, honoring `kind`/`status`) + `CategorySummary` mapping in `apps/api/src/categories/categories.service.ts`
- [X] T009 [US1] Implement `GET /categories` and `GET /categories/{id}` via `JwtAuthGuard` + `FamilyScopeGuard` (404 when not visible / no family) in `apps/api/src/categories/categories.controller.ts`
- [ ] T010 [P] [US1] Mobile category list screen (grouped by kind, showing kind via text+icon) in `apps/mobile/app/(categories)/index.tsx`

**Checkpoint**: Every family sees usable income/expense categories out of the box.

---

## Phase 4: User Story 2 - Create a custom category (Priority: P1)

**Goal**: A verified member adds a family-specific category with a name and a kind.

**Independent Test**: create a custom expense category → 201, `scope: family`; it appears in the family's
list under the expense kind; invalid input → 400.

### Tests for User Story 2 ⚠️ (write first, must fail)

- [X] T011 [P] [US2] e2e for `POST /categories` (201, `scope: family`, appears in list under its kind; missing name / invalid kind / whitespace-only name → 400; a client-supplied `scope` or unknown field → 400 whitelist; no-family → 404) in `apps/api/test/create-category.e2e-spec.ts`

### Implementation for User Story 2

- [X] T012 [P] [US2] Create `CreateCategoryDto` (name trimmed via `@Transform` then 1–80, kind in `income|expense`) in `apps/api/src/categories/dto/create-category.dto.ts`
- [X] T013 [US2] Implement `CategoriesService.createCategory` (scope `family`, `familyId` + `createdBy` from the session; return `CategorySummary`) in `apps/api/src/categories/categories.service.ts`
- [X] T014 [US2] Implement `POST /categories` guarded by `JwtAuthGuard` + `FamilyScopeGuard` + `EmailVerifiedGuard` (FamilyScope before EmailVerified) in `apps/api/src/categories/categories.controller.ts`
- [ ] T015 [P] [US2] Mobile create-category screen (name, kind; one primary action) in `apps/mobile/app/(categories)/create.tsx`

**Checkpoint**: A verified member can add family custom categories.

---

## Phase 5: User Story 3 - Categories stay within the family boundary (Priority: P1)

**Goal**: A family's custom categories are visible/editable only by that family; system defaults are shared.

**Independent Test**: create a custom category in family A; as a member of family B, it is absent from B's
list and `GET/PATCH/POST` its id → 404; both families still see the shared defaults; no-family → 404.

### Tests for User Story 3 ⚠️ (write first, must fail)

- [X] T016 [P] [US3] Authorization e2e: family A's custom category is not visible to family B and `GET/PATCH/archive` its id as B → 404; a foreign `familyId`/`categoryId` in the request is ignored; both families see the system defaults; no-family → 404 (FR-009, SC-003) in `apps/api/test/category-isolation.e2e-spec.ts`

### Implementation for User Story 3

- [X] T017 [US3] Ensure every custom read/write resolves within the session family — `findVisible` matches `system` OR own `family` only, so a foreign custom id → 404; no caller-supplied family/category owner id is trusted (Principle I) in `apps/api/src/categories/category.repository.ts` and `apps/api/src/categories/categories.service.ts`

**Checkpoint**: Cross-family isolation for custom categories verified; defaults stay shared.

---

## Phase 6: User Story 4 - Rename a custom category (Priority: P2)

**Goal**: A verified member renames a family custom category; the kind never changes; defaults are read-only.

**Independent Test**: rename a custom category → 200, kind unchanged; rename a system default → 403; empty/
whitespace name → 400; another family's category → 404.

### Tests for User Story 4 ⚠️ (write first, must fail)

- [X] T018 [P] [US4] e2e for `PATCH /categories/{id}` (rename custom → 200, kind unchanged; system default → 403 read-only; archived → 409; empty/whitespace-only name → 400; cross-family → 404) in `apps/api/test/rename-category.e2e-spec.ts`

### Implementation for User Story 4

- [X] T019 [P] [US4] Create `UpdateCategoryDto` (name only — kind + scope immutable; name trimmed via `@Transform` then 1–80) in `apps/api/src/categories/dto/update-category.dto.ts`
- [X] T020 [US4] Implement `CategoriesService.renameCategory` (`findVisible`; system → **403** read-only; archived custom → **409**; own active custom → update name) + `PATCH /categories/{id}` (`JwtAuthGuard` + `FamilyScopeGuard` + `EmailVerifiedGuard`) in `apps/api/src/categories/categories.service.ts` and controller
- [ ] T021 [P] [US4] Mobile rename action for a custom category in `apps/mobile/app/(categories)/[categoryId]/edit.tsx`

**Checkpoint**: Members can rename their custom categories; kind is immutable; defaults stay read-only.

---

## Phase 7: User Story 5 - Archive a custom category (Priority: P2)

**Goal**: A member archives a custom category (excluded from the active/pickable set) and can restore it; defaults are never removed.

**Independent Test**: archive a custom category → 200, excluded from the default list, retrievable via
`status=archived`; renaming it → 409; unarchive → 200; archiving a system default → 403; no delete route.

### Tests for User Story 5 ⚠️ (write first, must fail)

- [X] T022 [P] [US5] e2e for archive/unarchive (`POST /categories/{id}/archive` → 200, dropped from `status=active`, present in `status=archived`/`all`; `status=archived` returns only the family's archived custom (no system defaults); rename archived → 409; `unarchive` → 200 restored; re-archiving is idempotent → 200; archiving a system default → 403; no delete route) in `apps/api/test/archive-category.e2e-spec.ts`

### Implementation for User Story 5

- [X] T023 [US5] Implement `CategoriesService.archive`/`unarchive` (own custom only; system → **403**; **idempotent** no-op if already in target state) + `POST /categories/{id}/archive` and `POST /categories/{id}/unarchive` (`JwtAuthGuard` + `FamilyScopeGuard` + `EmailVerifiedGuard`), reusing the `status` filter from T008 in `apps/api/src/categories/categories.service.ts` and controller
- [ ] T024 [P] [US5] Mobile archive/unarchive action on a custom category in `apps/mobile/app/(categories)/[categoryId]/index.tsx`

**Checkpoint**: Custom-category archive lifecycle works; defaults are immutable; nothing is deleted.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T025 [P] Seeding e2e: system defaults are seeded (both kinds non-empty) and the seeder is **idempotent** — re-running it does not duplicate defaults (unique index on system `{scope,kind,name}`) in `apps/api/test/category-seed.e2e-spec.ts`
- [X] T026 [P] No-category-names-in-logs e2e: category names never appear in logs across seed/list/create/rename/archive (FR-015, SC-008, Constitution II) in `apps/api/test/category-log-privacy.e2e-spec.ts`
- [X] T027 [P] OpenAPI parity check: the generated document matches `specs/005-categories/contracts/categories.openapi.yaml` (scoped to the `categories` surface) in `apps/api/test/category-openapi-parity.e2e-spec.ts`
- [X] T028 [P] Document the categories module (system vs family scope, read-only defaults, immutable kind as the classification foundation TXN-01/BUD-01 build on) in `apps/api/README.md`
- [X] T029 Execute `specs/005-categories/quickstart.md` end-to-end and record results, including the SC-002 (create < 1 min) timing observation
- [X] T030 [P] Verify `packages/contracts` category types compile against the API (no `any`) via `pnpm typecheck`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: contracts types — no dependencies.
- **Foundational (Phase 2)**: Category schema + visibility-scoped repository + idempotent seeder — BLOCKS all
  user stories.
- **User Stories (Phase 3–7)**: depend on Foundational.
  - US1 (P1): depends on the seeder (defaults must exist) — independent otherwise.
  - US2 (P1): independent (create custom).
  - US3 (P1): depends on the visibility-scoped repository (Foundational) + at least one custom category (US2);
    verifies isolation + shared defaults.
  - US4 (P2): depends on US2 (a custom category to rename) + the read-only-defaults rule.
  - US5 (P2): depends on US2 (a custom category to archive) + the `status` filter from US1.
- **Polish (Phase 8)**: after the stories.

### Within Each User Story

- Tests are written and MUST FAIL before implementation.
- Schema/repository/seeder before services; services before endpoints; core before mobile.

### Parallel Opportunities

- Foundational: T002 with contract types; T004 (seed data) in parallel with T002/T003; T003 after T002;
  T005 after T002/T003/T004.
- Within a story, `[P]` tests and `[P]` DTOs run before their service.
- Mobile screens (`[P]`) can proceed alongside their story's API once the contract is fixed.

---

## Implementation Strategy

### MVP scope

- **Minimal deployable slice**: Foundational + **US1** (a family sees seeded defaults).
- **Recommended demo MVP**: through **US3** (defaults + create custom + isolation) — the full P1 set and the
  classification foundation that unlocks TXN-01/BUD-01.

### Incremental delivery

1. Setup + Foundational → entity + scoped repository + seeded defaults ready.
2. US1 → US2 → US3 (P1 core) → validate/demo.
3. US4 (rename) → US5 (archive/unarchive).
4. Polish: seeding idempotency, log-privacy, OpenAPI parity, docs, quickstart, contracts typecheck.

---

## Notes

- Reuses AUTH-01 (`JwtAuthGuard`, `@CurrentUser`, `EmailVerifiedGuard`) and FAM-01 (`FamilyScopeGuard`,
  `@CurrentFamily`, exported by `FamiliesModule`).
- Applies ACC-01 hardening up front: `FamilyScopeGuard` before `EmailVerifiedGuard` (no-family → 404), name
  trimmed before validation (whitespace-only → 400), DTO whitelist rejects unknown/`scope` fields.
- Constitution gates covered: family-from-session isolation (T016), system-defaults read-only (T018/T022),
  immutable kind (T018 — update contract has no kind), seeding zero-setup (T006/T025), no-secrets-in-logs
  (T026), OpenAPI contract (T027), shared typed contracts (T001/T030). Principle III foundation: the `kind`
  is the integrity anchor TXN-01 enforces.
- Verify each test fails before implementing; commit after each task or logical group (conventional commits).
