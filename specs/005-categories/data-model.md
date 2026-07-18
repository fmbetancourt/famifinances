# Data Model: System & Family Categories (CAT-01)

**Feature**: CAT-01 · System and family categories (income/expense kind)
**Date**: 2026-07-18

CAT-01 adds one persisted collection, `categories`, holding both **system** (global, seeded) and **family**
(custom, owned by a FAM-01 `Family`) scopes. It introduces no monetary data — categories only classify the
movements that arrive in TXN-01. `Family` and `Membership` are referenced from FAM-01, not redefined here.

## Entity: Category (`categories`)

A label used to classify money, carrying a fixed **kind**. A `system` category is a global read-only default
shared by all families; a `family` category is custom, owned by exactly one family and managed by any of its
verified members.

| Field | Type | Rules |
|-------|------|-------|
| `_id` | ObjectId | Primary key; the `categoryId` in the API. |
| `scope` | string enum | Required; `system` \| `family`. Immutable. |
| `kind` | string enum | Required; `income` \| `expense`. **Immutable** (FR-004). |
| `name` | string | Required; 1–80 chars (trimmed). Not unique (Clarify default). |
| `familyId` | ObjectId (ref Family) \| null | `null` for `system`; the owning family (from the session) for `family`. **Indexed.** Never from client input. |
| `archivedAt` | Date \| null | `family` only: `null` = active, a timestamp = archived. Always `null` for `system`. |
| `createdBy` | ObjectId (ref Account) \| null | `family` only: the member who created it (FR-014). `null` for `system`. |
| `createdAt` | Date | Creation timestamp (Mongoose). |
| `updatedAt` | Date | Last-modification timestamp (Mongoose); attributes edits (FR-014). |

**Indexes**:

- `familyId` (family-scoped list).
- Partial **unique** index on `{ scope, kind, name }` where `scope = 'system'` — guarantees the seeder never
  creates duplicate defaults (idempotent upsert key).

**Validation rules** (server-side, FR-013):

- `name`: present, trimmed length 1–80 (whitespace-only rejected).
- `kind`: within `{ income, expense }`; set only at creation, never on update.
- `scope`: server-assigned (`family` for created categories; `system` only via the seeder) — never accepted
  from client input.
- On **create**, `familyId` = session family, `createdBy` = session member, `scope` = `family`,
  `archivedAt` = null.
- On **update**, only `name` may change.

**Visibility & access** (Principle I, R3):

- A member sees `scope = system` **plus** `scope = family AND familyId = session` categories.
- `findVisible(familyId, id)` matches a `system` category or a `family` category owned by the session family;
  anything else (another family's custom) is **not found** → 404.
- Mutations resolve via `findVisible`, then branch: `system` → **403** (read-only); own `family` → proceed.

**State transitions** (family scope only):

```text
        create (scope=family, kind fixed)
          │
          ▼
      ┌────────┐   archive    ┌──────────┐
      │ active │ ───────────▶ │ archived │   (excluded from the active/pickable set)
      │        │ ◀─────────── │ (read-   │
      └────────┘  unarchive   │  only)   │
          │                   └──────────┘
          │ rename (active only; name only)   (rename on archived → 409)
          └────────────────────────────────

      system scope: immutable — no create/rename/archive/delete by a family (→ 403).
      delete: not supported (FR-012) — custom categories are archived; defaults are immutable.
```

## System defaults (seed)

Seeded once, idempotently, on module init (R2). A curated Chilean-household set covering both kinds:

- **Income**: Sueldo, Honorarios, Otros ingresos.
- **Expense**: Alimentación, Transporte, Vivienda, Servicios básicos, Salud, Educación, Entretenimiento,
  Otros gastos.

(The exact list lives in `category.seed.ts`; the requirement is only that both kinds are non-empty — SC-001.)

## Relationships

- **Category (family) → Family** (`familyId`): many custom categories per family; the category references the
  family, not an individual, so membership changes never alter ownership. Access is authorized against the
  session family (Principle I).
- **Category (family) → Account (`createdBy`)**: the creating member (an AUTH-01 user `Account`);
  informational (FR-014), not an access-control input.
- **Category → Movement** *(future, TXN-01)*: movements will reference a `categoryId`; the category's `kind`
  must match the movement type (income category ↔ income, expense ↔ expense). Enforced in TXN-01. Out of
  scope for CAT-01.

## Notes

- **Family owns custom data**: consistent with ACC-01/FAM-01; removing/leaving a membership never cascades to
  categories.
- **No new isolation mechanism**: custom scoping is entirely via FAM-01's `FamilyScopeGuard`/`@CurrentFamily`.
- **System defaults are immutable/shared**: not owned by any family; never edited or removed by a family.
