# Implementation Plan: Family Financial Accounts (ACC-01)

**Branch**: `004-accounts` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-accounts/`

## Summary

ACC-01 adds the **Account** — the first family-owned financial entity — on top of FAM-01's family
boundary. A verified family member creates, edits, archives, and unarchives accounts (type: bank, digital
wallet, cash, credit card; a manual institution label; an initial balance in whole-peso CLP; a start
date). Every account references its family; all access is authorized through FAM-01's session-derived
`FamilyScopeGuard`/`@CurrentFamily` (ACC-01 is that guard's **first real consumer**), and repository
queries are always bound to the session's `familyId` so a foreign account id resolves to 404. Per
constitution Principle III, an account's **current balance is derived** (initial balance + movements) and
is never stored as an editable field — in ACC-01 there are no movements yet (TXN-01), so the derived
balance equals the initial balance, but the read path is shaped so TXN-01 plugs in without changing the
account. Mutations require a verified email (AUTH-01 `EmailVerifiedGuard`); archived accounts are
read-only; accounts are archived, never hard-deleted.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`); Node.js 20 LTS; NestJS; Expo/React Native mobile.

**Primary Dependencies**: existing stack — NestJS, Mongoose (MongoDB), `class-validator`,
`@nestjs/throttler`, `@nestjs/swagger`. Reuses AUTH-01 (`JwtAuthGuard`, `@CurrentUser`,
`EmailVerifiedGuard`) and **FAM-01** (`FamilyScopeGuard`, `@CurrentFamily`) — the Principle I enforcement
point. No `FamilyRoleGuard`: any verified member manages accounts (not owner-only).

**Storage**: MongoDB via Mongoose. New collection: `financialAccounts` (named distinctly from the AUTH-01
`accounts`/user-identity collection).

**Testing**: Jest + Supertest (unit + e2e, `mongodb-memory-server`). Mandatory: cross-family isolation
(account resolved+scoped by session family, foreign account id → 404), derived-balance correctness,
archived read-only enforcement, server-side validation (type, name, whole-peso CLP amount), no financial
data in logs.

**Target Platform**: iOS/Android (Expo); Node API in a container.

**Project Type**: Mobile + API monorepo (`apps/api`, `apps/mobile`, `packages/contracts`).

**Performance Goals**: pilot scale (3–5 families, tens of accounts each). Create account < 1 min (SC-001)
end-to-end; server processing p95 < 300 ms.

**Constraints**: family scope MUST come from the authenticated session's membership, never from caller
input (Principle I); balance MUST be derived, never stored as an editable source of truth (Principle III);
single currency CLP as a whole-peso integer; archived accounts read-only; no hard delete; no account
name/institution/monetary figure in logs.

**Scale/Scope**: invited pilot; strict isolation/privacy per the constitution.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Assessment | Status |
|---|-----------|------------|--------|
| I | Family Data Isolation (NON-NEGOTIABLE) | ACC-01 is the **first consumer** of FAM-01's `FamilyScopeGuard`/`@CurrentFamily`: the family is resolved from the session; every repository query is bound to that `familyId`; a foreign account id resolves to 404. Cross-family authorization e2e tests are mandatory. | PASS (central) |
| II | Financial Privacy by Design | Server-side validation on all inputs; no account name, institution, or monetary figure in logs (FR-015); rate-limited via the global throttler; access always authorized by family. | PASS |
| III | Derived Balance Integrity | Current balance is **computed** (initial balance + movements) at read time; no editable stored balance. ACC-01 establishes this pattern (initial balance is the only persisted amount; movements arrive in TXN-01). | PASS (central) |
| IV | Test-First & Definition of Done | TDD; isolation + derived-balance + archived-read-only + validation tests authored with implementation; OpenAPI documented. | PASS |
| V | Modular Monolith Simplicity | One cohesive `accounts` module in the monolith; reuses the FAM-01 guard; no new infrastructure. | PASS |
| VI | Shared, Documented Contracts | OpenAPI + `packages/contracts` DTO types; TS strict, no `any`; hexagonal repository. | PASS |
| VII | Fast & Accessible Capture UX | Minimal mobile screens (account list, create/edit form, archive) with one primary action; account state (active/archived, over-limit later) via text+icon, not color alone. | PASS |

**Result (pre-Phase 0)**: No violations. Complexity Tracking is empty.

**Post-Design re-check (after Phase 1)**: Re-evaluated against `research.md`, `data-model.md`, and
`contracts/accounts.openapi.yaml`. All gates hold: family-from-session scoping on every query with
mandatory cross-family tests (I); derived balance with no stored editable figure (III); one domain module
reusing the FAM-01 guard, no new infrastructure (V); OpenAPI + shared contracts, strict typing (VI). No
new violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/004-accounts/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── accounts.openapi.yaml
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root) — files ACC-01 adds

```text
apps/api/src/
└── financial-accounts/                # named distinctly from the AUTH-01 `accounts` (user identity)
    ├── financial-account.schema.ts    # FinancialAccount (collection financialAccounts): familyId(indexed,
    │                                  #   ref Family), name, type, institution?, initialBalance(int CLP),
    │                                  #   startDate, archivedAt(null|Date), createdBy(ref Account), timestamps
    ├── financial-account.repository.ts # family-scoped CRUD; EVERY query bound to familyId
    ├── financial-accounts.service.ts   # create/list/get/update/archive/unarchive + derived balance
    ├── financial-accounts.controller.ts # REST v1 /accounts; JwtAuthGuard + FamilyScopeGuard; EmailVerifiedGuard on writes
    ├── financial-accounts.module.ts
    └── dto/
        ├── create-account.dto.ts      # name, type, initialBalance, startDate, institution?
        ├── update-account.dto.ts      # all fields optional (partial edit)
        └── list-accounts.query.ts     # status filter: active (default) | archived | all

packages/contracts/src/account/        # AccountType, CreateAccountRequest, UpdateAccountRequest,
                                        #   FinancialAccountSummary (accountId, name, type, institution?,
                                        #   initialBalance, balance, currency, startDate, archived)
apps/mobile/app/(accounts)/            # accounts list, create/edit form, archive action (mobile)
```

Reuses `apps/api/src/families/guards/family-scope.guard.ts` and
`apps/api/src/families/decorators/current-family.decorator.ts` **unchanged** — ACC-01 is their first
downstream consumer.

**Structure Decision**: Keep the established monorepo layout. ACC-01 adds a single cohesive
`financial-accounts` domain module (named to avoid a clash with the AUTH-01 `accounts` user-identity
module) and reuses FAM-01's family-scope guard for the Principle I boundary; it does **not** use the
owner-only role guard (any verified member manages accounts). The derived-balance read path is isolated in
the service so TXN-01 can extend it (initial balance + movement aggregation) without reshaping the account.

## Complexity Tracking

> No constitutional violations. No entries required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
