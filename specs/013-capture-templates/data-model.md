# Data Model: Capture Templates & Defaults (UX-01)

**Feature**: UX-01 · Plantillas y defaults de captura
**Date**: 2026-07-21

UX-01 adds **one** persisted collection (`movementTemplates`) and **one derived, non-persisted** view
(capture defaults). It reuses movements, financial accounts and categories unchanged (plus one
read-only repository method on movements).

## Entity: MovementTemplate *(persisted — collection `movementTemplates`)*

A family-shared, named preset for a frequent income/expense movement.

| Field | Type | Rules |
|-------|------|-------|
| `familyId` | ObjectId → Family | Required; **from the session**, never from client input (Principle I). Indexed. |
| `name` | string | Required; trimmed; non-empty (whitespace-only rejected); ≤ 80 chars; **unique within the family** (case-insensitive). |
| `type` | `'income' \| 'expense'` | Required; the movement direction the template records. |
| `accountId` | ObjectId → FinancialAccount | Required; must reference an **active** account of the family at create/update time. |
| `categoryId` | ObjectId → Category | Required; must reference a **visible, active** category whose `kind` **equals** `type` (Principle III). |
| `amount` | number \| null | Optional suggested amount; when present, a **positive** whole-peso CLP integer (> 0). Default `null`. |
| `note` | string \| null | Optional suggested note; ≤ 280 chars. Default `null`. Never logged. |
| `createdBy` | ObjectId → Account | Required; the member (AUTH-01 account id) who created it. |
| `createdAt` / `updatedAt` | Date | Mongoose `timestamps`. |

**Indexes**

- `{ familyId: 1, name: 1 }` **unique** — enforces family-scoped name uniqueness (backstop to the
  service pre-check that returns `409`). Case-insensitive uniqueness is enforced in the service
  (normalized compare); the index guards against races.
- `{ familyId: 1 }` — list the family's templates.

**Lifecycle**: created → (edited)\* → hard-deleted. Templates are convenience data with no audit
requirement (unlike movements), so deletion is a real delete, not a soft-delete.

**Derived read fields** (not stored; computed per response — R4):

| Field | Meaning |
|-------|---------|
| `accountAvailable` | `true` iff `accountId` still resolves to an active family account. |
| `categoryAvailable` | `true` iff `categoryId` still resolves to a visible active category whose `kind === type`. |

## Derived view: CaptureDefaults *(NOT persisted — computed on read, R1)*

Per **member** (the authenticated account), the values to pre-fill the add-movement flow.

| Field | Type | Derivation |
|-------|------|------------|
| `type` | `'income' \| 'expense' \| null` | The `type` of the member's most recent non-deleted movement; `null` if none. |
| `accountId` | string \| null | That movement's `accountId`; `null` if none, or if that account is now archived/missing. |
| `categoryId` | string \| null | That movement's `categoryId`; `null` if none, uncategorized, archived/missing, or `kind` no longer matches `type`. |
| `date` | string (`YYYY-MM-DD`) | **Always today** (server clock) — never persisted, computed per request. |

**Source query** (new, read-only): `MovementRepository.findLatestByMember(familyId, memberId)` →
the latest `{ familyId, createdBy: memberId, deletedAt: null }` movement by `date desc, createdAt
desc`, or `null`. Reuses the existing `{ familyId, deletedAt, date }` index.

## Validation rules (authoritative — enforced in `capture-templates.service.ts`)

- **Account**: `FinancialAccountRepository.findInFamily` must return a non-archived account, else
  `400 "Account is not available."` (mirrors TXN-01).
- **Category**: `CategoryRepository.findVisible` must return a category that is active (system, or
  family with `archivedAt === null`) **and** `category.kind === template.type`, else `400`
  (`"Category is not available."` / `"Category kind does not match the template type."`).
- **Name**: trimmed non-empty (else `400`); unique within the family case-insensitively (else `409`).
- **Amount**: when provided, integer `> 0` (else `400`).
- **Type**: `income | expense` (else `400`).
- **Isolation**: every read/write binds `familyId` from the session; a foreign/malformed `:id`
  resolves to `null → 404` (Principle I). No family identifier is ever read from client input.

## Relationships

```text
Family (1) ──< MovementTemplate (N)      # familyId, session-scoped
MovementTemplate (N) ──> FinancialAccount (1)   # accountId (active)
MovementTemplate (N) ──> Category (1)           # categoryId (active, kind == type)
Account/Member (1) ──< MovementTemplate (N)     # createdBy
Member (1) ──> CaptureDefaults (derived)        # from the member's latest Movement
```

## Notes

- `movementTemplates` is the only new collection; capture defaults add none (R1).
- Reuse, not redefinition: accounts, categories, movements are untouched except for one added
  read-only movements query. Applying a template records nothing here — it pre-fills TXN-01.
