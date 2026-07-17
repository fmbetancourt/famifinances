# Phase 0 Research: FAM-01 (Family, Owner, Memberships & Secure Join)

**Feature**: Family boundary + membership + secure invite-code join
**Date**: 2026-07-17

Resolves the unknowns for FAM-01, reusing AUTH-01 building blocks wherever possible (Principle V).
Each decision uses a hexagonal repository/port so infrastructure stays swappable (Principle VI).

## R1 · Family-scope enforcement (Principle I — the core)

- **Decision**: Add a **`FamilyScopeGuard`** + **`@CurrentFamily`** decorator. On a family-scoped route,
  the guard reads the authenticated `accountId` (from `JwtStrategy`/`request.user`), looks up the user's
  **active membership**, and attaches `{ familyId, role }` to the request. Handlers get the family only
  via `@CurrentFamily` — never from a path/body/query id. A caller-supplied family identifier is ignored.
- **Rationale**: This is the reusable enforcement point future features (ACC-01, TXN-01, BUD-01) compose
  onto their routes to guarantee cross-family isolation (SC-003). It mirrors AUTH-01's `@CurrentUser`
  (identity from session) one level up (family from session).
- **Alternatives considered**: resolving family from a URL param (rejected — the whole point is to not
  trust caller input); embedding `familyId` in the JWT (rejected — membership changes, e.g. leave/remove,
  must take effect immediately, so read it per request from the authoritative membership, like the
  emailVerified soft gate in AUTH-01).

## R2 · One-family-per-user enforcement

- **Decision**: A **unique index on `memberships.accountId`** (one active membership per account). Create
  and join first check for an existing membership and reject; the unique index is the atomic source of
  truth for the create/join race (a duplicate insert → E11000 → translated to a 409, mirroring AUTH-01's
  register duplicate handling).
- **Rationale**: Enforces DEC-002 deterministically even under concurrency (SC-004).
- **Alternatives considered**: application-only check (not atomic under concurrent create/join). To allow
  re-joining after leaving, leaving **deletes** the membership (rather than a soft `left` status keeping
  the unique row), freeing the account to join another family.

## R3 · Invite codes (high-entropy, hash-indexed single-use tokens)

- **Decision**: A dedicated **`Invitation`** entity + `InvitationService`: a **high-entropy** CSPRNG code
  (`randomBytes(8)` → 64-bit hex), stored only as a **SHA-256** `codeHash`, single-use, short-lived expiry
  (reusing the `OTP_TTL` window), TTL index. The code is keyed by **`familyId` + `issuedBy`** and redeemed
  by a **different** account (the invitee), admitting exactly one person. Redemption is a single atomic
  `findOneAndUpdate({ codeHash, consumedAt: null, expiresAt: { $gt: now } }, { $set: { consumedAt } })`.
- **Rationale**: Unlike a 6-digit OTP (which the account owner types for *their own* record), the invitee
  does **not** know the family the code grants, so redemption must **look the code up by its hash**. An
  argon2id hash is deliberately non-deterministic/slow and therefore **not indexable** for an O(1) lookup;
  a high-entropy code hashed with SHA-256 mirrors the proven **refresh-token** pattern from AUTH-01
  (Principle V) — indexable, irreversible, and brute-force-resistant *because of the code's entropy*, so no
  per-code attempt cap is needed. Satisfies FR-004/FR-005/FR-006 and SC-005.
- **Alternatives considered**: **argon2id 6-digit OTP** (original plan — rejected: not hash-indexable, and
  6 digits need an attempt cap the redeemer-blind lookup can't cleanly enforce); reusing `OneTimeCode`
  directly (semantics clash — redeemer ≠ owner); a reusable family code (rejected in clarification — less
  traceable/secure); magic links (needs deep-linking, rejected for MVP).

## R4 · Roles & owner-only actions

- **Decision**: Store `role` (`owner` | `member`) on the membership. Add a **`FamilyRoleGuard`** +
  `@Roles('owner')` for owner-only endpoints (issue invite, remove member). The family creator is the
  Owner; a family has exactly one Owner (no transfer/deletion in this feature).
- **Rationale**: Simple, testable authorization consistent with the PRD roles; avoids a full RBAC system
  (YAGNI, Principle V).
- **Alternatives considered**: a permissions matrix (overkill for two roles).

## R5 · Membership lifecycle (join / leave / remove)

- **Decision**:
  - **Create**: create Family (ownerId = caller) + Membership(role=owner) for the caller.
  - **Join**: validate the invite code (single-use consume), then create Membership(role=member); the
    unique index guards one-family-per-user.
  - **Leave** (Member only): delete the caller's membership. The **Owner cannot leave** (FR-011) — the
    endpoint rejects an owner leave.
  - **Remove** (Owner only): delete the target member's membership; access is denied on the next request
    because `FamilyScopeGuard` finds no membership. **Family-owned data is untouched** (FR-012) — data
    references `familyId`, not the removed account.
- **Rationale**: Deleting the membership is the simplest way to make access revocation immediate and to
  free the account for a future family (R2). Data belongs to the family, so removal never deletes records.
- **Alternatives considered**: soft-delete membership with a `removed` status (keeps the unique row,
  blocking re-join — rejected).

## R6 · Concurrency & atomicity

- **Decision**: (a) Invite redemption consumes the code **atomically** (conditional update on
  `consumedAt: null`, as in AUTH-01 refresh/OTP); (b) membership creation relies on the **unique index**
  to resolve concurrent create/join races; (c) removing a member and their access is a single membership
  delete (idempotent).
- **Rationale**: No cross-document transactions needed for pilot scale (Principle V); the unique index +
  conditional consume close the realistic races (double redeem, double join) → SC-004/SC-005.
- **Alternatives considered**: MongoDB multi-doc transactions (unnecessary complexity for the pilot).

## R7 · Email-verified prerequisite & mobile UX

- **Decision**: Reuse AUTH-01's **`EmailVerifiedGuard`** on the create-family and join-family endpoints
  (FR-007). Mobile adds three screens: **create family**, **join family** (enter code), **members**
  (list + remove for owner; leave for member), one primary action each, status via text+icon (not color
  alone).
- **Rationale**: FAM-01 is the first real consumer of the AUTH-01 soft gate; the UX honors Principle VII.
- **Alternatives considered**: skipping the verified gate on join (rejected — a family action requires a
  verified identity per the AUTH-01 clarification).

## R8 · Membership audit trail (create / join / remove / leave)

- **Decision**: Record every membership change in an **append-only `MembershipEvent` log** (type
  `created` | `joined` | `removed` | `left`, plus `familyId`, the affected `accountId`, the `actorId`
  who performed it, and a timestamp), written by `FamiliesService` on each change. This is independent of
  the `memberships` row, so **deleting a membership on remove/leave still leaves an audit record**.
- **Rationale**: FR-013 requires that all membership changes be auditable with author + timestamp, but
  R5 deletes the membership on remove/leave (to keep the unique index and allow re-join), which would
  otherwise lose the record. An append-only event log satisfies FR-013 without weakening R2/R5, and
  aligns with the domain "Auditoría" entity (author + creation/deletion dates).
- **Alternatives considered**: soft-deleting the membership with `removedBy`/`removedAt` (rejected —
  keeps the unique `accountId` row, blocking re-join, contradicting R2); no audit at all (rejected —
  violates FR-013 and the domain's basic-traceability requirement).

## Resolved unknowns summary

| Unknown | Resolution |
|---------|------------|
| Family isolation enforcement | FamilyScopeGuard + @CurrentFamily (family from session membership) — R1 |
| One family per user | unique index on membership.accountId; E11000 → 409 — R2 |
| Invite codes | dedicated Invitation entity; high-entropy code, SHA-256 hash-indexed, single-use, expiry — R3 |
| Roles / owner-only | role on membership + FamilyRoleGuard `@Roles('owner')` — R4 |
| Join/leave/remove lifecycle | membership create/delete; owner cannot leave; data stays with family — R5 |
| Concurrency | atomic code consume + unique index; no transactions — R6 |
| Verified gate + mobile UX | reuse EmailVerifiedGuard; 3 accessible screens — R7 |
| Audit of membership changes | append-only MembershipEvent log (author + timestamp) — R8 |

All Technical Context unknowns are resolved. No `NEEDS CLARIFICATION` remains.
