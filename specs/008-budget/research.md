# Research: Monthly & Per-Category Budget (BUD-01)

**Feature**: BUD-01 · Monthly and per-category budget
**Date**: 2026-07-19

The stack + patterns are inherited from AUTH-01/FAM-01/CAT-01/TXN-01. No open `NEEDS CLARIFICATION` remain —
the two ambiguities were closed in `/speckit-clarify` (Session 2026-07-19): budget management is owner-only
(viewing any member); the monthly total is the sum of per-category allocations.

## R1 · Real spend is derived from movements (one-way, no forwardRef)

- **Decision**: A category's **real spend** for a month is computed on demand as the sum of the family's
  **expense** movements with that `categoryId` whose occurrence `date` falls in the month, excluding deleted.
  `MovementsModule` gains a `MovementSpendService.expenseByCategory(familyId, period)` returning a
  `Record<categoryId, spend>`, backed by a `MovementRepository.sumExpenseByCategory(familyId, from, to)`
  aggregation (`$match { familyId, type:'expense', deletedAt:null, categoryId:{ $ne:null }, date:{ $gte:from, $lt:to } }` → `$group by categoryId` summing `amount`). `BudgetsModule` **imports** `MovementsModule`
  (one-way: budgets read movements; movements never read budgets), so **no `forwardRef`** is required.
- **Rationale**: Keeps spend **derived** (Principle III) — nothing is stored twice. The dependency is
  strictly one-directional (unlike accounts⇄movements), so the module graph stays simple. Uncategorized
  expense movements (`categoryId: null`) legitimately contribute to no budget line.
- **Alternatives considered**: storing a running "spent" total per allocation updated on each movement
  (rejected — editable derived data, drift, violates III); computing spend client-side (rejected — the family
  must trust one server-computed figure).

## R2 · Owner-only writes (reuse FAM-01 FamilyRoleGuard)

- **Decision**: The report route (`GET /budgets`) uses `JwtAuthGuard` + `FamilyScopeGuard` (any member). The
  write routes (`POST`/`DELETE`) use `JwtAuthGuard` + `FamilyScopeGuard` + `FamilyRoleGuard` + `@Roles('owner')`
  + `EmailVerifiedGuard` — so a non-owner → **403**, an unverified owner → **403**, no-family → **404**.
  `FamiliesModule` **exports** `FamilyRoleGuard` (previously only used internally for FAM-01 invites); BUD-01
  is its first external consumer.
- **Rationale**: Clarify Q1 chose owner-only management (US-05 "Como owner"); FAM-01 already built exactly this
  guard. Guard order keeps the ACC-01 convention (FamilyScope before the email gate; FamilyRole after
  FamilyScope since it reads `request.family.role`).
- **Alternatives considered**: any-member writes (rejected in Clarify Q1); a bespoke owner check in the service
  (rejected — duplicates the existing guard).

## R3 · Allocation entity & upsert

- **Decision**: `BudgetAllocation { familyId, period('YYYY-MM'), categoryId, plannedAmount(int>0), createdBy, timestamps }` with a **unique** index on `{ familyId, period, categoryId }`. Setting a budget is an **upsert**
  keyed by that triple (create or update the planned amount). Removing deletes the allocation row (a hard
  delete is fine here — a budget allocation is planning config, not a money record, and there is no audit
  obligation for it; consistent with CAT-01/ACC-01 not keeping a change log for descriptors).
- **Rationale**: One allocation per (family, month, category) (FR-005) maps to a unique index + upsert. Unlike
  movements/transfers, budgets carry no money-audit requirement (Principle III's audit clause is for
  movements), so a hard delete keeps it simple.
- **Alternatives considered**: soft delete (unnecessary — no audit requirement); a single `Budget` document
  per month embedding a category array (harder to upsert one line concurrently; the unique-index-per-line
  model is simpler and safe under concurrent edits).

## R4 · Period, report computation & status

- **Decision**: A `period` is a calendar month string `YYYY-MM`, validated by a regex + real-month check.
  `GET /budgets?period=` defaults to the current month when omitted. The report:
  1. loads the family's allocations for the period;
  2. gets `expenseByCategory(familyId, period)` from movements;
  3. per allocation builds a line `{ categoryId, categoryName, plannedAmount, realSpend, available = planned − real, percentConsumed = round(real/planned*100), status }`;
  4. `status`: **over** if `real > planned`; else **near** if `percentConsumed ≥ 80`; else **under**;
  5. an overall summary sums `plannedAmount` and `realSpend` across lines (`available`, `percentConsumed`
     derived from the sums; percent 0 when total planned is 0 / no lines).
  Category names are resolved from CAT-01 for a self-contained, display-ready report.
- **Rationale**: The report is presentation-oriented (a family reads it), so including `categoryName` and a
  computed `status` keeps it directly usable and matches SC-002/SC-004/SC-007. `plannedAmount > 0` (FR-002)
  means per-line percent never divides by zero.
- **Alternatives considered**: returning ids only (client must join — acceptable for capture endpoints, but a
  report should be self-contained); a configurable near-limit threshold (deferred — 80% is a fixed default in
  a shared `BUDGET_NEAR_THRESHOLD` constant, changeable without a contract change).

## R5 · Validation

- **Decision**: `SetBudgetDto`: `period` `@Matches(/^\d{4}-(0[1-9]|1[0-2])$/)`, `categoryId` string,
  `plannedAmount` `@IsInt @IsPositive`. The service validates the category via
  `CategoryRepository.findVisible(familyId, categoryId)` — it must exist, be **active** (custom not archived),
  and have `kind === 'expense'`; otherwise **400** ("category is not budgetable"). Whitelist rejects unknown
  fields.
- **Rationale**: Enforces expense-only (Principle III) + isolation at the write boundary, reusing CAT-01's
  family-scoped lookup. A month regex avoids ambiguous dates.
- **Alternatives considered**: accepting a full date and truncating to month (ambiguous; a `YYYY-MM` string is
  explicit).

## R6 · Endpoints

- **Decision**: `/budgets` collection, family from the session:
  `GET /budgets?period=` (report — any member), `POST /budgets` (set/upsert an allocation — owner),
  `DELETE /budgets/{budgetId}` (remove — owner → 204). The report returns ids the client can DELETE.
- **Rationale**: Mirrors the session-implicit scoping of the other modules; POST-upsert avoids a compound-key
  path; DELETE by the allocation id (surfaced in the report) is simple.
- **Alternatives considered**: `PUT /budgets/{period}/{categoryId}` (compound-key path — more RESTful but
  clunkier for the client, which already holds the report's ids).

## Resolved Technical Context

| Item | Decision |
|------|----------|
| Real spend | Derived via `MovementSpendService.expenseByCategory`; budgets → movements one-way (no forwardRef) — R1 |
| Roles | Owner-only writes (`FamilyRoleGuard` + `@Roles('owner')`, exported by FAM-01); report any member — R2 |
| Entity | `BudgetAllocation`, unique `{familyId,period,categoryId}`, upsert; hard delete (no money audit) — R3 |
| Report/status | planned/real/available/percent + under/near/over (near ≥ 80%); overall = sum of lines — R4 |
| Validation | month regex; positive int; category visible + active + kind `expense` else 400 — R5 |
| Endpoints | `/budgets` GET report + POST upsert + DELETE by id; period defaults to current month — R6 |
