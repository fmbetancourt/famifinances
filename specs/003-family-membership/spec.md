# Feature Specification: Family, Owner, Memberships & Secure Join (FAM-01)

**Feature Branch**: `003-family-membership`

**Created**: 2026-07-17

**Status**: Draft

**Input**: User description: "FAM-01 — Familia, owner, membresías y unión segura. Límite de privacidad familiar."

## Clarifications

### Session 2026-07-17

- Q: What mechanism is used to invite/join a family? → A: A single-use invite code the Owner generates and shares; the invitee enters it in the app. It reuses the AUTH-01 OTP infrastructure (CSPRNG, hashed at rest, expiry, single-use) — no email-delivery or deep-linking dependency.
- Q: Does an invitation admit one person or is it a reusable family code? → A: One code per person — each invite code admits exactly one person and is consumed on join (single-use, time-limited).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a family and become its Owner (Priority: P1)

An authenticated person who does not yet belong to a family creates one and automatically becomes its
Owner, establishing the private space where the family's finances will live.

**Why this priority**: The family is the privacy boundary and the owner of all financial data; nothing
else in the product (accounts, movements, budgets) can exist until a family exists.

**Independent Test**: A signed-in, email-verified user with no family creates a family and is confirmed
as its Owner; the family now exists and is theirs.

**Acceptance Scenarios**:

1. **Given** an authenticated, email-verified user with no family, **When** they create a family with a
   name, **Then** the family is created and the user is assigned the Owner role.
2. **Given** a user who already belongs to a family, **When** they try to create another, **Then** the
   request is rejected (one family per user).
3. **Given** an authenticated user whose email is not verified, **When** they try to create a family,
   **Then** the action is blocked pending email verification.

---

### User Story 2 - Join a family through a secure invitation (Priority: P1)

An Owner invites another person to their family; that person joins that family — and only that one —
through a secure mechanism, gaining access to the shared financial space.

**Why this priority**: A family is collaborative by definition; without a secure way to add members,
the family is single-person and the core value (shared visibility) is unrealized.

**Independent Test**: An Owner issues an invitation; an invited person redeems it and becomes a Member
of exactly that family; an invalid/expired invitation is rejected.

**Acceptance Scenarios**:

1. **Given** an Owner, **When** they issue an invitation, **Then** a secure, single-use, time-limited
   invitation is produced that admits one person to that specific family.
2. **Given** a valid invitation and an authenticated, email-verified user with no family, **When** they
   redeem it, **Then** they become a Member of that family and of no other.
3. **Given** an invitation that has already been used or has expired, **When** someone tries to redeem
   it, **Then** the join is rejected.
4. **Given** a user who already belongs to a family, **When** they try to redeem an invitation, **Then**
   the join is rejected (one family per user).

---

### User Story 3 - Shared visibility within a family, isolation across families (Priority: P1)

Members of the same family see the same shared financial information; no member of one family can ever
read or modify another family's data.

**Why this priority**: Cross-family isolation is the constitution's non-negotiable Principle I and the
single most damaging failure mode for a shared-finance product.

**Independent Test**: Two members of family A see the same family data; a member of family B is denied
access to family A's data in 100% of attempts.

**Acceptance Scenarios**:

1. **Given** two Members of the same family, **When** each requests the family's shared information,
   **Then** both see the same data.
2. **Given** a Member of family B, **When** they attempt to read or modify family A's data, **Then** the
   request is rejected as unauthorized.
3. **Given** any family-scoped request, **When** it is processed, **Then** the family is derived from the
   authenticated session, never from an identifier supplied by the caller.

---

### User Story 4 - Owner manages the family's members (Priority: P2)

An Owner can see who is in the family and remove a Member; a removed Member immediately loses access,
while the data the family accumulated stays with the family.

**Why this priority**: Families change (a member leaves the household); the Owner needs control over
membership, but the product is demonstrable with just create + join, so this ranks below them.

**Independent Test**: An Owner views the member list and removes a Member; that Member can no longer
access the family, and the family's data is unchanged.

**Acceptance Scenarios**:

1. **Given** an Owner, **When** they view the family, **Then** they see the current list of members and
   their roles.
2. **Given** an Owner and a Member, **When** the Owner removes the Member, **Then** the Member loses
   access to the family's data immediately.
3. **Given** a removed Member, **When** they later request the family's data, **Then** the request is
   rejected.
4. **Given** a Member is removed, **When** the removal completes, **Then** only their membership is
   deleted; any family-owned data (added by later features) is untouched because it references the
   family, not the member. *(FAM-01 creates no financial data yet, so this is a structural guarantee
   fully exercised in ACC-01/TXN-01.)*

---

### User Story 5 - One family per user (Priority: P2)

Each user belongs to at most one family at a time; a person can only be part of another family after
leaving their current one.

**Why this priority**: The one-family-per-user rule (product decision DEC-002) keeps privacy, support,
and the initial experience simple; it must be enforced everywhere membership changes.

**Independent Test**: A user in a family is prevented from creating or joining a second; after leaving,
they can join another.

**Acceptance Scenarios**:

1. **Given** a user who is a Member of a family, **When** they leave the family, **Then** they no longer
   belong to any family and may create or join another.
2. **Given** a user who already belongs to a family, **When** they attempt to create or join a second,
   **Then** it is rejected.

---

### Edge Cases

- What happens when a user with no family attempts a family/financial action? It is blocked with a
  prompt to create or join a family (and, per AUTH-01, requires a verified email first).
- What happens when two people try to redeem the same single-use invitation? Only the first succeeds;
  the second is rejected as already used.
- What happens when the Owner tries to remove themselves or leave? It is prevented — a family always has
  exactly one Owner; ownership transfer and family deletion are out of scope for this feature.
- What happens to invitations when the Owner removes a member or the invite expires? Pending invitations
  remain single-use and time-limited; expiry/consumption invalidates them.
- How does the system behave if a caller supplies another family's identifier? The identifier is ignored;
  the family is taken from the authenticated session (Principle I).
- What happens when a removed member is re-invited? They may redeem a new invitation and rejoin, subject
  to the one-family-per-user rule.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: An authenticated user MUST be able to create a family with a name; the creator is assigned
  the Owner role.
- **FR-002**: A user MUST belong to at most one family at a time; creating or joining is rejected if the
  user already belongs to a family.
- **FR-003**: The system MUST support two family roles: Owner (manages members and family configuration)
  and Member (uses the shared family data).
- **FR-004**: An Owner MUST be able to issue a single-use invite code that admits exactly one person to
  that family.
- **FR-005**: An invite code MUST be single-use and time-limited, stored non-recoverably (hashed); an
  expired or already-consumed code MUST be rejected.
- **FR-006**: A user MUST be able to join a family by entering a valid invite code in the app, after
  which they belong only to that family.
- **FR-007**: Creating or joining a family MUST require the user's email to be verified (the AUTH-01 soft
  gate); unverified users MUST be blocked from these actions.
- **FR-008**: Every access to family-scoped data MUST be authorized against the family derived from the
  authenticated session, and requests for another family's data MUST be rejected.
- **FR-009**: All Members of the same family MUST see the same shared family information.
- **FR-010**: An Owner MUST be able to view the family's members and remove a Member; a removed Member
  MUST immediately lose access to the family's data.
- **FR-011**: A Member MUST be able to leave the family, after which they belong to no family; the Owner
  MUST NOT be able to leave or be removed (a family always retains exactly one Owner).
- **FR-012**: Removing or leaving MUST delete only the membership; family-owned data MUST remain with the
  family (data references the family, not the individual). This is a **structural invariant** — FAM-01
  creates no financial data, so it is fully exercised once ACC-01/TXN-01 add family-referenced entities;
  FAM-01 MUST NOT cascade any deletion beyond the membership.
- **FR-013**: Every membership change (create, join, remove, leave) MUST be recorded in an append-only
  audit log with its author and timestamp — the record MUST survive the membership row's deletion.
- **FR-014**: All family and membership inputs MUST be validated on the server side.

### Key Entities *(include if feature involves data)*

- **Family**: The privacy boundary and owner of all financial data. Key attributes: name, the owning
  account, creation timestamp. A family has exactly one Owner and one or more members.
- **Membership**: The relationship between a user and a family, carrying a role (Owner or Member) and
  status. A user has at most one active membership. Key attributes: account reference, family reference,
  role, joined timestamp.
- **Invitation**: A secure, single-use, time-limited invite code to join a specific family, issued by the
  Owner and admitting exactly one person. Key attributes: family reference, issuer, code hash (stored
  non-recoverably), expiry, consumed state.
- **Membership Event**: An append-only audit record of a membership change (created, joined, removed,
  left). Key attributes: family reference, affected account, actor (who did it), change type, timestamp.
  It is never updated or deleted, so remove/leave remain auditable after the membership row is gone.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An authenticated, verified user can create a family and be confirmed as Owner in under 1
  minute.
- **SC-002**: An invited person can join the correct family via a valid invitation in under 2 minutes,
  with a ~100% success rate for valid invitations.
- **SC-003**: 100% of attempts to read or modify another family's data are rejected, verified by
  cross-family authorization tests.
- **SC-004**: 100% of attempts by a user who already belongs to a family to create or join a second are
  rejected.
- **SC-005**: 100% of attempts to redeem an expired or already-used invitation are rejected.
- **SC-006**: After a Member is removed, 100% of their subsequent requests for the family's data are
  rejected.
- **SC-007**: Removing or leaving deletes only the membership and never cascades to family-referenced
  data; every membership change leaves an audit record (author + timestamp). *(Full data-persistence
  verification lands with ACC-01/TXN-01, which introduce the family-owned financial entities.)*

## Assumptions

- **Invitation mechanism (decided, see Clarifications)**: a **single-use, time-limited invite code** the
  Owner generates and shares; the invitee enters it in the app. Each code admits exactly one person and
  is consumed on join. It **reuses the AUTH-01 hashed-secret security pattern** (CSPRNG generation, hashed
  at rest, expiry, single-use) — specifically the refresh-token variant: a **high-entropy code hashed with
  SHA-256** so it is indexable for the redeemer-blind lookup, its entropy providing brute-force resistance
  in place of a per-code attempt cap. No email delivery or deep-linking is required for the MVP.
- **Email verification is a prerequisite** for creating or joining a family, reusing the AUTH-01 soft
  gate (FR-019 of AUTH-01). FAM-01 provides the first real consumers of that gate.
- **One Owner per family; no transfer or deletion in this feature.** Ownership transfer and family
  deletion are out of MVP scope; the creator remains the Owner. A Member may leave; the Owner may not.
- **Family ownership of data.** Accounts, movements, budgets, and categories (delivered by ACC-01,
  TXN-01, BUD-01, CAT-01) are owned by the family, not the individual; FAM-01 establishes the boundary
  and membership only, not those financial entities.
- **Identity from the session.** FAM-01 builds directly on the AUTH-01 enforcement point: the acting
  identity and the family scope are derived from the authenticated session, never from caller input.
- **Currency and scale** follow the MVP context (CLP; a small invited pilot of 3–5 families); isolation
  and privacy guarantees are strict per the constitution.
