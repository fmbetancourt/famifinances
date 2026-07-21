# Tasks: CSV Export (EXP-01)

**Feature**: EXP-01 · Exportación CSV
**Branch**: `015-csv-export`
**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/export.openapi.yaml`, `quickstart.md`

Tests are **included** — the constitution (Principle IV) makes authorization coverage mandatory, and
every prior slice ships e2e + an OpenAPI-parity suite.

**Guard conventions**: both exports are **reads** → `JwtAuthGuard` + `FamilyScopeGuard`; **any member**
(no email/role gate), like the history. Every source read binds `familyId` from the session
(Principle I). Responses are `text/csv; charset=utf-8` with a `Content-Disposition` attachment.

---

## Phase 1: Setup

- [X] T001 [P] Create the RFC-4180 CSV writer `apps/api/src/export/csv-writer.ts` — a pure `buildCsv(headers: string[], rows: string[][]): string` that prefixes a UTF-8 BOM, joins with commas + CRLF, and quotes any field containing a comma/quote/CR/LF (inner quotes doubled).
- [X] T002 [P] Unit `apps/api/src/export/csv-writer.spec.ts` — escaping (comma, double quote, newline), BOM prefix, CRLF line ends, header-only output for zero rows, accents preserved.

---

## Phase 2: Foundational (blocking prerequisites)

- [X] T003 Create `apps/api/src/export/export.module.ts` importing `MovementsModule`, `TransfersModule`, `FinancialAccountsModule`, `CategoriesModule`, `AccountsModule`, `FamiliesModule` (**one-way deps, no `forwardRef`**) with placeholder controller/providers, and register `ExportModule` in `apps/api/src/app.module.ts`.
- [X] T004 [P] Create shared e2e helpers `apps/api/test/export-helpers.ts` — a verified member with a family, a **second (non-owner) member joined to the same family**, a second family, seeders for movements/transfers/accounts/categories, and a small CSV parser (respecting RFC-4180 quoting) to assert header + rows.

**Checkpoint**: `ExportModule` compiles and is wired; the CSV writer + helpers are ready.

---

## Phase 3: User Story 1 — Export movements to CSV (Priority: P1) 🎯 MVP

**Goal**: A member downloads a CSV of the family's non-deleted movements with readable columns
(Spanish headers, `Ingreso`/`Gasto`, account/category names, author email).

**Independent test**: `GET /v1/export/movements` → `200 text/csv` with the header
`Fecha,Tipo,Monto,Cuenta,Categoría,Nota,Autor,Creado` and one row per non-deleted movement; exporting
with no movements returns a header-only file.

- [X] T005 [US1] Add `findForExport(familyId, filters)` to `apps/api/src/movements/movement.repository.ts` — all non-deleted matching movements (newest first, no paging); **extract the shared filter builder** used by `searchHistory` so the two never diverge.
- [X] T006 [US1] Add `findEmailsByIds(ids: string[])` to `apps/api/src/accounts/account.repository.ts` — one query returning the `{ id → email }` map for the given account ids (author resolution). **Document the isolation invariant** in a code comment: this method is **not** family-scoped, so callers MUST pass only `createdBy` ids derived from the caller's own family rows (the service does); isolation rests on the id-set, and the cross-family e2e (T017) proves the outcome.
- [X] T007 [P] [US1] Create `apps/api/src/export/dto/export-movements.query.ts` — the HIS-01 filters (`from`, `to`, `type`, `account`, `category`, `search`), **no** `limit`/`offset`, with `class-validator` decorators (mirror `history-query.ts`).
- [X] T008 [US1] Create `apps/api/src/export/export.service.ts` — `exportMovements(familyId, filters)`: fetch via `findForExport`; build `id → name` maps (`FinancialAccountRepository.findByFamily(familyId, 'all')`, `CategoryRepository.listVisible(familyId, 'all')`) and the author `id → email` map; render rows (date `YYYY-MM-DD`, `Ingreso`/`Gasto`, integer amount, names, note, email) via `buildCsv`; log **row count only**. Register the service in `export.module.ts`.
- [X] T009 [US1] Create `apps/api/src/export/export.controller.ts` — `GET /v1/export/movements` (`JwtAuthGuard` + `FamilyScopeGuard`, `@CurrentFamily`, `@Query() ExportMovementsQuery`); set `Content-Type: text/csv; charset=utf-8` + `Content-Disposition: attachment; filename="movimientos-<today>.csv"`; `@ApiTags('export')` + `@ApiBearerAuth`. Register the controller in `export.module.ts`.
- [X] T010 [P] [US1] e2e `apps/api/test/export-movements.e2e-spec.ts` — full export: `200 text/csv`, header row, one row per movement with `Ingreso`/`Gasto` + account/category names + author email; the **empty** case (header-only, not an error); and a **non-owner Member** of the family can export successfully (FR-011).

**Checkpoint**: US1 is independently shippable — movements export works end to end.

---

## Phase 4: User Story 2 — Filtered export (Priority: P2)

**Goal**: A member exports only a slice (period/account/category/type/note) using the HIS-01 filters.
(The filter logic ships in US1's `findForExport`; US2 proves it end to end.)

**Independent test**: `GET /v1/export/movements?from=…&to=…&account=…` returns only the matching rows;
a filter matching nothing returns a header-only file.

> **Note (intentional)**: US2 has **no production tasks** — `findForExport` (T005) already applies the
> HIS-01 filters. US2 is the test phase that proves the filtered paths; this is by design, not a gap.

- [X] T011 [US2] Extend `apps/api/test/export-movements.e2e-spec.ts` with filtered cases: date range, account, category, type and `search`; combined AND; and a no-match filter → header-only file.

**Checkpoint**: US2 complete — filtered export matches HIS-01 semantics.

---

## Phase 5: User Story 3 — Export transfers (Priority: P3)

**Goal**: A member downloads a CSV of the family's non-deleted transfers (origin/destination account
names, amount, author email).

**Independent test**: `GET /v1/export/transfers` → `200 text/csv` with header
`Fecha,Cuenta origen,Cuenta destino,Monto,Autor,Creado` and one row per non-deleted transfer.

- [X] T012 [US3] Export `TransferRepository` from `apps/api/src/transfers/transfers.module.ts` (add it to `exports`) so `ExportModule` can read transfers.
- [X] T013 [US3] Add `exportTransfers(familyId)` to `apps/api/src/export/export.service.ts` — `TransferRepository.listByFamily(familyId, {})` (non-deleted); reuse the account `id → name` map and the author `id → email` map; render rows via `buildCsv`; log row count only.
- [X] T014 [US3] Add `GET /v1/export/transfers` to `apps/api/src/export/export.controller.ts` — same guards/headers as movements; filename `transferencias-<today>.csv`.
- [X] T015 [P] [US3] e2e `apps/api/test/export-transfers.e2e-spec.ts` — transfers export: header + one row per transfer with origin/destination names, integer amount, author email; empty case header-only.

**Checkpoint**: all three stories complete and independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T016 [P] e2e `apps/api/test/export-escaping.e2e-spec.ts` — a note with a comma/double-quote/newline stays in one correctly-quoted cell; accents (tildes/ñ) survive; a soft-deleted movement is excluded.
- [X] T017 [P] e2e `apps/api/test/export-isolation.e2e-spec.ts` — a member of a second family exports and the file contains **only** their own rows, never the other family's (Principle I, FR-004).
- [X] T018 [P] e2e `apps/api/test/export-openapi-parity.e2e-spec.ts` — the served Swagger for `/v1/export/*` matches `specs/015-csv-export/contracts/export.openapi.yaml` (2 endpoints), mirroring prior parity suites.
- [X] T019 [P] e2e `apps/api/test/export-log-privacy.e2e-spec.ts` — exporting a movement + transfer with an amount and a note emits **no** amount/note/email text in captured logs (row count only).
- [X] T020 Run `pnpm --filter @famifinances/api test:cov` and confirm the new `*.repository.ts` methods (`findForExport`, `findEmailsByIds`) meet QLT-01's ≥90% high-risk floor; add targeted unit cases if a branch is short.
- [X] T021 Validate the full gate locally: `pnpm --filter @famifinances/api typecheck && pnpm lint && pnpm --filter @famifinances/api build && pnpm --filter @famifinances/api test:e2e`; walk `quickstart.md` scenarios 1–5.

---

## Dependencies & Execution Order

- **Setup (T001–T002)** → **Foundational (T003–T004)** block everything.
- **US1 (T005–T010)** depends only on Setup/Foundational — it is the **MVP** and can ship alone.
- **US2 (T011)** depends on US1 (extends its e2e; no new production code).
- **US3 (T012–T015)** depends on US1 — it extends the same service/controller and reuses US1's name/email maps.
- **Polish (T016–T021)** runs after the stories it exercises; gate last.
- Same-file chains are sequential: service T008→T013, controller T009→T014, module T003/T008/T009, e2e T010→T011. `[P]` marks different-file, dependency-free tasks.

## Parallel Execution Examples

- **Setup**: T001 + T002 `[P]` (writer + its unit, TDD) together.
- **Foundational**: T004 `[P]` (helpers) alongside T003 review.
- **US1**: T007 `[P]` (dto) with T005/T006 (repo methods); T010 `[P]` (e2e) authored alongside T008/T009.
- **US3**: T015 `[P]` (e2e) after T012–T014.
- **Polish**: T016/T017/T018/T019 `[P]` together; T020 then T021 last.

## Implementation Strategy

- **MVP = US1** (movements export): the highest-value portability slice, shippable without transfers.
- **Incremental**: US2 proves filtered export; US3 adds transfers for complete portability. Each phase
  ends at a green, independently testable checkpoint.
- **TDD**: write each story's e2e/unit alongside its implementation; keep the suite green (QLT-01 retry
  harness) and never log an amount/note/email at any step.
