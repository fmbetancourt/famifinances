# Research: System & Family Categories (CAT-01)

**Feature**: CAT-01 · System and family categories (income/expense kind)
**Date**: 2026-07-18

All Technical Context items are resolved; the stack is inherited from AUTH-01/FAM-01/ACC-01. No open
`NEEDS CLARIFICATION` remain — the two high-impact ambiguities were closed in `/speckit-clarify` (Session
2026-07-18): any verified member manages custom categories; system defaults are global/read-only.

## R1 · One collection, two scopes (system vs family)

- **Decision**: Store both scopes in a single `categories` collection with a `scope` discriminator
  (`system` | `family`). System categories have `familyId = null` and no `createdBy`; family categories have
  `familyId` set (from the session) and a `createdBy`. A member's list is `scope = system` **union**
  (`scope = family` AND `familyId = session` AND active).
- **Rationale**: Both scopes share the same shape (name + kind) and are queried together in one list; one
  collection keeps the read simple (a single `$or` query) and avoids a second entity. The `scope` field
  makes read-only enforcement explicit.
- **Alternatives considered**: two collections (systemCategories + familyCategories) — rejected: duplicates
  the shape and complicates the merged list; per-family seeded copies (Clarify Q2 option C) — rejected: more
  storage and drift, and clarify chose global read-only defaults.

## R2 · Seeding the system defaults (idempotent, on module init)

- **Decision**: `CategoriesModule` implements `OnModuleInit` and calls a seeder that **upserts** each default
  category keyed by `{ scope: 'system', kind, name }` (idempotent — safe on every boot, in tests, and across
  instances). A partial **unique index** on `{ scope, kind, name }` for `scope = 'system'` guarantees no
  duplicate defaults. The default set is a curated Chilean-household list defined in `category.seed.ts`.
- **Rationale**: Families need categories with zero setup (SC-001); seeding at startup makes defaults present
  before any request, works identically under `mongodb-memory-server` in e2e, and upsert keeps it safe to
  re-run. Keeping the list in code (not a DB migration tool) fits the modular monolith (Principle V).
- **Alternatives considered**: seeding per-family on family creation (couples CAT-01 to FAM-01 and duplicates
  data); a manual migration script (extra tooling, not run in tests); lazy seed on first list call (racy,
  request-path side effects).

## R3 · Visibility-scoped repository & read-only defaults

- **Decision**: The repository never trusts a caller-supplied family/category id. `listVisible(familyId,
  filters)` returns `system` + own active `family` categories. `findVisible(familyId, id)` matches a category
  that is either `system` **or** `family` owned by the session family. Mutations (`rename`, `archive`,
  `unarchive`) resolve via `findVisible`, then: a `system` category → **403 Forbidden** (read-only); a
  `family` category owned by another family → not matched → **404**; own `family` category → proceed.
- **Rationale**: Gives clear, testable semantics — a foreign custom category is invisible (404, Principle I),
  while a shared default is visible but read-only (403, SC-005). Binding every query to the session `familyId`
  is the same Principle-I pattern ACC-01 uses.
- **Alternatives considered**: returning 404 for system-category mutations too (less informative; SC-005
  reads more naturally as "rejected as read-only" = 403); a separate read model for defaults (unneeded).

## R4 · Immutable kind & scope; edit is name-only

- **Decision**: `CreateCategoryDto` accepts `name` + `kind`; `UpdateCategoryDto` accepts **only** `name`.
  There is no path to change `kind` or `scope` after creation. Archived custom categories are read-only
  (rename → 409, mirroring ACC-01), and unarchive is the only permitted transition on them.
- **Rationale**: Changing a category's kind would silently reclassify every past movement (Principle III /
  FR-004); making it structurally impossible (absent from the update contract) is the safest enforcement.
- **Alternatives considered**: allowing kind change with a cascade/migration (out of scope, dangerous);
  a soft "deprecate + recreate" flow (unnecessary for the MVP — archive covers retirement).

## R5 · Roles, gate & validation

- **Decision**: Guard every route with `JwtAuthGuard` + `FamilyScopeGuard`; writes additionally use
  `EmailVerifiedGuard`, ordered **`FamilyScopeGuard` before `EmailVerifiedGuard`** so "no family" is a
  consistent 404 and 403 is reserved for the email gate (the ACC-01 convention). No `FamilyRoleGuard` — any
  verified member manages custom categories (Clarify Q1). DTOs trim `name` before validation (so
  whitespace-only fails `@MinLength(1)`), and `kind` is validated against the `income|expense` enum.
- **Rationale**: Consistency with ACC-01's guard order and trim handling (both hardened via review); the
  clarify decision removes the role gate.
- **Alternatives considered**: owner-only via `FamilyRoleGuard` (rejected in Clarify Q1); `@IsISO8601`-style
  loose validation (n/a — no dates here).

## R6 · Endpoint shape

- **Decision**: `/categories` collection, family from the session (never in the path):
  `GET /categories` (`?kind=`, `?status=`), `POST /categories`, `PATCH /categories/:id` (rename),
  `POST /categories/:id/archive`, `POST /categories/:id/unarchive`. `GET` returns system + own active custom
  by default; `status=archived` returns the family's archived custom only; `status=all` adds archived custom
  to the default set. `?kind` filters to one kind. There is no delete route (FR-012).
- **Rationale**: Mirrors ACC-01's session-implicit scoping and archive actions; the `status`/`kind` filters
  cover the list needs without extra endpoints.
- **Alternatives considered**: nesting under `/families/{id}/categories` (exposes a client family id, against
  Principle I); a separate `/categories/defaults` endpoint (unneeded — defaults are part of the one list).

## Default system categories (seed)

A curated set for Chilean households (exact wording finalized in `category.seed.ts`), covering both kinds:

- **Income**: Sueldo, Honorarios, Otros ingresos.
- **Expense**: Alimentación, Transporte, Vivienda, Servicios básicos, Salud, Educación, Entretenimiento,
  Otros gastos.

## Resolved Technical Context

| Item | Decision |
|------|----------|
| Storage shape | One `categories` collection, `scope` discriminator (system/family) — R1 |
| Seeding | Idempotent upsert on `OnModuleInit`; unique index on system `{scope,kind,name}` — R2 |
| Isolation | `findVisible`/`listVisible` bound to session family; system→403, foreign custom→404 — R3 |
| Immutability | `kind`/`scope` fixed; update is name-only; archived custom read-only — R4 |
| Roles/gate | Any verified member; FamilyScope before EmailVerified on writes; trim + enum validation — R5 |
| Endpoints | `/categories` with `?kind`/`?status`; archive/unarchive actions; no delete — R6 |
