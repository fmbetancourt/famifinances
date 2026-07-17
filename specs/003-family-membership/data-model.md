# Phase 1 Data Model: FAM-01 (Family, Owner, Memberships & Secure Join)

**Feature**: Family boundary + membership + secure invite-code join
**Date**: 2026-07-17
**Store**: MongoDB via Mongoose. Collections: `families`, `memberships`, `invitations`.

All timestamps UTC. Secrets (invite codes) persist only as hashes and are never logged. There are no
monetary fields in this feature — those arrive with ACC-01/TXN-01, owned by the family defined here.

## Entity: Family (`families`)

The privacy boundary and owner of all financial data. Exactly one Owner; one or more members.

| Field | Type | Rules |
|-------|------|-------|
| `_id` | ObjectId | Family id (the `familyId` all financial entities will reference). |
| `name` | string | Required, trimmed, 1–80 chars. |
| `ownerId` | ObjectId (ref Account) | The Owner's account. Exactly one owner per family. |
| `createdAt` / `updatedAt` | Date | Mongoose timestamps. |

**Rules**: created by an authenticated, email-verified user (FR-001, FR-007); the creator's membership is
`owner`. Ownership does not transfer and the family is not deleted in this feature.

## Entity: Membership (`memberships`)

Links one account to one family with a role. The **one-family-per-user** invariant lives here.

| Field | Type | Rules |
|-------|------|-------|
| `_id` | ObjectId | Primary key. |
| `accountId` | ObjectId (ref Account) | **UNIQUE index** → an account has at most one membership (DEC-002). |
| `familyId` | ObjectId (ref Family) | The family this membership belongs to. Indexed. |
| `role` | enum `owner` \| `member` | Owner manages members/config; Member uses shared data. |
| `createdAt` (joinedAt) | Date | When the membership was created. |

**Indexes**: unique on `accountId`; index on `familyId` (list members).

**State transitions / rules**:
- Create family → insert Membership(accountId=caller, role=`owner`).
- Join family → insert Membership(accountId=caller, role=`member`) after consuming an invite (FR-006).
- Leave (Member) / Remove (Owner) → **delete** the membership; access is denied on the next request and
  the account is free to join another family (FR-010, FR-011, R2/R5).
- The **Owner's membership cannot be deleted** (owner cannot leave / be removed) (FR-011).
- The unique index makes a concurrent second create/join fail atomically → non-committal 409 (SC-004).

## Entity: Invitation (`invitations`)

A secure, single-use, time-limited invite code to join one family, admitting exactly one person.

| Field | Type | Rules |
|-------|------|-------|
| `_id` | ObjectId | Primary key. |
| `familyId` | ObjectId (ref Family) | The family the code grants access to. Indexed. |
| `issuedBy` | ObjectId (ref Account) | The Owner who issued it. |
| `codeHash` | string | SHA-256 hash of a high-entropy CSPRNG code (`randomBytes(8)` → 64-bit hex); never store/log the plaintext. Indexed for O(1) redeemer-blind lookup. |
| `expiresAt` | Date | Short-lived (reuses `OTP_TTL`); TTL index removes expired codes. |
| `consumedAt` | Date \| null | Set atomically on successful redemption (single-use). |
| `createdAt` | Date | Issue time. |

**Indexes**: `familyId`; `codeHash` (redemption lookup); TTL on `expiresAt`.

**Rules**: issued only by the family's Owner (FR-004). The invitee does not know which family a code grants,
so redemption looks the code up **by its hash** and **atomically** sets `consumedAt` in one
`findOneAndUpdate` (single-use) before creating the joiner's membership (FR-005, R6). The code's 64-bit
entropy is the brute-force defense, so no per-code attempt cap is needed (cf. the AUTH-01 refresh-token
pattern). Only the family's Owner may issue codes.

## Entity: MembershipEvent (`membershipEvents`)

An append-only audit record of a membership change, independent of the (deletable) membership row, so
remove/leave remain auditable (FR-013, R8).

| Field | Type | Rules |
|-------|------|-------|
| `_id` | ObjectId | Primary key. |
| `familyId` | ObjectId (ref Family) | The family involved. Indexed. |
| `accountId` | ObjectId (ref Account) | The account whose membership changed. |
| `actorId` | ObjectId (ref Account) | Who performed the change (self for create/join/leave; the Owner for a remove). |
| `type` | enum `created` \| `joined` \| `removed` \| `left` | The change. |
| `createdAt` | Date | When it happened (the audit timestamp). |

**Rules**: written by `FamiliesService` on every membership change; never updated or deleted (append-only).

## Relationships

```text
Account (1) ──< (1) Membership >── (1) Family        # unique membership per account
Family  (1) ──< (N) Membership
Family  (1) ──< (N) Invitation       (issued by the Owner)
Family  (1) ──< (N) MembershipEvent  (append-only audit)
```

## Enforced invariants (the Principle I gate)

- **Family from session, never from input**: `FamilyScopeGuard` resolves `familyId` from the caller's
  membership (looked up by the session `accountId`); a family id in the path/body/query is ignored
  (FR-008, SC-003). Family-scoped routes read it via `@CurrentFamily`.
- **One family per user**: guaranteed by the unique `accountId` index (SC-004).
- **Immediate revocation**: because the family is resolved per request from the membership, deleting a
  membership denies access on the very next request (SC-006), with no token/claim staleness.
- **Family owns data**: future financial documents (ACC-01/TXN-01/BUD-01) reference `familyId`, not the
  individual, so removing a member never deletes family data. This is a **structural invariant**; FAM-01
  itself creates no financial data, so FR-012/SC-007 are fully exercised only once those features exist —
  FAM-01 guarantees that remove/leave delete only the membership row (nothing family-referenced).
- **Membership changes are auditable**: every create/join/remove/leave appends a `MembershipEvent`
  (author + timestamp), so the record survives the membership row's deletion (FR-013, R8).
- **No plaintext invite codes** are stored or logged; codes are hashed and single-use (FR-005).
