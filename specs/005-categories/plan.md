# Implementation Plan: System & Family Categories (CAT-01)

**Branch**: `005-categories` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-categories/`

## Summary

CAT-01 adds the **Category** — a label with a fixed **kind** (income or expense) used to classify money.
Two scopes coexist: **system** categories (a curated default set, seeded once, global and read-only,
shared by every family) and **family** categories (custom, owned by one family, created/renamed/archived by
any verified member). A member's category set is the system defaults plus their family's active custom
categories, grouped by kind. Custom-category access is authorized through FAM-01's session-derived
`FamilyScopeGuard`/`@CurrentFamily` (reused, as in ACC-01); another family's custom categories resolve to
404, and a system category is read-only (rename/archive → 403). The kind is fixed at creation and immutable;
it is the foundation TXN-01 uses to enforce the constitution's income-vs-expense integrity rule. Custom
categories are archived, never deleted; system defaults are immutable.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`); Node.js 20 LTS; NestJS; Expo/React Native mobile.

**Primary Dependencies**: existing stack — NestJS, Mongoose (MongoDB), `class-validator`/`class-transformer`,
`@nestjs/throttler`, `@nestjs/swagger`. Reuses AUTH-01 (`JwtAuthGuard`, `@CurrentUser`, `EmailVerifiedGuard`)
and **FAM-01** (`FamilyScopeGuard`, `@CurrentFamily`). No `FamilyRoleGuard`: any verified member manages
custom categories (Clarify Q1).

**Storage**: MongoDB via Mongoose. New collection: `categories` (holds both system and family scopes).

**Testing**: Jest + Supertest (unit + e2e, `mongodb-memory-server`). Mandatory: system-default seeding
(non-empty, both kinds, idempotent), cross-family isolation (custom scoped by session family; foreign id →
404), system-defaults read-only (rename/archive → 403), kind immutable, validation (name trimmed, kind
enum), no category names in logs.

**Target Platform**: iOS/Android (Expo); Node API in a container.

**Project Type**: Mobile + API monorepo (`apps/api`, `apps/mobile`, `packages/contracts`).

**Performance Goals**: pilot scale (3–5 families, tens of categories each). Create category < 1 min (SC-002);
server processing p95 < 300 ms.

**Constraints**: custom-category scope from the authenticated session, never from caller input (Principle I);
category kind fixed/immutable (Principle III foundation); system defaults global read-only; no hard delete;
no category name in logs.

**Scale/Scope**: invited pilot; strict isolation/privacy per the constitution.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Assessment | Status |
|---|-----------|------------|--------|
| I | Family Data Isolation (NON-NEGOTIABLE) | Custom categories are scoped by the session `familyId` (FAM-01 `FamilyScopeGuard`); a foreign custom-category id → 404; system defaults are shared read-only. Cross-family authorization e2e tests are mandatory. | PASS |
| II | Financial Privacy by Design | Server-side validation on all inputs; category names (which can hint at spending) never appear in logs; access always authorized by family; rate-limited via the global throttler. | PASS |
| III | Derived Balance Integrity | No balances here, but CAT-01 establishes the immutable **kind** that TXN-01 uses to enforce "an income category is never applied to an expense, nor vice versa". | PASS (foundation) |
| IV | Test-First & Definition of Done | TDD; seeding + isolation + read-only-defaults + kind-immutability + validation tests authored with implementation; OpenAPI documented. | PASS |
| V | Modular Monolith Simplicity | One cohesive `categories` module (+ an idempotent seeder) in the monolith; reuses the FAM-01 guard; no new infrastructure. | PASS |
| VI | Shared, Documented Contracts | OpenAPI + `packages/contracts` DTO types; TS strict, no `any`; hexagonal repository. | PASS |
| VII | Fast & Accessible Capture UX | Minimal mobile screens (category picker grouped by kind, manage/create) with one primary action; kind shown via text+icon, not colour alone. | PASS |

**Result (pre-Phase 0)**: No violations. Complexity Tracking is empty.

**Post-Design re-check (after Phase 1)**: Re-evaluated against `research.md`, `data-model.md`, and
`contracts/categories.openapi.yaml`. All gates hold: custom scoped by session with mandatory cross-family
tests and read-only defaults (I); no category names in logs (II); immutable kind as TXN-01's integrity
foundation (III); one module + idempotent seeder, no new infrastructure (V); OpenAPI + shared contracts (VI).
No new violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/005-categories/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── categories.openapi.yaml
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root) — files CAT-01 adds

```text
apps/api/src/
└── categories/
    ├── category.schema.ts            # Category: kind(income|expense), name, scope(system|family),
    │                                  #   familyId(null for system, indexed), archivedAt(null|Date),
    │                                  #   createdBy(ref Account, custom only), timestamps
    ├── category.repository.ts         # visibility-scoped queries: listVisible(family, filters) = system +
    │                                  #   own active custom; findVisible(family, id); create/rename/setArchived
    │                                  #   for own custom only
    ├── category.seed.ts               # curated default income/expense categories + idempotent upsert
    ├── categories.service.ts          # list/create/rename/archive/unarchive; system → 403; seed orchestration
    ├── categories.controller.ts       # REST v1 /categories; JwtAuthGuard + FamilyScopeGuard; EmailVerifiedGuard on writes
    ├── categories.module.ts           # forFeature Category; import FamiliesModule; OnModuleInit → seed defaults
    └── dto/
        ├── create-category.dto.ts     # name (trimmed 1–80), kind (income|expense)
        ├── update-category.dto.ts     # name only (kind + scope immutable)
        └── list-categories.query.ts   # kind? (income|expense), status? (active default | archived | all)

packages/contracts/src/category/       # CategoryKind, CategoryScope, CategoryStatusFilter,
                                        #   CreateCategoryRequest, UpdateCategoryRequest, CategorySummary
apps/mobile/app/(categories)/          # category list (grouped by kind), create/manage screens (mobile)
```

Reuses `apps/api/src/families/` (`FamilyScopeGuard`, `@CurrentFamily`, exported by `FamiliesModule`) and the
AUTH-01 guards **unchanged**.

**Structure Decision**: Keep the established monorepo layout. CAT-01 adds a single cohesive `categories`
domain module holding both scopes in one collection, plus an idempotent module-init seeder for the system
defaults. It reuses FAM-01's family-scope guard (as ACC-01 does) and does **not** use the owner-only role
guard (any verified member manages custom categories). The immutable `kind` is the classification foundation
TXN-01 and BUD-01 build on.

## Complexity Tracking

> No constitutional violations. No entries required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
