---
description: "Task list for HIS-01 · Movement History with Filters"
---

# Tasks: Movement History with Filters (HIS-01)

**Input**: Design documents from `/specs/010-history/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/history.openapi.yaml, quickstart.md

**Tests**: TDD is mandatory (Constitution Principle IV — Test-First). Each user story's e2e tests are authored
**before** its implementation and must fail first.

**Organization**: Tasks are grouped by user story (US1–US4). HIS-01 is a **read-only query** feature — it adds
no collection; a single new `MovementRepository.searchHistory` method is built up across the stories and a
dedicated `history` module exposes `GET /history` (TXN-01's `GET /movements` stays untouched).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2 / US3 / US4 (setup, foundational, polish carry no story label)
- All paths are repo-relative.

## Path Conventions

Monorepo: API in `apps/api/src/`, e2e in `apps/api/test/`, shared contracts in `packages/contracts/src/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Module skeleton and shared contract types.

- [X] T001 Create the `apps/api/src/history/` directory and register a `HistoryModule` placeholder in `apps/api/src/app.module.ts` (imports list only; wired fully in T006)
- [X] T002 [P] Add shared contract types in `packages/contracts/src/history/index.ts` (`MovementHistoryQuery`, `MovementHistoryPage`; reuse `MovementSummary` from the movement module) and re-export from `packages/contracts/src/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The regex-escape util, the query DTO, the repository export, and the module/controller shell —
required before any story.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

- [X] T003 [P] Create `escapeRegex(term)` in `apps/api/src/common/escape-regex.ts` — escape all regex metacharacters so a user search term is safe for a `$regex` match (no injection / ReDoS)
- [X] T004 [P] Create `HistoryQuery` in `apps/api/src/history/dto/history-query.ts` — `from?`/`to?` `@IsCalendarDate`, `type?` `@IsIn(MOVEMENT_TYPES)`, `account?`/`category?` string, `search?` trimmed `@MaxLength(100)`, `limit?` `@Type(()=>Number) @IsInt @Min(1) @Max(100)` (default 20), `offset?` `@Type(()=>Number) @IsInt @Min(0)` (default 0)
- [X] T005 Export `MovementRepository` from `apps/api/src/movements/movements.module.ts` (add to `exports`) so the history service can query it
- [X] T006 Wire `apps/api/src/history/history.module.ts` (import `FamiliesModule`, `MovementsModule`; provide `HistoryService`; register `HistoryController`), add `HistoryService` in `apps/api/src/history/history.service.ts` and `HistoryController` (`GET /history`, guards `JwtAuthGuard, FamilyScopeGuard`) in `apps/api/src/history/history.controller.ts` (depends on T004, T005)

**Checkpoint**: Module compiles and is registered; user stories can begin.

---

## Phase 3: User Story 1 - Filter by date range and type (Priority: P1) 🎯 MVP

**Goal**: Any member lists the family's non-deleted movements within a date range and optional type, newest first.

**Independent Test**: With movements across dates/types (some deleted), `GET /history?from=&to=&type=` returns
only the matching non-deleted movements, newest first.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T007 [P] [US1] Create `apps/api/test/history-helpers.ts` (`getHistory(app, token, query?)`) and an e2e spec `apps/api/test/history-date-type.e2e-spec.ts` — date-range filter; type filter; deleted excluded; newest-first order; empty result → empty page (not error)

### Implementation for User Story 1

- [X] T008 [US1] Implement `MovementRepository.searchHistory(familyId, filters, { limit, offset })` in `apps/api/src/movements/movement.repository.ts` — filter `{ familyId, deletedAt:null }` + date range (`$gte from`, `$lte to`) + `type`; `sort({ date:-1, createdAt:-1 })`; `skip(offset).limit(limit)`; `countDocuments(sameFilter)` → `{ items, total }` (depends on T005)
- [X] T009 [US1] Implement `HistoryService.search(familyId, query)` in `apps/api/src/history/history.service.ts` — call `searchHistory`, map docs → `MovementSummary`, return `{ items, total, limit, offset, hasMore = offset + items.length < total }`; controller passes the `HistoryQuery` (depends on T006, T008)
- [X] T010 [P] [US1] Unit test in `apps/api/src/history/history.service.spec.ts` — `hasMore`, `limit`/`offset` echo, and summary mapping (with a mocked repository)

**Checkpoint**: US1 functional — date/type-filtered, paginated, newest-first history.

---

## Phase 4: User Story 2 - Filter by account and category (Priority: P1)

**Goal**: Narrow the history to an account and/or category; all filters combine with AND.

**Independent Test**: Filter by one account and one category and confirm only movements matching both (and other
active filters) are returned; a foreign/malformed id returns an empty page.

### Tests for User Story 2 ⚠️ (write first, must fail)

- [X] T011 [P] [US2] e2e spec `apps/api/test/history-account-category.e2e-spec.ts` — account filter; category filter; combined date+type+account+category apply together (AND); a foreign/malformed account or category id → empty `items` (no cross-family rows)

### Implementation for User Story 2

- [X] T012 [US2] Extend `MovementRepository.searchHistory` in `apps/api/src/movements/movement.repository.ts` — add `accountId` and `categoryId` clauses when provided; a non-`ObjectId.isValid` id short-circuits to an empty result (depends on T008)

**Checkpoint**: US1 + US2 — date/type/account/category filters combine with AND.

---

## Phase 5: User Story 3 - Search by note text (Priority: P2)

**Goal**: Case-insensitive substring search over the note, combined with the other filters.

**Independent Test**: Search a term and confirm only movements whose note contains it (case-insensitive) return;
no-note movements are excluded; a term with regex metacharacters is matched literally.

### Tests for User Story 3 ⚠️ (write first, must fail)

- [X] T013 [P] [US3] e2e spec `apps/api/test/history-search.e2e-spec.ts` — case-insensitive substring match; movements without a note excluded from a search; combined with other filters; a metacharacter term (e.g. `.*`) is escaped (literal match, no injection); a blank/whitespace `search` returns all movements (note-less ones included — no filter applied)

### Implementation for User Story 3

- [X] T014 [US3] Extend `MovementRepository.searchHistory` in `apps/api/src/movements/movement.repository.ts` — add a `note` `{ $regex: escapeRegex(search), $options:'i' }` clause **only when `search` is non-empty after trim** (a blank/whitespace search omits the clause, so note-less movements are not excluded) (depends on T008, T003)

**Checkpoint**: US1–US3 — filters + escaped note search.

---

## Phase 6: User Story 4 - Paginate the history (Priority: P2)

**Goal**: Offset/limit pages with `total` and `hasMore`; page size bounded (default 20, max 100).

**Independent Test**: With more movements than a page, `limit`/`offset` return bounded, non-overlapping pages
with accurate `total`/`hasMore`; an over-max or non-positive `limit` is rejected.

### Tests for User Story 4 ⚠️ (write first, must fail)

- [X] T015 [P] [US4] e2e spec `apps/api/test/history-pagination.e2e-spec.ts` — first/next page bounded by `limit`, no overlap; `total` accurate; `hasMore` flips false on the last page; `limit>100` and `limit=0` → 400

### Implementation for User Story 4

- [X] T016 [US4] Confirm the `limit` default 20 / max 100 and `offset` ≥ 0 validation in `apps/api/src/history/dto/history-query.ts` and the `total`/`hasMore` computation in `apps/api/src/history/history.service.ts`; harden if T015 surfaces a gap (depends on T004, T009)

**Checkpoint**: All four stories functional.

---

## Phase 7: Isolation & Contract Parity (Priority: P1)

- [X] T017 [P] e2e spec `apps/api/test/history-isolation.e2e-spec.ts` — a member of family B sees only family B's (empty) history; filtering by family A's account/category id returns nothing; a caller with no family → 404
- [X] T018 [P] e2e spec `apps/api/test/history-openapi-parity.e2e-spec.ts` — the implemented `/history` surface matches `specs/010-history/contracts/history.openapi.yaml` (regex over the yaml, scoped to the `/history` prefix; exactly 1 endpoint)

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T019 [P] e2e spec `apps/api/test/history-log-privacy.e2e-spec.ts` — no monetary amount or note content appears in stdout/stderr while querying the history (FR-013 / SC-007)
- [X] T020 [P] Execute the `specs/010-history/quickstart.md` scenarios (1–5) against the running API
- [X] T021 Run the full gate: `pnpm --filter @famifinances/contracts build`, `pnpm lint`, `pnpm --filter @famifinances/api typecheck`, `pnpm --filter @famifinances/api test`, `pnpm --filter @famifinances/api test:e2e` — all green

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)**: no dependencies.
- **Foundational (P2)**: depends on Setup; **blocks all stories**. T006→T004,T005.
- **US1 (P3)**: depends on Foundational. T008→T005; T009→T006,T008.
- **US2 (P4)**: extends `searchHistory` (T012→T008).
- **US3 (P5)**: extends `searchHistory` (T014→T008,T003).
- **US4 (P6)**: DTO + service (T016→T004,T009).
- **Isolation/Parity (P7)**: depends on US1–US3 (exercise filters + scope).
- **Polish (P8)**: after all desired stories.

### Same-file sequencing (not parallel)

- `movement.repository.ts` (`searchHistory`): T008 → T012 → T014 (sequential).
- `history.service.ts`: T009 → T016 (sequential).

### Parallel Opportunities

- Setup: T002 ∥ T001.
- Foundational: T003 ∥ T004 ∥ T005 (then T006).
- Story tests: T007 ∥ T010 (US1); T011 (US2); T013 (US3); T015 (US4); T017 ∥ T018 (P7); T019 (P8) — all different files.

---

## Implementation Strategy

### MVP (US1 + US2)

1. Phase 1 Setup → Phase 2 Foundational.
2. US1 (date/type + pagination skeleton) → US2 (account/category) — the core filtered history, demoable.
3. US3 (search), US4 (pagination hardening), then isolation/parity/polish.

### Incremental Delivery

US1 → US2 → US3 → US4 → isolation/parity → polish. Each story is independently testable; `searchHistory` grows
one filter clause at a time.

---

## Notes

- [P] = different files, no incomplete dependencies.
- TDD: author each story's e2e spec first and confirm it fails before implementing.
- Reuse e2e helpers (`setupMemberWithAccount`, `createCategory`, `recordMovement`); e2e runs serial
  (`mongodb-memory-server`, `maxWorkers 1`).
- No new collection, no `forwardRef`; `GET /movements` stays untouched (non-breaking).
- Commit after each task or logical group; conventional commits in English.
