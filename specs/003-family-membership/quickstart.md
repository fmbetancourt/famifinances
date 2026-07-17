# Quickstart & Validation: FAM-01 (Family, Owner, Memberships & Secure Join)

**Feature**: Family boundary + membership + secure invite-code join
**Date**: 2026-07-17

Proves FAM-01 end-to-end. References [data-model.md](./data-model.md) and
[contracts/family.openapi.yaml](./contracts/family.openapi.yaml). Validation/run guide only —
implementation belongs in `tasks.md`.

## Prerequisites

- The AUTH-01 API running (auth, sessions, email verification) with an in-memory or dev Mongo.
- Test accounts must be **email-verified** to create/join (AUTH-01 soft gate). E2E tests obtain the
  verification code via the test `MailPort` collector (as in AUTH-01).

## Automated validation (authoritative)

```bash
pnpm --filter @famifinances/api test        # unit
pnpm --filter @famifinances/api test:e2e    # integration/e2e (mongodb-memory-server)
```

Required passing checks (map to spec):

- **US1 Create family**: a verified user with no family → `POST /families` → `201`, caller is Owner
  (`role: owner`); a user who already has a family → `409`; an unverified user → `403` (soft gate).
- **US2 Join**: Owner `POST /families/me/invites` → single-use code; a verified user with no family
  `POST /families/join` with the code → `200`, `role: member`; reused/expired code → `400`; a user who
  already has a family → `409`.
- **US3 Isolation (SC-003, Principle I)**: two members of family A see the same `GET /families/me`; a
  member of family B is rejected from family A's data; supplying a foreign `familyId`/`accountId` in the
  request is ignored — the family comes from the session membership (authorization e2e).
- **US4 Manage members**: Owner `GET /families/me` lists members; Owner `DELETE
  /families/me/members/{accountId}` → `204`; the removed member's next request → rejected (SC-006);
  removing a non-owner works, removing the Owner → `403`.
- **US5 One family per user (SC-004)**: create/join a second family → `409` (unique membership index);
  after `POST /families/me/leave`, the account can join another family; Owner leave → `403`.
- **Privacy**: invite codes never appear in logs; codes are single-use and hashed (SC-005).

## Manual smoke walkthrough (optional)

Using Swagger UI (`/api/docs`) or the mobile app, with two verified accounts A (owner) and B (invitee):

1. A `POST /families` `{ "name": "Familia Demo" }` → `201`, role `owner`.
2. A `POST /families/me/invites` → note the returned `code`.
3. B `POST /families/join` `{ "code": "<code>" }` → `200`, role `member`.
4. A and B each `GET /families/me` → both see the same family + both members.
5. B `GET /families/me` while passing a foreign `familyId` in the body → still returns B's own family
   (identifier ignored).
6. A `DELETE /families/me/members/{B.accountId}` → `204`; B `GET /families/me` → `404` (no family).
7. B `POST /families/join` with a fresh code → `200` (re-joins); A cannot `POST /families/me/leave`
   (owner) → `403`.

## Expected outcome

All automated suites pass; a family scopes its data via the session membership; cross-family access and
duplicate-family attempts are rejected; invite codes are single-use, time-limited, and hashed. At that
point FAM-01 satisfies its Success Criteria and provides the `@CurrentFamily`/`FamilyScopeGuard` boundary
that ACC-01, TXN-01, and BUD-01 build on.
