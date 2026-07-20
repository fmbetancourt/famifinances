# Quickstart: Movement History with Filters (HIS-01)

**Feature**: HIS-01 · Movement history with filters
**Date**: 2026-07-20

Validates the filterable, paginated movement history end to end: date-range/type/account/category filters
combine with AND, the note search is a case-insensitive substring, results are newest-first and exclude deleted
movements, pages honor `limit`/`offset` with `total`/`hasMore`, and no other family's movements ever appear.
Contracts: [contracts/history.openapi.yaml](./contracts/history.openapi.yaml); query + page shapes:
[data-model.md](./data-model.md); decisions: [research.md](./research.md).

## Prerequisites

- Repo bootstrapped (`pnpm install`) with the TXN-01 / ACC-01 / CAT-01 modules present.
- API runnable via the same harness as prior features; e2e uses `mongodb-memory-server` (serial, `maxWorkers 1`).
- A verified member with a family + an account + a couple of categories, and a user in a **different** family
  (isolation). Reuse the e2e helpers (`setupMemberWithAccount`, `createCategory`, `recordMovement`).

## Run

```bash
# API unit + e2e (from repo root)
pnpm --filter @famifinances/api test
pnpm --filter @famifinances/api test:e2e

# Contract types
pnpm --filter @famifinances/contracts build
```

## Scenario 1 — Date range + type, newest-first, deleted excluded (US1, P1)

1. Record expenses on 2026-06-30, 2026-07-05, 2026-07-20 and an income on 2026-07-10; delete the 2026-07-05 one.
2. `GET /history?from=2026-07-01&to=2026-07-31&type=expense`.
3. **Expect 200** with only the non-deleted July **expense** (2026-07-20) — June is out of range, the income is
   filtered out, the deleted one is excluded. Multiple matches come back newest-first.

**Pass**: date range + type filter correctly; deleted excluded; order newest-first.

## Scenario 2 — Account + category, AND semantics (US2, P1)

1. Two accounts, two expense categories; record movements spanning both.
2. `GET /history?account=<A>&category=<Alimentación>&type=expense` → only movements matching **all** of account
   A, category Alimentación, and type expense.
3. `GET /history?account=<foreign-or-bad-id>` → **empty** `items` (never another family's rows).

**Pass**: filters combine with AND; foreign/malformed ids yield no matches.

## Scenario 3 — Note substring search (US3, P2)

1. Record movements with notes "Farmacia Ahumada", "farmacia cruz verde", "Supermercado".
2. `GET /history?search=farmacia` → the two "farmacia…" movements (case-insensitive), not the supermarket one;
   a movement with no note never matches.
3. `GET /history?search=.*` → treated as the literal text ".*" (regex-escaped) → no injection, no ReDoS.

**Pass**: case-insensitive substring; no-note excluded; metacharacters escaped.

## Scenario 4 — Pagination: limit, offset, total, hasMore (US4, P2)

1. Record 25 movements in the month.
2. `GET /history?limit=10&offset=0` → 10 items, `total 25`, `hasMore true`.
3. `GET /history?limit=10&offset=20` → 5 items, `hasMore false`, continuing with no overlap/gap vs the prior
   pages.
4. `GET /history?limit=500` → **400** (or capped at 100) by validation; `GET /history?limit=0` → **400**.

**Pass**: pages bounded by `limit` (default 20, max 100); `total`/`hasMore` accurate; validation enforced.

## Scenario 5 — Cross-family isolation (US1–US3, P1)

1. Family A records movements for July.
2. As a member of family **B**, `GET /history?from=2026-07-01&to=2026-07-31` → **200** with B's own (empty)
   page; none of family A's movements appear; filtering by A's account/category id → still empty.
3. A caller with **no family** → **404**.

**Pass**: every result is scoped to the session family; a foreign family never leaks in.

## Done When

- [ ] Scenarios 1–5 pass against the running API.
- [ ] Filters combine with AND; deleted excluded; newest-first — SC-002/SC-003.
- [ ] Note search is case-insensitive substring; escaped — SC-004.
- [ ] Pages honor limit/offset with accurate total/hasMore — SC-006.
- [ ] Cross-family isolation holds — SC-005.
- [ ] No monetary amount or note content appears in logs — FR-013/SC-007.
