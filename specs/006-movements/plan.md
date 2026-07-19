# Implementation Plan: Income & Expense Movements (TXN-01)

**Branch**: `006-movements` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-movements/`

## Summary

TXN-01 adds the **Movement** — the family's financial source of truth. A verified member records income and
expense movements (amount, date, account, optional category, note); the movement's account and category must
belong to the family, and a category's **kind must match** the movement type (constitution III). Each
account's **derived balance** now sums its movements (`initial + Σ income − Σ expense`, excluding deleted) —
TXN-01 extends ACC-01's `deriveBalance` via a `MovementBalanceService`. Movements are editable and deletable
(soft delete); every create/edit/delete appends an **append-only `MovementEvent`** audit record (author,
type, timestamp, snapshot) that survives deletion. Access is authorized through FAM-01's session-derived
`FamilyScopeGuard`; another family's movements/accounts/categories are rejected. Transfers are out of scope
(TXN-02).

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`); Node.js 20 LTS; NestJS; Expo/React Native mobile.

**Primary Dependencies**: existing stack — NestJS, Mongoose (MongoDB), `class-validator`/`class-transformer`,
`@nestjs/throttler`, `@nestjs/swagger`. Reuses AUTH-01 (`JwtAuthGuard`, `EmailVerifiedGuard`), **FAM-01**
(`FamilyScopeGuard`, `@CurrentFamily`), **ACC-01** (`FinancialAccountRepository` for account validation; its
`deriveBalance` is extended), and **CAT-01** (`CategoryRepository.findVisible` for category validation + kind).
No `FamilyRoleGuard`: any verified member records/edits/deletes (Clarify Q2).

**Storage**: MongoDB via Mongoose. New collections: `movements`, `movementEvents`.

**Testing**: Jest + Supertest (unit + e2e, `mongodb-memory-server`). Mandatory: derived-balance math
(initial + income − expense, excluding deleted), kind integrity (income category only on income), cross-family
isolation (account/category/movement scoped by session family), audit trail (created/edited/deleted survives
deletion), soft-delete excluded from balance/history, positive-amount + validation, no amounts/notes in logs.

**Target Platform**: iOS/Android (Expo); Node API in a container.

**Project Type**: Mobile + API monorepo (`apps/api`, `apps/mobile`, `packages/contracts`).

**Performance Goals**: pilot scale (3–5 families, hundreds of movements each). Record a movement < 1 min
(SC-001); server processing p95 < 300 ms; balance aggregation is one grouped query per account-list read.

**Constraints**: movement scope + account/category ownership from the session, never from caller input
(Principle I); balance derived, never stored editable (Principle III); positive whole-peso CLP amount; kind
integrity enforced; edits/deletes controlled + auditable; no amount/note in logs.

**Scale/Scope**: invited pilot; strict isolation/integrity per the constitution.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Assessment | Status |
|---|-----------|------------|--------|
| I | Family Data Isolation (NON-NEGOTIABLE) | Movements are scoped by the session `familyId`; the referenced account and category are validated to belong to the family; a foreign movement/account/category is rejected (404/400). Cross-family authorization e2e tests are mandatory. | PASS |
| II | Financial Privacy by Design | Server-side validation on all inputs; no monetary amount or note in logs (FR-016); access always authorized by family; rate-limited via the global throttler. | PASS |
| III | Derived Balance Integrity | **Central**: balance = initial + Σ income − Σ expense (derived, no stored editable balance); a transfer would not change income/expense totals (TXN-02); an income category is never applied to an expense (kind integrity); every movement records author + occurrence date + creation date; edits and deletions are controlled and auditable (append-only `MovementEvent`). | PASS (central) |
| IV | Test-First & Definition of Done | TDD; balance-math + kind-integrity + isolation + audit + soft-delete tests authored with implementation; OpenAPI documented. | PASS |
| V | Modular Monolith Simplicity | One cohesive `movements` module; reuses FAM-01/ACC-01/CAT-01. The accounts⇄movements balance/validation coupling is a genuine bidirectional domain relationship, resolved with a scoped `forwardRef` + a small `MovementBalanceService` (no new infrastructure). | PASS |
| VI | Shared, Documented Contracts | OpenAPI + `packages/contracts` DTO types; TS strict, no `any`; hexagonal repositories. | PASS |
| VII | Fast & Accessible Capture UX | Minimal mobile capture screen (amount, type, account, optional category, note) with one primary action; history list; type shown via text+icon, not colour alone. | PASS |

**Result (pre-Phase 0)**: No violations. Complexity Tracking is empty (the accounts⇄movements `forwardRef`
is a standard NestJS pattern for a truly bidirectional domain, documented in research R1).

**Post-Design re-check (after Phase 1)**: Re-evaluated against `research.md`, `data-model.md`, and
`contracts/movements.openapi.yaml`. All gates hold: movements + references scoped by session with mandatory
cross-family tests (I); derived balance with no stored editable figure, kind integrity, and an append-only
audit surviving deletion (III); one module reusing the existing guards, `forwardRef` for the balance coupling
(V); OpenAPI + shared contracts (VI). No new violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/006-movements/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── movements.openapi.yaml
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root) — files TXN-01 adds / edits

```text
apps/api/src/
├── common/validators/
│   └── is-calendar-date.validator.ts  # MOVED here from financial-accounts/dto for reuse (ACC-01 + TXN-01)
├── movements/
│   ├── movement.schema.ts            # Movement: type, amount(int>0), date, accountId, familyId(indexed),
│   │                                 #   categoryId?, note?, deletedAt(null|Date), createdBy, timestamps
│   ├── movement-event.schema.ts      # append-only audit: movementId, familyId, actorId, type, snapshot, createdAt
│   ├── movement.repository.ts        # family-scoped CRUD + softDelete + netByAccount aggregation
│   ├── movement-event.repository.ts  # append, listByFamily/Movement
│   ├── movement-balance.service.ts   # netForAccount / netByFamily (EXPORTED to ACC-01)
│   ├── movements.service.ts          # create/list/get/update/delete + validation (account/category/kind) + audit
│   ├── movements.controller.ts       # REST v1 /movements; JwtAuthGuard + FamilyScopeGuard; EmailVerifiedGuard on writes
│   ├── movements.module.ts           # forFeature Movement + MovementEvent; imports FamiliesModule,
│   │                                 #   CategoriesModule, forwardRef(FinancialAccountsModule); exports MovementBalanceService
│   └── dto/
│       ├── create-movement.dto.ts    # type, amount, date, accountId, categoryId?, note?
│       ├── update-movement.dto.ts     # all optional (partial edit)
│       └── list-movements.query.ts   # account?, type?
└── financial-accounts/               # EDITED (ACC-01 balance integration)
    ├── financial-accounts.service.ts  #   deriveBalance now adds MovementBalanceService.netForAccount
    ├── financial-accounts.module.ts   #   imports forwardRef(MovementsModule); exports FinancialAccountRepository
    └── financial-account.repository.ts #   (reused unchanged for account validation from movements)

packages/contracts/src/movement/       # MovementType, CreateMovementRequest, UpdateMovementRequest,
                                        #   MovementSummary, ListMovementsQuery filters
apps/mobile/app/(movements)/           # capture screen (amount/type/account/category/note) + history list (mobile)
```

Reuses `apps/api/src/families/` guards and the AUTH-01 guards unchanged. `CategoriesModule` exports
`CategoryRepository` and `FinancialAccountsModule` exports `FinancialAccountRepository` so movements can
validate references (both are one-way except the balance `forwardRef`).

**Structure Decision**: Keep the established monorepo layout. TXN-01 adds a `movements` domain module and the
audit `MovementEvent`. The derived balance stays an Account concern but pulls per-account movement sums from a
small `MovementBalanceService` the movements module exports; movements validate the referenced account via
`FinancialAccountRepository`. This mutual dependency (accounts need sums; movements need account validation) is
the one bidirectional coupling, resolved with `forwardRef` (research R1). The `IsCalendarDate` validator moves
to `common/validators/` for reuse. `MovementEvent` is the append-only audit (author + type + timestamp +
snapshot) that makes edits/deletions auditable and survives soft deletion.

## Complexity Tracking

> No constitutional violations. The accounts⇄movements `forwardRef` is a standard NestJS pattern for a
> genuinely bidirectional domain (documented in research R1), not a violation of Modular Monolith Simplicity.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
