# Data Model: Movement History with Filters (HIS-01)

**Feature**: HIS-01 · Movement history with filters
**Date**: 2026-07-20

HIS-01 adds **no persisted collection**. It is a **read-only query** over the existing `movements` collection
(TXN-01), scoped to the session family (Principle I). This document defines the query inputs, the computed page
shape, and the reused entities.

## Query inputs: MovementHistoryQuery

| Field | Type | Rule |
|-------|------|------|
| `from` | string `YYYY-MM-DD` (opt) | Inclusive lower bound on the movement occurrence date. |
| `to` | string `YYYY-MM-DD` (opt) | Inclusive upper bound on the occurrence date (dates stored at UTC midnight). |
| `type` | `income \| expense` (opt) | Movement type filter. |
| `account` | string (opt) | Account id filter; a non-ObjectId or foreign id → no matches. |
| `category` | string (opt) | Category id filter; a non-ObjectId or foreign id → no matches. |
| `search` | string (opt) | Case-insensitive **substring** over the note; trimmed, max length 100; escaped for regex. |
| `limit` | int (opt) | Page size; default **20**, min 1, **max 100**. |
| `offset` | int (opt) | Rows to skip; default **0**, min 0. |

All provided filters combine with **AND** (FR-007). Deleted movements are always excluded.

## Computed: MovementHistoryPage *(not stored)*

`HistoryService.search(familyId, query)` returns:

| Field | Type | Meaning |
|-------|------|---------|
| `items` | `MovementSummary[]` | The page's movements, newest first (occurrence date desc, then creation desc). |
| `total` | int | Total movements matching the filters (ignoring paging). |
| `limit` | int | The effective page size applied. |
| `offset` | int | The effective offset applied. |
| `hasMore` | boolean | `offset + items.length < total`. |

`MovementSummary` (from TXN-01, reused): `{ movementId, type, amount, date, accountId, categoryId, note }`.

## Query implementation *(read-only)*

`MovementRepository.searchHistory(familyId, filters, { limit, offset })` → `{ items, total }`:

- **Filter**: `{ familyId, deletedAt: null }` plus, when provided: `date` `{ $gte: from, $lte: to }` (UTC-midnight
  bounds); `type`; `accountId` (valid ObjectId, else the query short-circuits to empty); `categoryId` (same);
  `note` `{ $regex: escapeRegex(search), $options: 'i' }` **only when `search` is non-empty after trim** (a
  blank search omits the clause, so note-less movements are not excluded).
- **Order**: `sort({ date: -1, createdAt: -1 })` (FR-009), served by the existing
  `{ familyId:1, deletedAt:1, date:-1 }` index.
- **Page**: `.skip(offset).limit(limit)`; `total` from `countDocuments(sameFilter)` (run concurrently).

## Validation rules

- `from`/`to`: `@IsCalendarDate` (`YYYY-MM-DD`); either optional. An inverted range matches nothing.
- `type`: one of `income`/`expense`.
- `account`/`category`: strings; a malformed/foreign id degrades to **no matches** (never a cross-family read or
  a 500), consistent with the family-scoped repositories.
- `search`: trimmed, ≤ 100 chars, **regex-escaped** before use (Principle II — no injection / ReDoS). A
  **blank/whitespace-only** `search` (empty after trim) is treated as **no note filter** — the note clause is
  omitted, so note-less movements are not spuriously excluded.
- `limit`: integer 1–100 (default 20); `offset`: integer ≥ 0 (default 0). Unknown query fields → 400 (whitelist).
- `familyId`: always the session family (Principle I); a caller with no family → 404 (FamilyScopeGuard).

## Relationships

- **Movement History → Movement** *(read-only)*: filters/pages the family's movements; never modifies them.
- **→ Account / Category** *(filter dimensions)*: opaque family-scoped ids; only narrow the result within the
  family.
- **→ Family / Membership**: the privacy boundary; all access authorized against the session family.

## Notes

- **No new persistence** — a pure query; a later movement create/edit/delete changes results immediately.
- **Movements only** (clarify Q1): transfers are excluded from this history.
- **One-way dependency**: history reads movements; nothing reads history — no `forwardRef`.
