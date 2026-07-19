# Implementation Plan: Transfers Between Accounts (TXN-02)

**Branch**: `007-transfers` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-transfers/`

## Summary

TXN-02 adds the **Transfer** — a move of money between two of the family's accounts. A transfer decreases the
origin account's derived balance and increases the destination's by the same amount, and **never changes the
family's income or expense totals** (no double counting, constitution III) — it is a distinct record type
(no category, no income/expense classification) stored in its own collection. TXN-02 extends the ACC-01/TXN-01
derived balance so each account's balance sums its movements **and** its transfers (−out, +in). Transfers are
recorded, edited, deleted (soft), and listed, each change appending an append-only `TransferEvent` audit that
survives deletion. Access is authorized through FAM-01's session-derived `FamilyScopeGuard`; both accounts
must be the family's active accounts and must differ. It reuses every TXN-01 pattern (soft delete, audit,
guard order, shared `@IsCalendarDate`).

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`); Node.js 20 LTS; NestJS; Expo/React Native mobile.

**Primary Dependencies**: existing stack — NestJS, Mongoose (MongoDB), `class-validator`/`class-transformer`,
`@nestjs/throttler`, `@nestjs/swagger`. Reuses AUTH-01 (`JwtAuthGuard`, `EmailVerifiedGuard`), **FAM-01**
(`FamilyScopeGuard`, `@CurrentFamily`), **ACC-01** (`FinancialAccountRepository` for account validation; its
`deriveBalance` composition is extended), and the **TXN-01** movement/audit/soft-delete patterns + the shared
`@IsCalendarDate` validator. No `FamilyRoleGuard`: any verified member records/edits/deletes.

**Storage**: MongoDB via Mongoose. New collections: `transfers`, `transferEvents`.

**Testing**: Jest + Supertest (unit + e2e, `mongodb-memory-server`). Mandatory: transfer balance effect
(origin −, destination +), no-double-counting (income/expense totals unchanged), same-account rejection,
cross-family isolation, audit trail surviving deletion, soft-delete excluded from balance/list, positive
amount + validation, no amounts/notes in logs.

**Target Platform**: iOS/Android (Expo); Node API in a container.

**Project Type**: Mobile + API monorepo (`apps/api`, `apps/mobile`, `packages/contracts`).

**Performance Goals**: pilot scale (3–5 families, hundreds of transfers each). Record a transfer < 1 min
(SC-001); server processing p95 < 300 ms; balance composition is two grouped aggregations per account-list read.

**Constraints**: transfer scope + account ownership from the session, never from caller input (Principle I);
balance derived, never stored editable, and unchanged income/expense totals (Principle III); positive
whole-peso CLP amount; origin ≠ destination, both active + own; edits/deletes controlled + auditable; no
amount/note in logs.

**Scale/Scope**: invited pilot; strict isolation/integrity per the constitution.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Assessment | Status |
|---|-----------|------------|--------|
| I | Family Data Isolation (NON-NEGOTIABLE) | Transfers are scoped by the session `familyId`; both accounts are validated to be active accounts of the family; a foreign transfer/account is rejected (404/400). Cross-family authorization e2e tests are mandatory. | PASS |
| II | Financial Privacy by Design | Server-side validation on all inputs; no monetary amount or note in logs (FR-015); access always authorized by family; rate-limited via the global throttler. | PASS |
| III | Derived Balance Integrity | **Central**: a transfer decreases the origin and increases the destination by the same amount and **does not change income or expense totals** (no double counting) — it is a distinct record, not an income/expense. Balances stay derived (initial + movement-net + transfer-net); every transfer records author + occurrence + creation date; edits/deletes are auditable (append-only `TransferEvent`). | PASS (central) |
| IV | Test-First & Definition of Done | TDD; balance-effect + no-double-counting + same-account + isolation + audit + soft-delete tests authored with implementation; OpenAPI documented. | PASS |
| V | Modular Monolith Simplicity | One cohesive `transfers` module; reuses FAM-01/ACC-01 and the TXN-01 patterns. The accounts⇄transfers balance/validation coupling mirrors accounts⇄movements — resolved with a scoped `forwardRef` + a small `TransferBalanceService`. No new infrastructure. | PASS |
| VI | Shared, Documented Contracts | OpenAPI + `packages/contracts` DTO types; TS strict, no `any`; hexagonal repositories. | PASS |
| VII | Fast & Accessible Capture UX | Minimal mobile capture screen (amount, from, to, date, note) with one primary action; transfer list. | PASS |

**Result (pre-Phase 0)**: No violations. Complexity Tracking is empty (the accounts⇄transfers `forwardRef`
mirrors the accounts⇄movements one from TXN-01 — a standard NestJS pattern for a bidirectional domain).

**Post-Design re-check (after Phase 1)**: Re-evaluated against `research.md`, `data-model.md`, and
`contracts/transfers.openapi.yaml`. All gates hold: transfers + accounts scoped by session with mandatory
cross-family tests (I); derived balance summing movements + transfers, income/expense totals untouched, and an
append-only audit surviving deletion (III); one module reusing the existing guards, `forwardRef` for the
balance coupling (V); OpenAPI + shared contracts (VI). No new violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/007-transfers/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── transfers.openapi.yaml
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root) — files TXN-02 adds / edits

```text
apps/api/src/
├── transfers/
│   ├── transfer.schema.ts            # Transfer: amount(int>0), date, fromAccountId, toAccountId,
│   │                                 #   familyId(indexed), note?, deletedAt(null|Date), createdBy, timestamps
│   ├── transfer-event.schema.ts      # append-only audit: transferId, familyId, actorId, type, snapshot, createdAt
│   ├── transfer.repository.ts        # family-scoped CRUD + softDelete + netByAccount aggregation (to +, from −)
│   ├── transfer-event.repository.ts  # append, listByFamily/Transfer
│   ├── transfer-balance.service.ts   # netForAccount / netByFamily (EXPORTED to ACC-01)
│   ├── transfers.service.ts          # create/list/get/update/delete + validation (both accounts own+active, from≠to) + audit
│   ├── transfers.controller.ts       # REST v1 /transfers; JwtAuthGuard + FamilyScopeGuard; EmailVerifiedGuard on writes
│   ├── transfers.module.ts           # forFeature Transfer + TransferEvent; imports FamiliesModule, forwardRef(FinancialAccountsModule); exports TransferBalanceService
│   └── dto/
│       ├── create-transfer.dto.ts    # amount, date, fromAccountId, toAccountId, note?
│       ├── update-transfer.dto.ts     # all optional (partial edit)
│       └── list-transfers.query.ts   # account? (transfers touching that account)
└── financial-accounts/               # EDITED (balance composition)
    ├── financial-accounts.service.ts  #   balance = initial + movementNet + transferNet (inject TransferBalanceService)
    └── financial-accounts.module.ts   #   imports forwardRef(TransfersModule)

packages/contracts/src/transfer/       # CreateTransferRequest, UpdateTransferRequest, TransferSummary
apps/mobile/app/(transfers)/           # capture screen (amount/from/to/date/note) + transfer list (mobile)
```

Reuses `apps/api/src/families/` guards, the AUTH-01 guards, `apps/api/src/common/validators/is-calendar-date`
(from TXN-01), and `FinancialAccountRepository` (exported by `FinancialAccountsModule`) — unchanged.

**Structure Decision**: Keep the established monorepo layout. TXN-02 adds a `transfers` domain module and the
audit `TransferEvent`, structurally parallel to TXN-01's movements. The derived balance stays an Account
concern: `FinancialAccountsService` now sums **movement-net + transfer-net**, pulling per-account transfer
sums from a small `TransferBalanceService` the transfers module exports; transfers validate the referenced
accounts via `FinancialAccountRepository`. This mirrors the accounts⇄movements coupling and is resolved with a
second scoped `forwardRef` (research R1). `deriveBalance` stays the pure `initialBalance + net` function — the
callers sum the two contributions — so no TXN-01/ACC-01 unit changes are forced.

## Complexity Tracking

> No constitutional violations. The accounts⇄transfers `forwardRef` mirrors the accounts⇄movements one from
> TXN-01 — a standard NestJS pattern for a genuinely bidirectional domain, not a violation of Modular
> Monolith Simplicity.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
