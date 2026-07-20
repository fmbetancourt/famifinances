# Research: Movement History with Filters (HIS-01)

**Feature**: HIS-01 · Movement history with filters
**Date**: 2026-07-20

The stack + patterns are inherited from TXN-01/ACC-01/CAT-01. No open `NEEDS CLARIFICATION` remain — the three
decisions were closed in `/speckit-clarify` (Session 2026-07-20): movements-only scope; offset/limit pagination
(default 20 / max 100); case-insensitive substring note search.

## R1 · A new endpoint, not an overload of `GET /movements`

- **Decision**: Add a dedicated **`history` module** exposing `GET /history`, rather than extending TXN-01's
  `GET /movements`. `HistoryModule` imports `FamiliesModule` (guard) and `MovementsModule` (which now exports
  `MovementRepository`); `HistoryService` maps rows to `MovementSummary` + paging metadata.
- **Rationale**: `GET /movements` returns a bare `MovementSummary[]`; changing it to a paginated envelope would
  break TXN-01's contract and its mobile consumer. A separate endpoint is non-breaking and keeps a clean,
  self-describing history contract. A distinct top-level path (`/history`) also avoids the `GET /movements/:id`
  route-param collision a `/movements/history` sub-path would risk.
- **Alternatives considered**: overloading `GET /movements` with paging (rejected — breaking change);
  `GET /movements/history` on the movements controller (rejected — param-collision risk + mixes feature
  ownership into TXN-01).

## R2 · The filtered, paginated query

- **Decision**: `MovementRepository.searchHistory(familyId, filters, { limit, offset })` builds one
  `FilterQuery` — `{ familyId, deletedAt: null }` plus the provided `date` range (`$gte` from, `$lte` to),
  `type`, `accountId`, `categoryId`, and note `$regex` — then runs `find(...).sort({ date:-1, createdAt:-1 })
  .skip(offset).limit(limit)` and a parallel `countDocuments(sameFilter)`, returning `{ items, total }`. The
  existing `{ familyId:1, deletedAt:1, date:-1 }` index backs the base filter + sort.
- **Rationale**: A single indexed find + count is ample at pilot scale (SC-001). Combining all filters in one
  query gives the AND semantics (FR-007). Dates are stored at UTC midnight, so an inclusive `$lte toMidnight`
  includes the whole `to` day.
- **Alternatives considered**: an aggregation pipeline (unneeded — a plain find suffices); computing `hasMore`
  by over-fetching one row (rejected — a `countDocuments` also gives the exact `total` the contract returns).

## R3 · Note search — escaped case-insensitive substring

- **Decision**: The note search matches with `{ note: { $regex: escapeRegex(term), $options: 'i' } }`, where a
  new `common/escape-regex.ts` escapes all regex metacharacters in the user term. Movements with `note: null`
  never match (a regex does not match null). The term is trimmed and length-capped in the DTO.
- **Rationale**: Substring case-insensitive is the clarified behavior (intuitive "find a transaction"). Escaping
  is **required** so a term like `.*` or `(a+)+` cannot inject a pattern or cause ReDoS (Principle II). No text
  index is needed for substring search at pilot scale.
- **Alternatives considered**: a MongoDB `$text` index (rejected — word/stemming semantics, not substring; more
  infra); prefix-only match (rejected in clarify — less useful); passing the term unescaped (rejected — regex
  injection / ReDoS risk).

## R4 · Pagination — offset/limit

- **Decision**: `limit` (default 20, **max 100**) + `offset` (default 0). The response is
  `{ items, total, limit, offset, hasMore }` where `hasMore = offset + items.length < total`. `limit`/`offset`
  are coerced to integers and validated (`limit` 1..100, `offset` ≥ 0).
- **Rationale**: Offset/limit is simple, lets the client jump pages, and is sufficient at pilot scale (clarify
  Q2). `total` powers a page count; `hasMore` is a convenience flag (FR-010, SC-006).
- **Alternatives considered**: keyset/cursor pagination (rejected in clarify — more robust at scale but complex
  and no page-jumping; unnecessary for the pilot).

## R5 · Validation & date semantics

- **Decision**: `HistoryQuery`: `from?`/`to?` via the shared `@IsCalendarDate` (`YYYY-MM-DD`), `type?`
  `@IsIn(MOVEMENT_TYPES)`, `account?`/`category?` strings, `search?` trimmed string (max 100), `limit?`/`offset?`
  `@Type(() => Number) @IsInt` with `@Min/@Max`. Unknown query fields are rejected (whitelist). An
  invalid-ObjectId `account`/`category` yields an empty result (no matches), not a 500. A `from > to` range
  simply matches nothing.
- **Rationale**: Reuses TXN-01's `@IsCalendarDate` and movement type enum; server-side validation (FR-011);
  malformed ids degrade to empty rather than error, matching the repository's family-scoped guards elsewhere.
- **Alternatives considered**: rejecting an inverted range with 400 (acceptable, but an empty result is simpler
  and harmless).

## R6 · Endpoint & response

- **Decision**: `GET /history?from=&to=&type=&account=&category=&search=&limit=&offset=` — any family member
  (`JwtAuthGuard` + `FamilyScopeGuard`), family from the session. Response `MovementHistoryPage { items:
  MovementSummary[], total, limit, offset, hasMore }`. Items reuse the TXN-01 `MovementSummary` shape.
- **Rationale**: Mirrors the session-implicit scoping of the other modules; reusing `MovementSummary` keeps one
  movement shape across the API (Principle VI).
- **Alternatives considered**: a bespoke history-item shape (rejected — `MovementSummary` already carries type,
  amount, date, account, category, note).

## Resolved Technical Context

| Item | Decision |
|------|----------|
| Endpoint | New `GET /history` (non-breaking; `/movements` untouched) — R1 |
| Query | `MovementRepository.searchHistory` find+sort+skip+limit + count; AND filters — R2 |
| Note search | Escaped case-insensitive `$regex` substring; null note excluded — R3 |
| Pagination | offset/limit (default 20, max 100); `{ total, hasMore }` — R4 |
| Validation | `@IsCalendarDate`, type enum, int limit/offset, whitelist; bad id → empty — R5 |
| Response | `MovementHistoryPage` reusing `MovementSummary` — R6 |
