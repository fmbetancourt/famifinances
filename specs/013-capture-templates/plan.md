# Implementation Plan: Capture Templates & Defaults (UX-01)

**Branch**: `013-capture-templates` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-capture-templates/`

## Summary

UX-01 operationalizes the **backend** of Principle VII (Fast & Accessible Capture UX) on top of the
already-shipped movements/accounts/categories: (1) **capture defaults** — a per-member,
**derived-on-read** view of the last-used account, category and type (plus today's date) so a repeat
movement needs only an amount; and (2) **movement templates** — family-shared named presets
(type + category + account, optional suggested amount/note) that the client reads to pre-fill the
existing add-movement flow. Both are exposed as a documented REST surface (OpenAPI + shared
`packages/contracts` types); **the Expo/RN capture screen is deferred to the mobile track**
(backend-first, consistent with the 12 Must slices). No new capture endpoint records a movement:
applying a template is client-side pre-fill over TXN-01, and defaults add **no new collection**.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`); Node.js 20 LTS; NestJS 10; Mongoose 8; pnpm 10.

**Primary Dependencies**: existing stack — NestJS, `@nestjs/mongoose`, `@nestjs/swagger`,
`class-validator`/`class-transformer`, `@famifinances/contracts`. Reuses AUTH-01 (`JwtAuthGuard`,
`EmailVerifiedGuard`, `@CurrentUser`), FAM-01 (`FamilyScopeGuard`, `@CurrentFamily`), TXN-01
(`MovementRepository`), CAT-01 (`CategoryRepository`), ACC-01 (`FinancialAccountRepository`). No new
runtime dependency.

**Storage**: MongoDB. One **new** collection `movementTemplates` (family-scoped). **No** collection
for capture defaults — they are derived on read from the member's most recent movement.

**Testing**: Jest + Supertest e2e on the shared `mongodb-memory-server` harness (QLT-01), plus unit
specs for the template service/repository. New e2e suites: template CRUD, kind/type validation,
cross-family isolation, capture-defaults derivation (incl. empty + broken-reference), OpenAPI parity,
log privacy.

**Target Platform**: `apps/api` (Ubuntu CI + container runtime). No `apps/mobile` change this slice.

**Project Type**: Mobile + API monorepo; this feature touches the **API** and `packages/contracts`.

**Performance Goals**: pilot scale (3–5 families). Capture-defaults is one indexed query; template
list resolves reference-availability with a bounded number of set-based queries (not N per row).

**Constraints**: Principle I isolation (family from session only); no amount/note in logs (II); no
`forwardRef` — CaptureModule depends one-way on Movements/Categories/FinancialAccounts (V); TS strict,
named exports, OpenAPI documented (VI). CLP whole-peso amounts.

**Scale/Scope**: one new NestJS module (`capture`), one collection, 6 endpoints, shared contract
types, OpenAPI doc; no product-logic change to movements/accounts/categories beyond one added
read-only repository method.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Assessment | Status |
|---|-----------|------------|--------|
| I | Family Data Isolation (NON-NEGOTIABLE) | Every template query and the defaults query bind `familyId` (and the member's `createdBy`) from the session, never from client input; a foreign/malformed id resolves to null → 404. Cross-family e2e is mandatory and included. | PASS |
| II | Financial Privacy by Design | Template log lines carry ids only — never the suggested amount or note; defaults expose no note. Inputs validated at the backend; family scope enforced. | PASS |
| III | Derived Balance Integrity | Defaults are **derived**, not a stored editable value. A template's category `kind` MUST equal its `type` (income↔expense), reusing CAT-01's kind rule. Applying a template creates nothing itself — the movement is recorded through TXN-01, which keeps its own integrity checks. | PASS |
| IV | Test-First & Definition of Done | e2e + unit written with the code; the new family-scoped `movement-template.repository.ts` falls in QLT-01's ≥90% high-risk coverage scope. Backend-first → **no** mobile-UX change, so the physical-device DoD gate does not apply this slice (recorded in Assumptions). | PASS |
| V | Modular Monolith Simplicity (YAGNI) | One new module, one collection; defaults add **no** collection (derived-on-read); apply adds **no** endpoint (client pre-fill). One-way deps → **no `forwardRef`**. No new infrastructure. | PASS |
| VI | Shared, Documented Contracts | OpenAPI (`contracts/capture.openapi.yaml`) + `packages/contracts/src/capture`; TS strict, no `any`, named exports; SOLID layered controller→service→repository. | PASS |
| VII | Fast & Accessible Capture UX | This feature **is** the backend of VII: last-used defaults + frequent templates. The UI mandates (color+label+icon, CLP formatting, single primary action, "last updated") ship with the deferred screen. | PASS |

**Result (pre-Phase 0)**: No violations. Complexity Tracking is empty.

**Post-Design re-check (after Phase 1)**: Re-evaluated against `research.md`, `data-model.md`, and
`contracts/capture.openapi.yaml`. All gates hold: isolation enforced in the repository (I); ids-only
logs (II); derived defaults + kind==type templates (III); tests + coverage scope (IV); one module,
no new collection for defaults, no apply endpoint, no `forwardRef` (V); OpenAPI + contracts, strict
TS (VI); backend of the capture UX (VII). No new violations.

## Project Structure

### Documentation (this feature)

```text
specs/013-capture-templates/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (MovementTemplate + derived CaptureDefaults)
├── quickstart.md        # Phase 1 output (runnable validation guide)
├── contracts/
│   └── capture.openapi.yaml   # The 6-endpoint REST contract
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root) — files UX-01 adds / edits

```text
apps/api/src/capture/                         # NEW module
├── movement-template.schema.ts               # NEW: Mongoose schema (collection 'movementTemplates')
├── movement-template.repository.ts           # NEW: family-scoped persistence (CRUD + availability resolve)
├── capture-templates.service.ts              # NEW: template CRUD + kind/type + reference validation
├── capture-templates.controller.ts           # NEW: REST 'capture-templates' (any member; writes verified)
├── capture-defaults.service.ts               # NEW: derive last-used from the member's latest movement
├── capture-defaults.controller.ts            # NEW: REST 'capture-defaults' (read; any member)
├── capture.module.ts                         # NEW: wires the above; imports Movements/Categories/Accounts/Families
├── capture-templates.service.spec.ts         # NEW: unit — kind/type + reference validation
└── dto/
    ├── create-template.dto.ts                # NEW
    └── update-template.dto.ts                # NEW

apps/api/src/movements/movement.repository.ts # EDITED: + findLatestByMember(familyId, memberId) (read-only)
apps/api/src/app.module.ts                    # EDITED: register CaptureModule

packages/contracts/src/capture/index.ts       # NEW: CaptureDefaults + template request/summary types
packages/contracts/src/index.ts               # EDITED: export ./capture

apps/api/test/
├── capture-template-crud.e2e-spec.ts         # NEW: create/list/get (any member)
├── capture-template-validation.e2e-spec.ts   # NEW: kind≠type, bad refs, duplicate name, whitespace name
├── capture-template-isolation.e2e-spec.ts    # NEW: cross-family 404 (Principle I)
├── capture-template-manage.e2e-spec.ts       # NEW: rename/edit/delete + broken-reference degradation (US3)
├── capture-defaults.e2e-spec.ts              # NEW: last-used derivation + empty + broken-reference null-out
├── capture-openapi-parity.e2e-spec.ts        # NEW: served Swagger == committed contract
├── capture-log-privacy.e2e-spec.ts           # NEW: no amount/note in logs
└── capture-helpers.ts                        # NEW: suite helpers
```

**Structure Decision**: A single new `apps/api/src/capture/` module holds both sub-features (templates
persistence + derived defaults) because they share the same capture concern and the same imported
collaborators (`MovementRepository`, `CategoryRepository`, `FinancialAccountRepository`,
`FamilyScopeGuard`). All three collaborator repositories are already **exported** by their modules and
CaptureModule consumes them **one-way**, so — unlike the accounts⇄movements cycle — **no `forwardRef`**
is introduced (Principle V). Two thin controllers keep the REST surface clean: `capture-templates`
(CRUD, path-param `:id`) and `capture-defaults` (a single GET), avoiding a route collision between
`/capture-templates/:id` and a defaults path. Capture defaults are **derived on read** (a new
read-only `MovementRepository.findLatestByMember`), adding no collection and staying consistent with
movements by construction; template writes require a verified email (guard order FamilyScope → Email),
while any family member — Owner or Member — may manage templates (no `FamilyRoleGuard`).

## Complexity Tracking

> No constitutional violations. No entries required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
