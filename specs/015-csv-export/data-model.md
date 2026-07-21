# Data Model: CSV Export (EXP-01)

**Feature**: EXP-01 · Exportación CSV
**Date**: 2026-07-21

EXP-01 adds **no persisted collection**. It reads existing family-scoped data and produces two CSV
representations. This document defines the CSV row shapes and the read sources.

## Read sources (unchanged)

| Source | Used for | Access |
|--------|----------|--------|
| Movements (TXN-01) | rows of the movements CSV | `MovementRepository.findForExport(familyId, filters)` — **new**, unpaginated, non-deleted, HIS-01 filters |
| Transfers (TXN-02) | rows of the transfers CSV | `TransferRepository.listByFamily(familyId, {})` — existing, non-deleted |
| Financial accounts (ACC-01) | account **name** (origin/destination) | `FinancialAccountRepository.findByFamily(familyId, 'all')` — existing |
| Categories (CAT-01) | category **name** | `CategoryRepository.listVisible(familyId, 'all')` — existing |
| Accounts (AUTH-01) | author **email** | `AccountRepository.findEmailsByIds(ids)` — **new**, batch |

## Artifact: Movements CSV *(generated, not persisted)*

- **Header** (Spanish): `Fecha,Tipo,Monto,Cuenta,Categoría,Nota,Autor,Creado`
- **One row per non-deleted movement** matching the filters:

| Column | Source | Format |
|--------|--------|--------|
| Fecha | movement `date` | `YYYY-MM-DD` |
| Tipo | movement `type` | `Ingreso` / `Gasto` (Spanish label) |
| Monto | movement `amount` | integer CLP (no decimals/thousands sep) |
| Cuenta | account name (by `accountId`) | text (RFC-4180 quoted if needed) |
| Categoría | category name (by `categoryId`) | text, or **empty** when uncategorized |
| Nota | movement `note` | text, or empty; escaped |
| Autor | member email (by `createdBy`) | text |
| Creado | movement `createdAt` | `YYYY-MM-DD` |

## Artifact: Transfers CSV *(generated, not persisted)*

- **Header**: `Fecha,Cuenta origen,Cuenta destino,Monto,Autor,Creado`
- **One row per non-deleted transfer**:

| Column | Source | Format |
|--------|--------|--------|
| Fecha | transfer `date` | `YYYY-MM-DD` |
| Cuenta origen | account name (by `fromAccountId`) | text |
| Cuenta destino | account name (by `toAccountId`) | text |
| Monto | transfer `amount` | integer CLP |
| Autor | member email (by `createdBy`) | text |
| Creado | transfer `createdAt` | `YYYY-MM-DD` |

## CSV format rules (authoritative — enforced in `csv-writer.ts`)

- **Encoding**: UTF-8 with a leading **BOM** (`﻿`) so spreadsheets read accents/ñ correctly.
- **Delimiter**: comma. **Line ending**: CRLF (RFC-4180).
- **Quoting** (RFC-4180): a field is wrapped in double quotes iff it contains a comma, a double quote,
  CR, or LF; inner double quotes are doubled (`"` → `""`).
- **Amounts**: plain integer CLP (the schema stores whole pesos). **Dates**: `YYYY-MM-DD`.
- **Empty result**: a valid file with **only the header row** (never an error).

## Filters (movements export — reuse HIS-01)

`from`, `to` (calendar dates), `type` (`income`|`expense`), `account`, `category` (ids), `search`
(note substring, blank ignored). All optional, combined with AND; malformed `account`/`category` id →
empty data (header only). No paging.

## Validation & isolation rules

- Every source read binds `familyId` from the session (Principle I); account/category **names** and
  author **emails** are resolved only from ids present in *this* family's rows — a foreign id cannot
  appear or widen the export.
- Soft-deleted movements/transfers are excluded (FR-005/FR-007).
- No amount, note, or email is written to logs — only a row count (FR-008).

## Notes

- No new collection; no data mutation. The three repository additions are read-only.
- Author is resolved to email (clarify decision); an id with no matching account (should not occur)
  falls back to an empty `Autor` cell.
