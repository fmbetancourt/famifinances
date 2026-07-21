# Research: CSV Export (EXP-01)

**Feature**: EXP-01 · Exportación CSV
**Date**: 2026-07-21

All open decisions were closed in `/speckit-specify` + `/speckit-clarify` (Session 2026-07-21):
backend-only scope; transfers included; UTF-8+BOM, comma, RFC-4180; two endpoints per resource;
Spanish headers; author = member email. This document records the resulting technical decisions.

## R1 · On-demand synchronous CSV, no dependency, no storage

- **Decision**: Both exports are generated **synchronously in memory** and returned as the HTTP
  response body with `Content-Type: text/csv; charset=utf-8` and a `Content-Disposition: attachment;
  filename="…csv"`. A small **hand-rolled RFC-4180 writer** (`csv-writer.ts`) produces the file: a
  UTF-8 **BOM** prefix, comma delimiter, and quoting of any field containing comma/quote/CR/LF (inner
  quotes doubled). **No CSV library, no async job, no queue, no stored artifact, no third-party
  storage.**
- **Rationale**: At pilot scale an export is a bounded family-scoped read; synchronous is simplest and
  needs no infrastructure (Principle V). The BOM makes spreadsheets (Excel/Sheets) read UTF-8 (tildes,
  ñ) correctly; RFC-4180 quoting keeps notes with commas/newlines in one cell. Hand-rolling ~20 lines
  avoids a dependency for a trivial format.
- **Alternatives considered**: a CSV library (rejected — unnecessary dependency for RFC-4180); an
  async export job emailed or stored (rejected — new infra + storage, and the No-objetivos forbid
  depositing data in third parties); streaming row-by-row (rejected — not needed at pilot volume; a
  single string response is simpler and still bounded).

## R2 · Two endpoints; movements reuse the HIS-01 filters (unpaginated)

- **Decision**: `GET /v1/export/movements` and `GET /v1/export/transfers`. Movements accepts the
  **HIS-01 filter set** (`from`, `to`, `type`, `account`, `category`, `search`) — **without** paging,
  since an export is the entire matching set. A new `MovementRepository.findForExport(familyId,
  filters)` returns all matching non-deleted movements (newest first), **sharing the same filter
  builder** as `searchHistory` (extracted to a private helper so the two never diverge). Transfers
  takes no filters and uses `TransferRepository.listByFamily(familyId, {})` (already excludes
  soft-deleted). Both endpoints: reads → `JwtAuthGuard` + `FamilyScopeGuard`; **any member**, no email
  or role gate (a read of shared data, like history — FR-011).
- **Rationale**: Two resource endpoints keep each contract honest — transfers have no
  category/type/note filters, so a single `?type=` endpoint would advertise inapplicable params
  (clarify Q1). Reusing HIS-01's filter builder gives identical, already-tested semantics and zero
  drift. No paging because the file must be complete.
- **Alternatives considered**: one `/export?type=` endpoint (rejected — mixed/misleading filters); a
  huge `limit` on `searchHistory` (rejected — paging metadata is meaningless for a file; a dedicated
  unpaginated method is clearer and avoids arbitrary caps).

## R3 · Set-based id → readable value resolution (names + author email)

- **Decision**: The service resolves ids to readable values with **bounded, set-based** lookups, not
  per row: all family accounts via `FinancialAccountRepository.findByFamily(familyId, 'all')` → a
  `id → name` map; all visible categories via `CategoryRepository.listVisible(familyId, 'all')` → a
  `id → name` map; the **distinct author ids** across the rows via a new
  `AccountRepository.findEmailsByIds(ids)` → a `id → email` map. **Archived** accounts/categories are
  included (status `'all'`) so historical rows keep their name. A movement with no category yields an
  empty `Categoría` cell.
- **Rationale**: Family-scale maps are tiny and turn N per-row lookups into a few queries. Author
  emails are resolved **only** from ids that appear in this family's own movements/transfers, so no
  cross-family disclosure — the emails belong to this family's members and are exported to a family
  member (intrafamily). Showing archived names keeps the export faithful to history.
- **Alternatives considered**: per-row `findById` (rejected — N+1); joining via aggregation `$lookup`
  (rejected — more complex than two small maps at this scale); resolving author to an opaque id or a
  display name (rejected in clarify — email is human-readable and always present in AUTH-01).

## R4 · Privacy, isolation & contracts

- **Decision**: The export response carries amounts/notes/emails (the owner's own data) but the
  service logs **only a row count** (`export.movements rows=… family=…`), never amounts/notes/emails.
  Every source read binds `familyId` from the session; a cross-family export e2e proves zero foreign
  rows. The two endpoints are documented in `contracts/export.openapi.yaml` (`text/csv`, filters,
  attachment) with an OpenAPI-parity e2e; **no new `packages/contracts` type** is added because the
  response is a file, not JSON.
- **Rationale**: Principle II targets logs/telemetry/third-parties — an authenticated file response to
  the data owner is exactly the portability goal and is not a leak; keeping the log line count-only
  preserves the guarantee. Principle VI is met by the OpenAPI contract; a shared TS response type does
  not apply to a CSV body.
- **Alternatives considered**: logging the filename/filters with values (rejected — could echo ids;
  count-only is safest); a JSON+CSV dual response (rejected — out of scope, one format).

## Resolved Technical Context

| Item | Decision |
|------|----------|
| Delivery | Synchronous in-memory CSV response; BOM + comma + RFC-4180; no dep/queue/storage — R1 |
| Endpoints | Two: `/export/movements` (HIS-01 filters, unpaginated) + `/export/transfers`; any member — R2 |
| Resolution | Set-based id→name (accounts, categories, incl. archived) + id→email (authors) maps — R3 |
| Privacy/contracts | Count-only logs; family-scoped reads; OpenAPI (text/csv), no new shared type — R4 |
