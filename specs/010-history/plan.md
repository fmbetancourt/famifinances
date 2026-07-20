# Implementation Plan: Movement History with Filters (HIS-01)

**Branch**: `010-history` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-history/`

## Summary

HIS-01 adds a **read-only, paginated movement history**: any family member queries the family's non-deleted
TXN-01 movements filtered by a date range, type, account, category, and a case-insensitive note substring — all
combined with AND semantics — returned newest-first in **offset/limit** pages (`limit` default 20 / max 100)
with the total count and a "more results" flag. It introduces **no new collection**: a new
`MovementRepository.searchHistory` runs one family-scoped filtered+paginated query (plus a count), and a
dedicated **`history` module** (`GET /history`) maps the results — keeping TXN-01's existing `GET /movements`
list untouched (non-breaking). All dependencies are **one-way** (history reads movements; nothing reads
history), so **no `forwardRef`**.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`); Node.js 20 LTS; NestJS; Expo/React Native mobile.

**Primary Dependencies**: existing stack — NestJS, Mongoose (MongoDB), `class-validator`/`class-transformer`,
`@nestjs/throttler`, `@nestjs/swagger`. Reuses AUTH-01 (`JwtAuthGuard`), **FAM-01** (`FamilyScopeGuard`,
`@CurrentFamily`), and **TXN-01** (`MovementRepository` — a new `searchHistory` query; `MovementSummary` shape;
the shared `@IsCalendarDate` validator). ACC-01/CAT-01 ids are accepted as opaque family-scoped filters.

**Storage**: MongoDB via Mongoose. **No new collection** — queries the existing `movements` collection; the
`{ familyId, deletedAt, date }` index already backs the base filter + sort.

**Testing**: Jest + Supertest (unit + e2e, `mongodb-memory-server`). Mandatory: filter-correctness
(date-range/type/account/category/search combined with AND; deleted excluded; newest-first order),
note-search (case-insensitive substring; no-note excluded; regex metacharacters escaped), pagination
(limit default/cap, offset, total + hasMore, no overlap), cross-family isolation (foreign account/category →
no cross-family rows), validation, no amounts/notes in logs.

**Target Platform**: iOS/Android (Expo); Node API in a container.

**Project Type**: Mobile + API monorepo (`apps/api`, `apps/mobile`, `packages/contracts`).

**Performance Goals**: pilot scale (3–5 families). A filtered page < 2 s (SC-001): one indexed
find+skip+limit plus one count, both family-scoped.

**Constraints**: family scope from the session, never from caller input (Principle I); deleted movements
excluded; read-only (no mutation); note search escaped to prevent regex injection/ReDoS; no monetary amount or
note content in logs; whole-peso CLP.

**Scale/Scope**: invited pilot; strict isolation/privacy per the constitution.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Assessment | Status |
|---|-----------|------------|--------|
| I | Family Data Isolation (NON-NEGOTIABLE) | Every query is bound to the session `familyId`; account/category filters are opaque ids that only narrow within the family — a foreign id yields no cross-family rows. A cross-family isolation e2e is mandatory. | PASS |
| II | Financial Privacy by Design | Server-side validation on all filters; the note search term is regex-escaped (no injection/ReDoS); no monetary amount or note content in logs (FR-013); access authorized by family; rate-limited via the global throttler. | PASS |
| III | Derived Balance Integrity | Read-only query; excludes deleted movements; computes/stores no balance. Not applicable beyond honoring the movement source of truth. | PASS |
| IV | Test-First & Definition of Done | TDD; filter/search/pagination/isolation/validation tests authored with implementation; OpenAPI documented. | PASS |
| V | Modular Monolith Simplicity | One cohesive `history` module + one repository method; **no new collection**, **one-way** dependency on movements (no `forwardRef`); the existing `GET /movements` list is untouched (non-breaking). | PASS |
| VI | Shared, Documented Contracts | OpenAPI + `packages/contracts` DTO types (reusing `MovementSummary`); TS strict, no `any`; hexagonal repository. | PASS |
| VII | Fast & Accessible Capture UX | Pagination keeps long histories responsive; amounts are CLP; read-only. Status/colour not applicable (a list, not a status). | PASS |

**Result (pre-Phase 0)**: No violations. Complexity Tracking is empty.

**Post-Design re-check (after Phase 1)**: Re-evaluated against `research.md`, `data-model.md`, and
`contracts/history.openapi.yaml`. All gates hold: session-scoped query with mandatory cross-family tests and a
regex-escaped search (I/II); read-only, deleted excluded (III); one module + one repo method, no new collection,
non-breaking (V); OpenAPI + shared contracts reusing `MovementSummary` (VI). No new violations.

## Project Structure

### Documentation (this feature)

```text
specs/010-history/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── history.openapi.yaml
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root) — files HIS-01 adds / edits

```text
apps/api/src/
├── history/
│   ├── history.service.ts              # map searchHistory rows → MovementSummary[]; compute hasMore
│   ├── history.controller.ts           # REST v1 GET /history (any member); parse filters + paging
│   ├── history.module.ts               # imports FamiliesModule, MovementsModule (one-way, no forwardRef)
│   └── dto/
│       └── history-query.ts            # from?, to?, type?, account?, category?, search?, limit?, offset?
├── movements/                          # EDITED (query source)
│   ├── movement.repository.ts          #   add searchHistory(familyId, filters, page) → { items, total }
│   └── movements.module.ts             #   export MovementRepository (consumed by the history service)
└── common/
    └── escape-regex.ts                 # NEW: escape user text for a safe case-insensitive regex

packages/contracts/src/history/         # MovementHistoryQuery, MovementHistoryPage (reuses MovementSummary)
apps/mobile/app/(history)/              # history screen (mobile) — DEFERRED to a later mobile track
```

Reuses `apps/api/src/families/` guards, the AUTH-01 guards, TXN-01's `MovementRepository` +
`MovementSummary`, and the shared `@IsCalendarDate` validator. `MovementsModule` gains a `searchHistory` method
and exports `MovementRepository`.

**Structure Decision**: Keep the established monorepo layout. HIS-01 adds a single cohesive **read-only**
`history` module exposing `GET /history`, deliberately **not** overloading TXN-01's `GET /movements` (whose
`MovementSummary[]` contract stays intact — non-breaking). The filtering/pagination lives in one new
family-scoped `MovementRepository.searchHistory` (a `find` with the combined filter, `sort { date:-1,
createdAt:-1 }`, `skip`/`limit`, plus a `countDocuments`); the note search uses a **regex-escaped**
case-insensitive substring match. Dependencies are one-way (history → movements), so no `forwardRef`. No new
collection is introduced.

## Complexity Tracking

> No constitutional violations. No entries required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
