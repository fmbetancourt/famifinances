# Implementation Plan: CSV Export (EXP-01)

**Branch**: `015-csv-export` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-csv-export/`

## Summary

EXP-01 gives a family **basic data portability**: two authenticated, family-scoped endpoints that
stream the family's **movements** (income/expense, with the HIS-01 filters) and **transfers** as
downloadable **CSV** files. This slice is **backend-only** — the CSV is generated **on demand** and
returned in the response (no stored artifact, no async job, no third-party storage); the mobile
download/share button is deferred to the mobile track. It is **export-only** (import IMP-01 is Won't).
The CSV is **UTF-8 + BOM, comma-delimited, RFC-4180-quoted**, with **Spanish human-readable headers**
and the **author shown as the member's email**. It reads existing movements/transfers/accounts/
categories one-way (no new collection, no `forwardRef`), resolving ids to readable names/emails.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`); Node.js 20 LTS; NestJS 10; Mongoose 8; pnpm 10.

**Primary Dependencies**: existing stack — NestJS, `@nestjs/mongoose`, `@nestjs/swagger`,
`class-validator`/`class-transformer`, `@famifinances/contracts`. Reuses AUTH-01 (`JwtAuthGuard`,
`@CurrentUser`, `AccountRepository`), FAM-01 (`FamilyScopeGuard`, `@CurrentFamily`), TXN-01/HIS-01
(`MovementRepository`), TXN-02 (`TransferRepository`), ACC-01 (`FinancialAccountRepository`), CAT-01
(`CategoryRepository`). **No new runtime dependency** — a small hand-rolled RFC-4180 CSV writer
(Principle V), no CSV library.

**Storage**: MongoDB (read-only). **No new collection**; nothing persisted. The CSV is built in memory
and returned.

**Testing**: Jest + Supertest e2e on the shared `mongodb-memory-server` harness (QLT-01), plus a unit
spec for the CSV writer (escaping/BOM). New e2e suites: movements export (+ filters), transfers
export, per-family isolation, empty-result, special-character escaping, OpenAPI parity, log privacy.

**Target Platform**: `apps/api` (Ubuntu CI + container runtime). No `apps/mobile` change this slice.

**Project Type**: Mobile + API monorepo; this feature touches the **API** only (CSV file responses —
no new `packages/contracts` response type, since the body is a file).

**Performance Goals**: pilot scale (3–5 families). Each export is a bounded set of family-scoped reads
plus in-memory formatting; name/email lookups are **set-based** (one query per lookup, not per row).

**Constraints**: Principle I isolation (family from session only); financial data appears **only** in
the caller's own file, **never** in logs (II); no async/queue/storage, no new dependency (V); TS
strict, OpenAPI-documented (VI). CSV = UTF-8 BOM, comma, RFC-4180; amounts integer CLP; dates
`YYYY-MM-DD`.

**Scale/Scope**: one new NestJS module (`export`), two endpoints, a CSV writer util, three small
read-only repository additions. No product-data changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Assessment | Status |
|---|-----------|------------|--------|
| I | Family Data Isolation (NON-NEGOTIABLE) | Movements/transfers are read family-scoped from the session; account/category **names** and author **emails** are resolved only from ids that appear in *this* family's data. A foreign id can never widen the export. Cross-family isolation e2e is mandatory and included. | PASS |
| II | Financial Privacy by Design | Amounts and notes appear **only** in the caller's own authenticated CSV response — the point of portability — and are **never** written to logs/telemetry; the export logs only a row count. No third-party storage. | PASS |
| III | Derived Balance Integrity | Read-only export; touches no balance or movement. Soft-deleted rows are excluded (consistent with history/balances). | PASS |
| IV | Test-First & Definition of Done | e2e + a CSV-writer unit spec ship with the code; the new `*.repository.ts` methods fall in QLT-01's ≥90% high-risk coverage scope. Backend-first → no mobile-UX change, so the physical-device DoD gate does not apply this slice (recorded in Assumptions). | PASS |
| V | Modular Monolith Simplicity (YAGNI) | One new module; **no new collection, no new dependency** (hand-rolled RFC-4180 writer), no async/queue/storage. One-way deps → **no `forwardRef`**. | PASS |
| VI | Shared, Documented Contracts | OpenAPI documents both endpoints (filters, `text/csv`, column shape). No new `packages/contracts` type (the body is a file). TS strict, no `any`, named exports; SOLID controller→service. | PASS |
| VII | Fast & Accessible Capture UX | Not a capture flow; supports user trust/control over their data (portability). The download/share UX ships with the deferred mobile track. | PASS |

**Result (pre-Phase 0)**: No violations. Complexity Tracking is empty.

**Post-Design re-check (after Phase 1)**: Re-evaluated against `research.md`, `data-model.md`, and
`contracts/export.openapi.yaml`. All gates hold: family-scoped reads + id-bounded name/email
resolution (I); financial data only in the owner's file, never logged (II); read-only, soft-deleted
excluded (III); tests + coverage scope (IV); one module, no collection/dependency/queue, no
`forwardRef` (V); OpenAPI-documented (VI). No new violations.

## Project Structure

### Documentation (this feature)

```text
specs/015-csv-export/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (CSV row shapes; read-only sources)
├── quickstart.md        # Phase 1 output (runnable validation guide)
├── contracts/
│   └── export.openapi.yaml   # The 2-endpoint REST contract (text/csv)
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root) — files EXP-01 adds / edits

```text
apps/api/src/export/                        # NEW module
├── csv-writer.ts                           # NEW: RFC-4180 writer (escape + BOM), pure & unit-tested
├── csv-writer.spec.ts                      # NEW: unit — escaping (comma/quote/newline), BOM, empty
├── export.service.ts                       # NEW: fetch + resolve name/email maps + build CSV
├── export.controller.ts                    # NEW: GET /v1/export/movements + /v1/export/transfers (text/csv)
├── export.module.ts                        # NEW: imports Movements/Transfers/FinancialAccounts/Categories/Accounts/Families
└── dto/
    └── export-movements.query.ts           # NEW: HIS-01 filters (from/to/type/account/category/search), no paging

apps/api/src/movements/movement.repository.ts    # EDITED: + findForExport(familyId, filters) (unpaginated, shares the history filter)
apps/api/src/transfers/transfers.module.ts       # EDITED: export TransferRepository (so ExportModule can read transfers)
apps/api/src/accounts/account.repository.ts       # EDITED: + findEmailsByIds(ids) (batch author-email resolution)
apps/api/src/app.module.ts                       # EDITED: register ExportModule

apps/api/test/
├── export-movements.e2e-spec.ts            # NEW: full + filtered export, headers, empty result
├── export-transfers.e2e-spec.ts            # NEW: transfers export, columns
├── export-isolation.e2e-spec.ts            # NEW: cross-family — no foreign rows (Principle I)
├── export-escaping.e2e-spec.ts             # NEW: note with comma/quote/newline + accents intact
├── export-openapi-parity.e2e-spec.ts       # NEW: served Swagger == committed contract (2 endpoints)
├── export-log-privacy.e2e-spec.ts          # NEW: no amount/note in logs
└── export-helpers.ts                       # NEW: suite helpers (seed movements/transfers, parse CSV)
```

**Structure Decision**: A single new `apps/api/src/export/` module (controller → service + a pure
`csv-writer` util). It **reads** existing data one-way through the already-exported repositories —
`MovementRepository` (TXN-01/HIS-01), `FinancialAccountRepository` (ACC-01), `CategoryRepository`
(CAT-01), `AccountRepository` (AUTH-01) — plus `TransferRepository`, which **TXN-02's module must now
export** (a one-line change; today it exports only its balance/summary services). No financial module
is modified beyond three additive read-only methods, and every import is one-way, so **no
`forwardRef`**. The two endpoints return `text/csv; charset=utf-8` with a `Content-Disposition`
attachment filename; the movements endpoint carries the HIS-01 filter set (no paging — an export is
the whole matching set), the transfers endpoint takes none. The service resolves ids to readable
values with **set-based** lookups: all family accounts (`findByFamily 'all'`) → name map, all visible
categories (`listVisible 'all'`) → name map, and the distinct author ids → email map
(`AccountRepository.findEmailsByIds`). Archived accounts/categories still resolve to their name so
historical rows stay readable. The CSV writer applies RFC-4180 quoting and a UTF-8 BOM; movement
`type` and headers are rendered in Spanish.

## Complexity Tracking

> No constitutional violations. No entries required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
