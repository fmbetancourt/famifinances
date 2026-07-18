# Quickstart & Validation: CAT-01 (System & Family Categories)

**Feature**: Categories — system defaults + family custom categories, fixed income/expense kind
**Date**: 2026-07-18

Proves CAT-01 end-to-end. References [data-model.md](./data-model.md) and
[contracts/categories.openapi.yaml](./contracts/categories.openapi.yaml). Validation/run guide only —
implementation belongs in `tasks.md`.

## Prerequisites

- The AUTH-01 + FAM-01 API running (auth, sessions, email verification, families & memberships) with an
  in-memory or dev Mongo. System defaults are seeded on API startup (idempotent).
- Test accounts must be **email-verified** and belong to a **family** (via FAM-01) to manage custom
  categories. E2E tests reuse the FAM-01/ACC-01 helpers (`registerVerifiedUser`, create-family) to set up
  members.

## Automated validation (authoritative)

```bash
pnpm --filter @famifinances/api test        # unit
pnpm --filter @famifinances/api test:e2e    # integration/e2e (mongodb-memory-server)
```

Required passing checks (map to spec):

- **US1 See categories (SC-001)**: a verified member of a brand-new family `GET /categories` → a non-empty
  set of **system defaults** covering both `income` and `expense`, each with its `kind`, with zero setup.
- **US2 Create custom (SC-002)**: `POST /categories` with `{ name, kind }` → `201`, `scope: family`; it
  appears in the family's list under its kind. Unverified → `403`. Missing name / invalid kind /
  whitespace-only name → `400`.
- **US3 Isolation (SC-003, Principle I)**: a custom category created in family A is not visible to family B
  (`GET /categories` omits it; `GET/PATCH/POST /categories/{A-id}` as B → `404`); a foreign `familyId` in the
  request is ignored; both families still see the shared system defaults; a user with no family → `404`.
- **US4 Rename (SC-005)**: `PATCH /categories/{id}` renames a custom category → `200`, kind unchanged;
  renaming a **system** default → `403` (read-only); empty/whitespace name → `400`.
- **US5 Archive/unarchive (SC-007)**: `POST /categories/{id}/archive` → `200`, the custom category drops out
  of the default (`status=active`) list but is retrievable via `status=archived`/`all`; renaming it → `409`;
  `unarchive` → `200` restores it; archiving a **system** default → `403`; no delete route exists.
- **Kind immutability (SC-004)**: the update contract has no `kind` field, so a category's kind cannot change.
- **Privacy (Constitution II)**: no category name appears in logs across seed/list/create/rename/archive.

## Manual smoke walkthrough (optional)

Using Swagger UI (`/api/docs`) with a verified member A of a family:

1. A `GET /categories` → system defaults for income and expense are present (zero setup).
2. A `POST /categories` `{ "name": "Feria", "kind": "expense" }` → `201`, `scope: family`.
3. A `GET /categories?kind=expense` → includes the default expense categories + "Feria".
4. A `PATCH /categories/{feria-id}` `{ "name": "Feria libre" }` → `200`; kind still `expense`.
5. A `PATCH /categories/{a-system-default-id}` `{ "name": "X" }` → `403` (read-only default).
6. A `POST /categories/{feria-id}/archive` → `200`; `GET /categories` no longer lists it;
   `GET /categories?status=archived` does; renaming it → `409`.
7. A `POST /categories/{feria-id}/unarchive` → `200`, back in the active list.
8. As a member of a **different** family, `GET /categories/{feria-id}` → `404` (isolation).

## Expected outcome

All automated suites pass; every family starts with usable income/expense defaults; custom categories are
scoped to the session family; cross-family access returns 404; system defaults are read-only (403); the kind
is fixed and immutable; custom categories are archived (never deleted). At that point CAT-01 satisfies its
Success Criteria and provides the classification foundation TXN-01 (movements) and BUD-01 (budgets) build on.

## Validation results (T029)

Executed against the automated suite (`mongodb-memory-server`, serial) — the authoritative validation.

- **Unit**: 6 suites / 18 tests pass.
- **E2E**: 40 suites / 97 tests pass, including all CAT-01 suites: `list-categories`, `create-category`,
  `category-isolation`, `rename-category`, `archive-category`, `category-seed`, `category-log-privacy`,
  `category-openapi-parity`.
- **Typecheck**: strict `tsc --noEmit` clean (T030); `packages/contracts` category types compile against the
  API with no `any`.
- **Seeding**: system defaults (3 income + 8 expense) are present on startup and the seeder is idempotent
  (re-running does not duplicate — partial unique index on system `{scope,kind,name}`).

**SC-002 (create category < 1 min)** is a user-task-time budget; `POST /categories` returns in
single-digit-to-low-tens of milliseconds in e2e, leaving the whole budget to the user. A full timed UX
walkthrough is deferred to mobile integration.
