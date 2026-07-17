---

description: "Task list for FAM-01 · Family, Owner, Memberships & Secure Join"
---

# Tasks: Family, Owner, Memberships & Secure Join (FAM-01)

**Input**: Design documents from `/specs/003-family-membership/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/family.openapi.yaml, quickstart.md

**Tests**: INCLUDED (constitution Principle IV · Test-First). Mandatory coverage: cross-family isolation
(family from session, foreign id ignored), one-family-per-user, invite reuse/expiry, owner-cannot-leave.
Test tasks are written FIRST and must FAIL before implementation.

**Organization**: Grouped by user story (US1–US5). Builds on AUTH-01 (`JwtAuthGuard`, `@CurrentUser`,
`EmailVerifiedGuard`, the OTP security pattern) — reused, not rebuilt.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on an incomplete task.
- **[Story]**: US1–US5 from spec.md.

---

## Phase 1: Setup (Shared Contracts)

- [X] T001 [P] Add family DTO types (`FamilySummary`, `MemberSummary`, `FamilyDetail`, `CreateFamilyRequest`, `JoinFamilyRequest`, `InviteCodeResponse`, error bodies) in `packages/contracts/src/family/index.ts` and re-export from `packages/contracts/src/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Entities + the family-scope enforcement every story depends on

**⚠️ CRITICAL**: No user story work begins until this phase is complete

- [X] T002 [P] Create `Family` Mongoose schema (name, ownerId, timestamps) + `FamilyRepository` in `apps/api/src/families/family.schema.ts`
- [X] T003 [P] Create `Membership` schema with a **UNIQUE index on `accountId`** (one family per user), plus `familyId`, `role`, timestamps, and `MembershipRepository` (create, findByAccount, findByFamily, deleteByAccount) in `apps/api/src/memberships/membership.schema.ts`
- [X] T003b [P] Create the append-only `MembershipEvent` audit schema (familyId, accountId, actorId, type `created|joined|removed|left`, timestamp) + `MembershipEventRepository` (append, listByFamily) in `apps/api/src/memberships/membership-event.schema.ts` (FR-013, R8)
- [X] T004 Wire `FamiliesModule` and `MembershipsModule` (`MongooseModule.forFeature` for Membership + MembershipEvent, exporting both repositories) in `apps/api/src/families/families.module.ts` and `apps/api/src/memberships/memberships.module.ts`
- [X] T005 Implement `@CurrentFamily` decorator + `FamilyScopeGuard` (resolves `{ familyId, role }` from the caller's membership via the session `accountId`; ignores any caller-supplied family id) in `apps/api/src/families/guards/family-scope.guard.ts` and `apps/api/src/families/decorators/current-family.decorator.ts`
- [X] T006 [P] Implement `FamilyRoleGuard` + `@Roles('owner')` decorator (owner-only enforcement) in `apps/api/src/families/guards/family-role.guard.ts` and `apps/api/src/families/decorators/roles.decorator.ts`

**Checkpoint**: Entities exist; the Principle I enforcement point (`@CurrentFamily`/`FamilyScopeGuard`) and role guard are available.

---

## Phase 3: User Story 1 - Create a family and become Owner (Priority: P1) 🎯 MVP

**Goal**: A verified user with no family creates one and becomes its Owner.

**Independent Test**: verified user with no family → create → 201, role owner; already-in-family → 409; unverified → 403.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T007 [P] [US1] e2e for `POST /families` (201 owner; unverified → 403; already-in-family → 409) in `apps/api/test/create-family.e2e-spec.ts`

### Implementation for User Story 1

- [X] T008 [P] [US1] Create `CreateFamilyDto` (name 1–80) in `apps/api/src/families/dto/create-family.dto.ts`
- [X] T009 [US1] Implement `FamiliesService.createFamily` (reject if caller already has a membership; create Family with ownerId=caller + owner Membership; **append a `created` MembershipEvent**; translate E11000 → non-committal 409) in `apps/api/src/families/families.service.ts`
- [X] T010 [US1] Implement `POST /families` guarded by `JwtAuthGuard` + `EmailVerifiedGuard` in `apps/api/src/families/families.controller.ts`
- [ ] T011 [P] [US1] Mobile create-family screen (name, one primary action) in `apps/mobile/app/(family)/create-family.tsx`

**Checkpoint**: A verified user can create a family and is its Owner.

---

## Phase 4: User Story 2 - Join a family through a secure invitation (Priority: P1)

**Goal**: Owner issues a single-use code; an invitee redeems it to become a Member.

**Independent Test**: owner issues code → invitee joins (200 member); reused/expired code → 400; already-in-family → 409.

### Tests for User Story 2 ⚠️ (write first, must fail)

- [X] T012 [P] [US2] e2e for issue+join: owner issues code, invitee joins (200 member); reused/expired → 400; already-in-family → 409; non-owner issue → 403 in `apps/api/test/join-family.e2e-spec.ts`
- [X] T013 [P] [US2] Unit for `InvitationService` (issue → high-entropy code persisted only as its SHA-256 hash; redeem validates single-use/expiry via the atomic lookup) in `apps/api/src/invitations/invitation.service.spec.ts`

### Implementation for User Story 2

- [X] T014 [P] [US2] Create `Invitation` schema (familyId, issuedBy, indexed `codeHash`, expiresAt TTL, consumedAt) in `apps/api/src/invitations/invitation.schema.ts`
- [X] T015 [US2] Implement `InvitationService` (high-entropy CSPRNG code, SHA-256 hash, expiry, **atomic consume** via `findOneAndUpdate` on `consumedAt: null`) reusing the AUTH-01 refresh-token pattern, in `apps/api/src/invitations/invitation.service.ts`
- [X] T016 [US2] Wire `InvitationsModule` in `apps/api/src/invitations/invitations.module.ts`
- [X] T017 [US2] Implement `POST /families/me/invites` (owner-only via `FamilyRoleGuard`) returning the one-time code in `apps/api/src/families/families.controller.ts`
- [X] T018 [US2] Implement `JoinFamilyDto` + `POST /families/join` (`EmailVerifiedGuard`; reject if already in a family; consume code → create member Membership; **append a `joined` MembershipEvent**; E11000 → 409) in `apps/api/src/families/families.service.ts` and controller
- [ ] T019 [P] [US2] Mobile join-family screen (enter invite code) in `apps/mobile/app/(family)/join-family.tsx`

**Checkpoint**: Register + create + invite + join work end to end.

---

## Phase 5: User Story 3 - Shared visibility + cross-family isolation (Priority: P1)

**Goal**: Members of a family see the same data; other families are denied; family comes from the session.

**Independent Test**: two members of A see the same family; a member of B is denied A's data; a foreign `familyId` in the request is ignored.

### Tests for User Story 3 ⚠️ (write first, must fail)

- [X] T020 [P] [US3] Authorization e2e: family resolved from the session membership; a foreign `familyId`/`accountId` in the request is ignored; a member of family B is rejected from family A's data (FR-008, SC-003) in `apps/api/test/family-isolation.e2e-spec.ts`

### Implementation for User Story 3

- [X] T021 [US3] Implement `GET /families/me` (via `FamilyScopeGuard` + `@CurrentFamily`) returning `FamilyDetail` (family + members) in `apps/api/src/families/families.controller.ts`
- [ ] T022 [P] [US3] Mobile family home/context showing the current family + members via the session in `apps/mobile/src/features/family/`

**Checkpoint**: Family scoping + isolation verified — the gate future features build on.

---

## Phase 6: User Story 4 - Owner manages the family's members (Priority: P2)

**Goal**: Owner views members and removes a Member; removal is immediate; family data stays.

**Independent Test**: owner removes a member → 204; the removed member's next request is denied; removing the Owner → 403; a non-owner removing → 403.

### Tests for User Story 4 ⚠️ (write first, must fail)

- [X] T023 [P] [US4] e2e for `DELETE /families/me/members/{accountId}` (204; removed member denied next request; remove owner → 403; non-owner → 403) in `apps/api/test/manage-members.e2e-spec.ts`

### Implementation for User Story 4

- [X] T024 [US4] Implement `DELETE /families/me/members/{accountId}` (owner-only; refuse to remove the Owner; delete the target membership within the caller's family; **append a `removed` MembershipEvent** with actor = the Owner) in `apps/api/src/families/families.service.ts` and controller
- [ ] T025 [P] [US4] Mobile members screen (list; remove action for the Owner) in `apps/mobile/app/(family)/members.tsx`

**Checkpoint**: Owner can manage membership; removal revokes access immediately.

---

## Phase 7: User Story 5 - One family per user (Priority: P2)

**Goal**: A user belongs to at most one family; a Member may leave (then join another); the Owner may not leave.

**Independent Test**: second create/join → 409; after leave, the account can join another; owner leave → 403.

### Tests for User Story 5 ⚠️ (write first, must fail)

- [X] T026 [P] [US5] e2e: a user already in a family creating/joining a second → 409; after `POST /families/me/leave` the account can join another; owner leave → 403 in `apps/api/test/one-family-per-user.e2e-spec.ts`

### Implementation for User Story 5

- [X] T027 [US5] Implement `POST /families/me/leave` (Member deletes own membership; **append a `left` MembershipEvent**; Owner → 403) in `apps/api/src/families/families.service.ts` and controller
- [ ] T028 [P] [US5] Mobile leave-family action in `apps/mobile/src/features/family/hooks/use-leave-family.ts`

**Checkpoint**: One-family-per-user enforced everywhere; leave frees the account.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T029 [P] No-secrets-in-logs test: invite codes never appear in logs across issue/join (FR-005) in `apps/api/test/family-log-privacy.e2e-spec.ts`
- [X] T030 [P] OpenAPI parity check: generated document matches `specs/003-family-membership/contracts/family.openapi.yaml` in `apps/api/test/family-openapi-parity.e2e-spec.ts`
- [X] T031 [P] Document `@CurrentFamily`/`FamilyScopeGuard` as the reusable Principle-I enforcement point for ACC-01/TXN-01/BUD-01 in `apps/api/README.md`
- [X] T032 Execute `specs/003-family-membership/quickstart.md` end-to-end and record results, including the SC-001 (create < 1 min) / SC-002 (join < 2 min) timing observations
- [X] T033 [P] Verify `packages/contracts` family types compile against the API (no `any`) via `pnpm typecheck`
- [X] T034 [P] Audit e2e: each membership change (create, join, remove, leave) appends a `MembershipEvent` with author + timestamp, and the record survives the membership deletion (FR-013) in `apps/api/test/membership-audit.e2e-spec.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: contracts types — no dependencies.
- **Foundational (Phase 2)**: entities + `FamilyScopeGuard`/`FamilyRoleGuard` — BLOCKS all user stories.
- **User Stories (Phase 3–7)**: depend on Foundational.
  - US1 (P1): independent (create + owner membership).
  - US2 (P1): depends on US1 (a family + owner must exist to issue/redeem) + Invitation entity.
  - US3 (P1): depends on the `FamilyScopeGuard` (Foundational) + at least one family (US1); verifies isolation.
  - US4 (P2): depends on US1/US2 (a family with members).
  - US5 (P2): depends on US1/US2 (membership) — enforced by the unique index (Foundational).
- **Polish (Phase 8)**: after the stories.

### Within Each User Story

- Tests are written and MUST FAIL before implementation.
- Schemas/repos before services; services before endpoints; core before mobile.

### Parallel Opportunities

- Foundational: T002, T003, T006 in parallel (T004 after T002/T003; T005 after T003).
- Within a story, `[P]` tests run together, and `[P]` DTOs/schemas run before their service.
- Mobile screens (`[P]`) can proceed alongside their story's API once the contract is fixed.

---

## Implementation Strategy

### MVP scope

- **Minimal deployable slice**: Foundational + **US1** (a user can create a family).
- **Recommended demo MVP**: through **US3** (create + invite/join + isolation) — the full P1 set and the
  Principle I boundary that unlocks ACC-01/TXN-01.

### Incremental delivery

1. Setup + Foundational → entities + family-scope gate ready.
2. US1 → US2 → US3 (P1 core) → validate/demo.
3. US4 (manage members) → US5 (one-family-per-user + leave).
4. Polish: log-privacy, OpenAPI parity, docs, quickstart.

---

## Notes

- Reuses AUTH-01: `JwtAuthGuard`, `@CurrentUser`, `EmailVerifiedGuard`, and the OTP security pattern for
  invite codes; E11000→409 duplicate handling from register.
- Constitution gates covered: family-from-session isolation (T020), one-family-per-user (T026), invite
  reuse/expiry (T012/T013), membership audit trail (T034), no-secrets-in-logs (T029), OpenAPI contract
  (T030), shared typed contracts (T033).
- Verify each test fails before implementing; commit after each task or logical group (conventional commits).

---

## Phase 9: Convergence

> Appended by `/speckit-converge`. The API implementation fully satisfies the spec and tasks
> (14 FR + 7 SC, verified by 25 e2e suites / 55 tests). These items only realign the lagging
> `plan.md` with the invite-code decision that was already reconciled in `research.md`,
> `data-model.md`, and this file. The deferred mobile screens remain tracked as T011/T019/T022/T025/T028.

- [X] T035 Reconcile `plan.md` (Summary, Technical Context, Constitution Check II, Project Structure) with the shipped invite-code design — high-entropy CSPRNG + **SHA-256** hash, single-use, no per-code attempt cap — and the membership lifecycle (leaving **deletes** the row; there is no soft `status` field, and `Invitation` has no `attempts`), per research R3/R5 and data-model.md (contradicts)
- [X] T036 Reconcile `plan.md` Project Structure paths for `FamilyScopeGuard`, `FamilyRoleGuard`, and `@CurrentFamily` from `apps/api/src/auth/…` to their shipped location under `apps/api/src/families/guards` and `apps/api/src/families/decorators` (matching tasks T005/T006) (contradicts)
