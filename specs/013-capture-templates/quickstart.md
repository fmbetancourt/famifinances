# Quickstart: Capture Templates & Defaults (UX-01)

**Feature**: UX-01 · Plantillas y defaults de captura
**Date**: 2026-07-21

A runnable validation guide for the UX-01 backend. Details live in
[data-model.md](./data-model.md) and [contracts/capture.openapi.yaml](./contracts/capture.openapi.yaml).

## Prerequisites

- A registered, **email-verified** user who is a member of a family (AUTH-01 + FAM-01).
- At least one **active** account (ACC-01) and one **expense** category (CAT-01) in that family.
- A bearer access token for the session. Base path: `/v1`.

## Setup

```bash
pnpm install
pnpm --filter @famifinances/api start:dev      # API on http://localhost:3000
```

## Scenario 1 — Capture defaults reflect the last movement (US1, FR-001/002/003)

1. With **no movements yet**, `GET /v1/capture-defaults` → `200` with
   `{ type: null, accountId: null, categoryId: null, date: "<today>" }`.
2. Record a movement via TXN-01 (`POST /v1/movements`, e.g. expense, account A, category X).
3. `GET /v1/capture-defaults` → `{ type: "expense", accountId: "A", categoryId: "X", date: "<today>" }`.
4. Record another movement with account B / category Y; re-`GET` → defaults now `B` / `Y`
   (auto-updated, no manual step).

**Expected**: defaults always mirror the member's most recent movement; `date` is always today.

## Scenario 2 — Create and apply a template (US2, FR-004/006)

1. `POST /v1/capture-templates`
   `{ "name": "Feria semanal", "type": "expense", "accountId": "A", "categoryId": "X", "amount": 25000 }`
   → `201` with the template and `accountAvailable: true, categoryAvailable: true`.
2. `GET /v1/capture-templates` → the list includes it.
3. **Apply = client pre-fill**: the client reads the template and pre-fills `POST /v1/movements`
   with its type/account/category (and suggested amount), then the member confirms the amount and
   submits. No `apply` endpoint is called; the movement is created through TXN-01.

**Expected**: applying records nothing on its own; the template only supplies defaults for the alta.

## Scenario 3 — Type/category integrity (US2, FR-007)

1. `POST /v1/capture-templates` with `type: "expense"` but `categoryId` of an **income** category
   → `400` ("Category kind does not match the template type.").

**Expected**: no template can encode an income category on an expense (or vice versa).

## Scenario 4 — Manage & broken references (US3, FR-005/010)

1. `PATCH /v1/capture-templates/{id}` `{ "name": "Feria quincenal" }` → `200` renamed.
2. Archive the account referenced by the template (ACC-01), then `GET /v1/capture-templates`
   → the row now shows `accountAvailable: false` (needs reselection), and it does **not** error.
3. `DELETE /v1/capture-templates/{id}` → `204`; the list no longer includes it.
4. Duplicate name: creating a second "Feria quincenal" → `409`.

**Expected**: broken references degrade gracefully (flag, not crash); names stay unique per family.

## Scenario 5 — Family isolation (FR-008, Principle I)

1. As a member of **family F2**, `GET /v1/capture-templates/{id-from-F1}` → `404`.
2. `PATCH`/`DELETE` the same F1 id from F2 → `404`.

**Expected**: no cross-family read or write of templates or defaults.

## Scenario 6 — Any member can manage (FR-013)

1. A non-Owner **Member** of the family creates, edits and deletes a template → all succeed
   (writes still require a verified email; no Owner role required).

## Automated validation

```bash
pnpm --filter @famifinances/api test:e2e -- capture-defaults
pnpm --filter @famifinances/api test:e2e -- capture-template-crud
pnpm --filter @famifinances/api test:e2e -- capture-template-validation
pnpm --filter @famifinances/api test:e2e -- capture-template-isolation
pnpm --filter @famifinances/api test:e2e -- capture-openapi-parity
pnpm --filter @famifinances/api test:e2e -- capture-log-privacy
pnpm --filter @famifinances/api test        # unit: capture-templates.service.spec
```

**Green when**: defaults derive correctly (incl. empty + broken-reference null-out), template CRUD +
validation + isolation hold, the served Swagger matches `capture.openapi.yaml`, and no amount/note
appears in logs.
