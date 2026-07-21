# Quickstart: CSV Export (EXP-01)

**Feature**: EXP-01 · Exportación CSV
**Date**: 2026-07-21

A runnable validation guide for the EXP-01 backend. Details live in
[data-model.md](./data-model.md) and [contracts/export.openapi.yaml](./contracts/export.openapi.yaml).

## Prerequisites

- A registered, email-verified member of a family (AUTH-01 + FAM-01) with some **movements** and
  **transfers** recorded (TXN-01/02), across at least one account and category (ACC-01/CAT-01).
- A bearer access token. Base path: `/v1`.

## Setup

```bash
pnpm install
pnpm --filter @famifinances/api start:dev      # API on http://localhost:3000
```

## Scenario 1 — Export all movements (US1, FR-001/002/006)

1. `GET /v1/export/movements` with `Authorization: Bearer <token>`.
2. Response is `200` with `Content-Type: text/csv; charset=utf-8` and a `Content-Disposition`
   attachment filename.
3. The body starts with a UTF-8 BOM and the header `Fecha,Tipo,Monto,Cuenta,Categoría,Nota,Autor,Creado`,
   followed by one row per non-deleted movement (type shown as `Ingreso`/`Gasto`, amount as an integer,
   account/category by **name**, author as **email**).

**Expected**: the file opens in a spreadsheet with columns aligned and accents intact.

## Scenario 2 — Filtered export (US2, FR-003)

1. `GET /v1/export/movements?from=2026-07-01&to=2026-07-31&account=<id>` → only that account's July rows.
2. `GET /v1/export/movements?type=expense&category=<id>` → only expenses of that category.
3. A filter matching nothing → a valid CSV with **only the header row** (not an error).

**Expected**: the same filter semantics as the history (HIS-01), applied to the whole matching set.

## Scenario 3 — Special characters & deleted rows (FR-005/006)

1. Record a movement whose note contains a comma, a double quote, and a newline; export → that note
   stays in a single, correctly-quoted cell.
2. Record an accented note ("Cañería, 3\" válvula"); export → accents preserved.
3. Soft-delete a movement; export → it does **not** appear.

## Scenario 4 — Export transfers (US3, FR-007)

1. `GET /v1/export/transfers` → CSV with header `Fecha,Cuenta origen,Cuenta destino,Monto,Autor,Creado`
   and one row per non-deleted transfer (accounts by name, author email).

## Scenario 5 — Family isolation (FR-004, Principle I)

1. As a member of **family F2**, export movements/transfers → the file contains **only F2's** rows,
   never F1's.

## Automated validation

```bash
pnpm --filter @famifinances/api test:e2e -- export-movements
pnpm --filter @famifinances/api test:e2e -- export-transfers
pnpm --filter @famifinances/api test:e2e -- export-isolation
pnpm --filter @famifinances/api test:e2e -- export-escaping
pnpm --filter @famifinances/api test:e2e -- export-openapi-parity
pnpm --filter @famifinances/api test:e2e -- export-log-privacy
pnpm --filter @famifinances/api test        # unit: csv-writer.spec
```

**Green when**: full + filtered movements export, transfers export, per-family isolation, RFC-4180
escaping (incl. accents + empty result), and the served Swagger match the contract, with no amount/
note/email in logs.
