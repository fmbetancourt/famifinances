# Research: Capture Templates & Defaults (UX-01)

**Feature**: UX-01 · Plantillas y defaults de captura
**Date**: 2026-07-21

All open decisions were closed in `/speckit-clarify` (Session 2026-07-21): backend-only scope;
templates managed by any family member; capture defaults derived on read; applying a template is
client-side pre-fill (no `apply` endpoint). This document records the resulting technical decisions
and the patterns inherited from TXN-01 / CAT-01 / ACC-01 / BUD-01.

## R1 · Capture defaults — derive on read, no new collection

- **Decision**: Expose `GET /capture-defaults` returning `{ type, accountId, categoryId, date }` for
  the **authenticated member**, computed from that member's **most recent non-deleted movement**
  (`familyId` + `createdBy` from the session, `deletedAt: null`, sorted `date desc, createdAt desc`).
  `date` is always **today** (`YYYY-MM-DD`, server clock). Each of `type/accountId/categoryId` is the
  value of that single latest movement; a field is **nulled out** when it cannot be safely reused:
  no prior movement → all null; the referenced account is archived/missing → `accountId: null`; the
  referenced category is archived/missing or its `kind` no longer matches the type → `categoryId:
  null`. A new read-only `MovementRepository.findLatestByMember(familyId, memberId)` backs it.
- **Rationale**: "Last used" in capture UX means "repeat my last entry", so a single latest movement
  is the correct, intuitive source — and it is always consistent with the movements collection with
  zero synchronization. Deriving on read honors Principle V (no `movementTemplates`-style projection
  to keep in step with every create/edit/delete) and Principle III (defaults are derived, never a
  stored editable truth). One indexed query (`{ familyId, deletedAt, date }` already exists) is
  ample at pilot scale.
- **Alternatives considered**: a persisted per-member `captureDefaults` document updated on each
  movement write (**rejected** — a new collection plus write-path coupling and a consistency burden
  for no read-latency benefit at this scale); per-field "last used" across different movements
  (**rejected** — surprising for repeat-entry UX and multiple queries for marginal value).

## R2 · Movement templates — family-shared, any-member CRUD

- **Decision**: A new family-scoped collection `movementTemplates` with a NestJS `capture` module
  (controller → service → repository), mirroring BUD-01's allocation module shape. A template holds
  `name`, `type` (income|expense), `accountId`, `categoryId` (**required** — the template's defining
  classification), optional `amount` (positive whole-peso CLP) and `note`, plus `createdBy` and
  timestamps. **Any family member** (Owner or Member) may create/list/get/update/delete/apply; writes
  additionally require a verified email (guard order `FamilyScope → Email`, ACC-01/FAM-01 convention),
  **no `FamilyRoleGuard`** — templates are shared capture aids, not family configuration.
- **Rationale**: The clarify decision fixes templates as a low-sensitivity convenience shared by the
  family; gating them behind Owner-only would add capture friction against Principle VII for no
  isolation benefit (Principle I is already enforced by family scope). `categoryId` is required
  because a template's purpose is to fix the classification; the amount stays optional so the member
  confirms it at capture (FR-006, "aplicar ≠ registrar").
- **Alternatives considered**: Owner-only management and author/Owner-restricted delete (**rejected**
  in clarify — friction, extra ownership logic); optional template category (**rejected** — a
  category-less template defeats its own purpose and complicates the kind==type invariant).

## R3 · Validation — reuse the movement rules (kind, references, name)

- **Decision**: On template create/update, validate exactly as TXN-01 does for a movement, against
  the template's own `type`: the **account** must exist in the family and be active (not archived)
  else `400`; the **category** must be visible (system or family), active, and its `kind` MUST equal
  the template `type` else `400` (Principle III). `name` is trimmed, non-empty (reject whitespace-only,
  per the ACC-01 fix) and **unique within the family** (case-insensitive) else `409`; `amount`, when
  present, is a positive integer. Validation is centralized in `capture-templates.service.ts`,
  reusing the injected `FinancialAccountRepository` and `CategoryRepository`.
- **Rationale**: Templates must never encode an invalid movement, or applying one would push a bad
  draft into TXN-01; matching TXN-01's checks keeps a single source of truth for "what is a valid
  movement". Uniqueness prevents an ambiguous template list (clarify edge case).
- **Alternatives considered**: deferring validation to apply-time only (**rejected** — a template
  should be valid when saved; broken references are still handled at read/apply per R4, but that is
  for *later* deletions, not initial creation); a DB unique index only (kept as a backstop, but the
  service pre-checks to return a clean `409` with an actionable message).

## R4 · Applying a template + broken references — client pre-fill, availability flags

- **Decision**: **No `apply` endpoint.** The client `GET`s the template (or reads it from the list)
  and pre-fills the existing add-movement form; recording still goes through TXN-01's
  `POST /v1/movements`. To satisfy FR-010, every template returned by list/get carries
  `accountAvailable` and `categoryAvailable` booleans, computed with **set-based** existence checks
  (gather the referenced account/category ids across the family's templates, query which are active,
  mark each row) — not one query per template. A template with a missing/archived reference is
  surfaced as needing reselection (flag `false`) rather than failing.
- **Rationale**: Applying is pure pre-fill, so a dedicated endpoint would only re-package the GET
  (Principle V/YAGNI). Availability flags give the client exactly what it needs to prompt reselection
  and keep the capture flow from breaking on later account/category deletion.
- **Alternatives considered**: a `POST /capture-templates/:id/apply` returning a normalized draft
  (**rejected** in clarify — extra surface, no added value at pilot scale); silently dropping broken
  references (**rejected** — the member would not know why a field is empty).

## R5 · No sensitive data in output; contracts & OpenAPI

- **Decision**: Log lines use ids only (`template.created id=… family=…`), never `amount`/`note`,
  reusing the redaction/uniform-error behavior. Shared types live in `packages/contracts/src/capture`
  and the REST surface is documented in `contracts/capture.openapi.yaml`; an OpenAPI-parity e2e (per
  the per-feature convention) asserts the served Swagger matches the committed contract.
- **Rationale**: Principle II (no amount/note leaves the boundary) and Principle VI (documented,
  shared, typed contracts); parity tests have caught drift in every prior slice.

## Resolved Technical Context

| Item | Decision |
|------|----------|
| Capture defaults | Derived on read from the member's latest movement; null-out unusable fields; no collection — R1 |
| Templates | New `movementTemplates` collection + `capture` module; any-member CRUD, writes verified — R2 |
| Validation | Reuse TXN-01 account/category/kind checks; family-unique non-blank name; positive amount — R3 |
| Apply / broken refs | Client pre-fill (no endpoint); `accountAvailable`/`categoryAvailable` flags, set-based — R4 |
| Privacy & contracts | Ids-only logs; `packages/contracts/src/capture` + OpenAPI parity e2e — R5 |
