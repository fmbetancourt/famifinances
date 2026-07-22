# Research: Offline Capture — Idempotent Writes (OFF-01)

**Feature**: OFF-01 · Cola local para conexión intermitente
**Date**: 2026-07-21

All open decisions were closed in `/speckit-specify` + `/speckit-clarify` (Session 2026-07-21):
backend-only scope; idempotency on movement + transfer creates; retention configurable, 7-day default;
key via the `Idempotency-Key` header; replay returns the original response as-is. This document records
the resulting technical decisions.

## R1 · A per-request dedup layer — not sync (the scope call)

- **Decision**: Implement idempotency as a **stateless-per-request dedup** keyed by a client-supplied
  `Idempotency-Key`, applied to the two capture creates. Deliver **only** this backend layer; the
  on-device queue, offline storage, connectivity detection and replay orchestration are **deferred to
  the mobile track** (the bulk of the Could item).
- **Rationale**: An offline queue that retries writes only needs the server to be **safe to retry** —
  i.e. idempotent creates. That is a small, well-understood mechanism, unlike live sync. Building a
  push/sync channel (WebSockets, CRDTs, a server queue) would introduce infrastructure the
  constitution forbids without a measured need (Principle V). Idempotency is the minimal, honest
  enablement and keeps the server stateless about connectivity.
- **Alternatives considered**: server-side sync/replication or a message queue (**rejected** — new
  infra, distributed semantics, far beyond a Could item); server-generated dedup token returned then
  echoed (**rejected** — a round-trip the offline client can't complete before it's already offline;
  a client-generated key works offline-first); no idempotency, rely on the client to dedup
  (**rejected** — a lost response makes the client unable to know if the write landed → duplicates).

## R2 · Key transport, scope, and the replay response

- **Decision**: The key travels in the **`Idempotency-Key` HTTP header** (IETF draft / Stripe
  convention). It is scoped to `(familyId, ownerId)` from the session — a **unique index** enforces
  one record per member+key. A replay (same key, same fingerprint, same operation) returns the
  **original response as-is** (the create's `201` + the resource), with an optional
  `Idempotent-Replayed: true` response header for observability. A request **without** the header is
  unchanged (FR-005). A present key is validated (non-empty, ≤ 200 chars) else `400`.
- **Rationale**: A header keeps the mechanism orthogonal to each endpoint's body — no DTO change, no
  drift, one shared integration for both creates, full backward compatibility (clarify Q). Returning
  the original response makes idempotency **transparent**: the client cannot tell a replay from a
  first hit, which is the goal; the optional header aids debugging without changing the contract.
- **Alternatives considered**: key in the body (**rejected** in clarify — touches every DTO, mixes
  concerns); `200`-on-replay vs `201`-on-create (**rejected** in clarify — leaks dedup into the
  status code, complicates the contract/tests); global key uniqueness across members (**rejected** —
  would leak/collide across families; scope to family+member).

## R3 · Fingerprint + concurrency (exactly-once under retries)

- **Decision**: The record stores a **SHA-256 fingerprint** of the request (canonical JSON of the
  create payload, key-order independent) plus the created **resource id** — **never the cleartext
  amount/note** (Principle II; matches the Key Entity). Concurrency is handled **reserve-first**:
  insert a `pending` record under the unique `(familyId, ownerId, key)` index **before** running the
  create; the winner runs the create and marks the record `completed` with the resource id; a
  concurrent loser (duplicate-key insert fails) reads the record and **replays** once `completed`, or
  returns `409` while still `pending`. Same key + **different** fingerprint (or a different operation)
  → `409` (FR-008). On a create failure the reservation is **released** so the key is not consumed.
- **Rationale**: Reserve-first with a DB unique index is the standard way to get exactly-once without a
  lock service: only one insert wins, so only one create runs (FR-007). The hashed fingerprint detects
  key reuse with different content without storing sensitive data. Releasing on failure lets a
  corrected retry proceed (idempotency is about successful creates).
- **Alternatives considered**: run-then-dedup (**rejected** — a race creates two resources before the
  second insert fails); storing the full response snapshot (**rejected** — would hold cleartext
  amount/note, contra Principle II and the Key Entity; re-fetching by id is clean); an in-memory lock
  (**rejected** — not durable, single-process only).

## R4 · Retention via a TTL index; privacy & contract

- **Decision**: Records auto-purge via a Mongo **TTL index** on `createdAt` with
  `expireAfterSeconds = IDEMPOTENCY_TTL_DAYS × 86400` (env, **default 7**). Logs during idempotency
  handling carry the key/operation/ids only — never amounts/notes (FR-009). The mechanism is documented
  in OpenAPI (the `Idempotency-Key` header + `409` on both creates) and in `contracts/idempotency.md`;
  the affected create contracts (TXN-01/02) gain the header, not a new endpoint.
- **Rationale**: A TTL index is zero-maintenance purge (no cron), covering realistic offline windows;
  configurability lets ops tune it. Documenting the header keeps client/server aligned (Principle VI).
- **Alternatives considered**: a scheduled purge job (**rejected** — needs a scheduler; the TTL index
  is built in); keeping records forever (**rejected** — unbounded growth for no benefit past the
  offline window).

## Resolved Technical Context

| Item | Decision |
|------|----------|
| Mechanism | Per-request dedup via `Idempotency-Key`; not sync — R1 |
| Transport/scope/replay | Header; unique `(familyId, ownerId, key)`; replay returns original `201` + resource — R2 |
| Fingerprint/concurrency | SHA-256 of canonical payload; reserve-first unique insert; mismatch → 409 — R3 |
| Retention/privacy/contract | TTL index, `IDEMPOTENCY_TTL_DAYS` default 7; hashed record; OpenAPI header — R4 |
