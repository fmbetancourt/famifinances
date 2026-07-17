# Feature Specification: User Authentication & Access Control (AUTH-01)

**Feature Branch**: `001-user-auth`

**Created**: 2026-07-16

**Status**: Draft

**Input**: User description: "AUTH-01 · Registro, login, sesión y autorización. Acceso protegido y tokens seguros para FamiFinances (ver backlog en Notion \"02 · PRD + Backlog priorizado\" RF-01 e historia US-01, y el constitution del proyecto)."

## Clarifications

### Session 2026-07-16

- Q: How strictly is an unverified email enforced? → A: Sign-in is allowed, but all family/financial actions (creating or joining a family, recording movements) are blocked until the email is verified (soft gate on sensitive actions).
- Q: What happens to active sessions when a password reset completes? → A: All active sessions for the account are revoked on a successful reset, requiring re-authentication everywhere.
- Q: What delivery format do email verification and password reset use? → A: A short-lived one-time code (OTP) entered in the app, delivered by email.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register a new account (Priority: P1)

A person new to FamiFinances creates a personal account with an email and a password so they
have an identity that can later create or join a family.

**Why this priority**: Without an account there is no identity to protect; registration is the
entry point for every other capability. It is the first thing a pilot family must be able to do.

**Independent Test**: Can be fully tested by submitting a valid email and password to the
registration flow and confirming a usable account is created and no duplicate email is allowed —
delivers a working sign-up on its own.

**Acceptance Scenarios**:

1. **Given** an email not already registered, **When** the person submits a valid email and a
   password that meets the strength policy, **Then** an account is created and the person can
   proceed to sign in.
2. **Given** an email that is already registered, **When** the person submits it again, **Then**
   registration is rejected with a message that does not confirm whether the email exists (no
   account enumeration).
3. **Given** a password that fails the strength policy, **When** the person submits it, **Then**
   registration is rejected and the specific rule that failed is explained.
4. **Given** a malformed email, **When** the person submits it, **Then** registration is rejected
   with a validation message.

---

### User Story 2 - Sign in and obtain a session (Priority: P1)

A registered person signs in with their credentials and receives an authenticated session so the
app can act on their behalf.

**Why this priority**: Sign-in is the gate to all shared financial data; it is required for the
protected access enforcement that the rest of the product depends on.

**Independent Test**: Can be fully tested by signing in with correct credentials and receiving a
valid session, and by confirming wrong credentials are rejected — delivers working login on its own.

**Acceptance Scenarios**:

1. **Given** a registered account, **When** the person signs in with the correct email and
   password, **Then** an authenticated session with a short-lived access credential is issued.
2. **Given** a registered account, **When** the person signs in with a wrong password, **Then**
   access is denied with a generic message that does not reveal which factor was wrong.
3. **Given** repeated failed sign-in attempts for the same account or source, **When** a threshold
   is exceeded, **Then** further attempts are throttled or temporarily blocked.
4. **Given** an unregistered email, **When** sign-in is attempted, **Then** access is denied with
   the same generic message as a wrong password (no account enumeration).

---

### User Story 3 - Access protected resources only when authenticated and authorized (Priority: P1)

Every request to family-scoped or personal data is allowed only when it carries a valid session,
and is scoped to the identity in that session.

**Why this priority**: "Acceso protegido" is the core promise of AUTH-01 and the foundation of the
constitution's non-negotiable family isolation; it is what makes the other stories safe.

**Independent Test**: Can be fully tested by calling a protected resource with no session, an
expired session, and a valid session, and confirming only the valid session is allowed.

**Acceptance Scenarios**:

1. **Given** no session, **When** a protected resource is requested, **Then** the request is
   denied as unauthenticated.
2. **Given** an expired or tampered session credential, **When** a protected resource is requested,
   **Then** the request is denied and the credential is treated as invalid.
3. **Given** a valid session, **When** a protected resource is requested, **Then** access is
   granted and the acting identity is taken from the session, never from a value supplied by the
   caller.

---

### User Story 4 - Stay signed in with secure renewal (Priority: P2)

A signed-in person keeps using the app across the natural expiry of the short-lived access
credential without being forced to re-enter their password each time.

**Why this priority**: Frictionless continuity supports the "capture in seconds" product goal, but
the app is still usable for a full session without it, so it ranks below core sign-in.

**Independent Test**: Can be fully tested by letting the access credential expire, presenting a
valid renewal credential, and confirming a new access credential is issued without re-login.

**Acceptance Scenarios**:

1. **Given** an expired access credential and a valid renewal credential, **When** renewal is
   requested, **Then** a new short-lived access credential is issued.
2. **Given** a renewal credential that has been used to rotate or has expired, **When** renewal is
   requested, **Then** it is rejected and the person must sign in again.
3. **Given** a successful renewal, **When** the new credential is issued, **Then** the previous
   renewal credential is invalidated (rotation).

---

### User Story 5 - Sign out and revoke a session (Priority: P2)

A signed-in person signs out, after which their session can no longer be used.

**Why this priority**: Important for shared/family devices and for security, but the product is
demonstrable without it, so it ranks below establishing and protecting sessions.

**Independent Test**: Can be fully tested by signing out and confirming the prior session and its
renewal credential are rejected on the next request.

**Acceptance Scenarios**:

1. **Given** an active session, **When** the person signs out, **Then** the session's renewal
   credential is invalidated and cannot be used again.
2. **Given** a session that has been signed out, **When** any protected resource is requested with
   its credentials, **Then** the request is denied.

---

### User Story 6 - Verify email with a one-time code (Priority: P2)

After registering, a person confirms ownership of their email by entering a one-time code sent to
that address, unlocking the family and financial features of the app.

**Why this priority**: Verification gates all sensitive actions per the clarified soft-gate policy,
so it is required before a family can be created or any movement recorded; it ranks below core
sign-in because a signed-in person can still reach the app and the verification prompt without it.

**Independent Test**: Can be fully tested by registering, receiving a code, entering the correct
code to reach a verified state, and confirming wrong/expired codes are rejected — delivers working
verification on its own.

**Acceptance Scenarios**:

1. **Given** a freshly registered account, **When** the person enters the correct, unexpired code,
   **Then** the email is marked verified and family/financial actions are unlocked.
2. **Given** an unverified account, **When** the person attempts a family or financial action,
   **Then** the action is blocked with a message prompting email verification.
3. **Given** an expired, already-used, or incorrect code, **When** it is submitted, **Then**
   verification is rejected without revealing the correct code.
4. **Given** an unverified account, **When** the person requests a new code, **Then** a fresh code
   is issued, any previous unused code is invalidated, and the request is rate-limited.

---

### User Story 7 - Reset a forgotten password (Priority: P2)

A person who cannot remember their password requests a reset, proves control of their email with a
one-time code, and sets a new password — after which all prior sessions are signed out.

**Why this priority**: Self-service recovery is essential for a real pilot (no operator in the
loop), but it is not needed to demonstrate the core register/sign-in slice, so it ranks P2.

**Independent Test**: Can be fully tested by requesting a reset for a known account, entering the
delivered code, setting a new password, and confirming the old password and all prior sessions no
longer work while the new password does.

**Acceptance Scenarios**:

1. **Given** any email, **When** a password reset is requested, **Then** the response is uniform
   whether or not the email exists (no account enumeration), and a code is sent only if it exists.
2. **Given** a valid, unexpired reset code, **When** the person submits it with a new password that
   meets the strength policy, **Then** the password is updated and all active sessions for the
   account are revoked.
3. **Given** a completed reset, **When** the person signs in, **Then** only the new password works
   and every previously issued session is rejected.
4. **Given** an expired, already-used, or incorrect reset code, **When** it is submitted, **Then**
   the reset is rejected.
5. **Given** an unverified account that completes a password reset, **When** the reset succeeds,
   **Then** the email is also marked verified, since receiving the emailed code proves inbox control.

---

### Edge Cases

- What happens when a person registers with an email differing only in letter case or surrounding
  whitespace? The system MUST treat emails case-insensitively and trimmed so no near-duplicate
  accounts are created.
- How does the system handle a valid session whose owning account is later disabled or deleted?
  The session MUST stop being accepted.
- What happens when many failed sign-ins come from one source across different accounts? Throttling
  MUST consider source, not only the target account.
- How does the system behave when a renewal credential is replayed after rotation (possible theft)?
  The reused credential MUST be rejected; the session SHOULD be treated as compromised and revoked.
- What happens when a person signs in successfully but has not yet created or joined a family?
  Authentication succeeds and the session is valid; family-scoped resources simply have no family
  yet (handled by FAM-01).
- How are authentication events recorded without leaking secrets? Security events MUST be logged
  without passwords, tokens, or financial data.
- What happens when a verification or reset code is requested repeatedly in a short window? Requests
  MUST be rate-limited per account and per source, and each new code MUST invalidate the previous
  unused code of the same type.
- What happens when a password reset is requested for an email that is not registered? The system
  MUST return the same uniform response as for a registered email and MUST NOT send a code.
- What happens if a verification or reset code expires before use? It MUST be rejected and the person
  MUST be able to request a fresh one.
- What happens to an unverified account that never verifies? It remains able to sign in and see the
  app but is permanently blocked from family/financial actions until verified; retention/cleanup of
  such accounts is out of scope for this feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a person to register an account using an email address and a
  password.
- **FR-002**: System MUST enforce a password strength policy at registration and reject passwords
  that do not meet it, explaining which rule failed.
- **FR-003**: System MUST validate and normalize email addresses (trimmed, case-insensitive) and
  reject malformed values.
- **FR-004**: System MUST guarantee email uniqueness across accounts and reject duplicate
  registrations without confirming whether an email already exists.
- **FR-005**: System MUST store passwords only as a strong, salted one-way hash and MUST never
  store or log passwords in recoverable form.
- **FR-006**: System MUST authenticate a person by verifying their email and password and, on
  success, issue an authenticated session.
- **FR-007**: System MUST issue a short-lived access credential for each session and MUST support
  secure renewal of that credential without requiring the password again.
- **FR-008**: System MUST rotate the renewal credential on each use and invalidate the previous
  renewal credential.
- **FR-009**: System MUST reject expired, tampered, revoked, or reused credentials and treat them
  as unauthenticated.
- **FR-010**: System MUST deny access to protected resources when no valid session is presented.
- **FR-011**: System MUST derive the acting identity solely from the authenticated session and MUST
  ignore any identity or ownership value supplied directly by the caller.
- **FR-012**: System MUST allow a signed-in person to sign out, invalidating the session's renewal
  credential so it can no longer be used.
- **FR-013**: System MUST throttle or temporarily block authentication attempts after a configurable
  number of failures, considering both the target account and the request source.
- **FR-014**: System MUST return generic, uniform messages for failed sign-in that do not reveal
  whether the email exists or which factor was incorrect.
- **FR-015**: System MUST record authentication and authorization security events (registration,
  sign-in success/failure, renewal, sign-out, lockout) without recording passwords, credentials,
  or financial data.
- **FR-016**: System MUST reject requests that carry a valid credential whose owning account no
  longer exists or has been disabled.
- **FR-017**: System MUST validate all authentication inputs on the server side regardless of any
  client-side validation.
- **FR-018**: System MUST create every new account with its email in an unverified state and issue an
  email-verification challenge delivered by email as a short-lived one-time code.
- **FR-019**: System MUST allow a person with an unverified email to sign in and view the app, but
  MUST block all family and financial actions (creating or joining a family, recording movements)
  until the email is verified.
- **FR-020**: System MUST mark an email as verified when the correct, unexpired verification code is
  submitted, and MUST reject expired, already-used, or incorrect codes.
- **FR-021**: System MUST allow re-sending a verification code, invalidating any previous unused
  verification code, subject to rate limiting.
- **FR-022**: Users MUST be able to request a password reset for an email address; the system MUST
  return a uniform response whether or not the email is registered (no account enumeration) and MUST
  send a reset code only when the email is registered.
- **FR-023**: System MUST deliver a password-reset challenge by email as a short-lived one-time code
  and MUST reject expired, already-used, or incorrect reset codes.
- **FR-024**: On a successful password reset, System MUST set the new password (subject to the
  strength policy of FR-002) and MUST revoke all active sessions for that account.
- **FR-025**: On a successful password reset, System MUST also mark the account email as verified,
  because consuming the emailed code proves control of the inbox.
- **FR-026**: System MUST rate-limit verification and reset requests per account and per source to
  prevent abuse.
- **FR-027**: System MUST store one-time codes only in a non-recoverable (hashed) form, MUST never
  log codes, passwords, or financial data, and MUST enforce single use of each code.

### Key Entities *(include if feature involves data)*

- **Account (User Identity)**: Represents a single person's identity and credentials. Key
  attributes: unique normalized email, email-verification status (verified/unverified), password
  hash, account status (active/disabled), creation timestamp. One person has exactly one account;
  family membership is established separately.
- **One-Time Code (Verification / Reset Challenge)**: Represents a pending email-verification or
  password-reset challenge tied to one account. Key attributes: owning account reference, challenge
  type (email-verification or password-reset), hashed code, expiry time, consumed/used state, and
  attempt count. Codes are single-use and short-lived.
- **Session**: Represents an authenticated period of access tied to one account. Key attributes:
  owning account reference, short-lived access credential, renewal credential (rotating), issue and
  expiry timing, revocation state.
- **Authentication Event**: An auditable record of a security-relevant action (registration,
  sign-in outcome, renewal, sign-out, lockout). Key attributes: acting account reference where
  known, event type, timestamp, and non-sensitive context (never secrets or amounts).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new person can complete registration and reach a signed-in state in under 2 minutes
  on their first attempt.
- **SC-002**: A returning person can sign in in under 30 seconds.
- **SC-003**: 100% of requests to protected resources without a valid session are denied.
- **SC-004**: 100% of protected (session-scoped) access decisions use the identity from the session,
  verified by authorization tests that attempt to act as another identity by supplying a foreign
  identifier and are rejected. (Full family-scoped enforcement is validated in FAM-01, which builds
  on this mechanism.)
- **SC-005**: A person can continue using the app across at least one access-credential expiry
  without being asked to sign in again, as long as their session is within its overall lifetime.
- **SC-006**: After a configurable threshold of failed sign-in attempts, further attempts for that
  account/source are blocked, and this is demonstrable in testing.
- **SC-007**: No password, token, or financial value appears in any application log, error report,
  or analytics event across the full authentication flow (verified by inspection/tests).
- **SC-008**: Failed sign-in responses are indistinguishable between "unknown email" and "wrong
  password" (no account enumeration), verified by comparing responses.
- **SC-009**: A person can verify their email using the delivered code in under 2 minutes, and 100%
  of family/financial actions attempted by an unverified account are blocked.
- **SC-010**: After a successful password reset, 100% of sessions issued before the reset are
  rejected, and only the new password authenticates.
- **SC-011**: Password-reset requests return an identical response for registered and unregistered
  emails (no enumeration), verified by comparing responses.
- **SC-012**: Verification and reset code requests are rate-limited and demonstrably blocked after a
  configured threshold, verified in testing.

## Assumptions

- Authentication uses email + password as the sole factor for the MVP; social/SSO login is out of
  scope.
- Email verification and self-service password reset ARE in scope for AUTH-01. Both use a
  short-lived one-time code delivered by email and entered in the app. Unverified accounts may sign
  in but cannot perform family/financial actions; a successful reset revokes all active sessions and
  also marks the email verified.
- Email delivery relies on an external email provider; delivery latency or failures are handled with
  a user-facing "resend code" action rather than blocking the flow. Choosing and configuring the
  provider is a planning-phase decision.
- Exact one-time-code lifetimes and resend/rate-limit thresholds are configuration values fixed
  during planning; the spec only requires that codes be short-lived, single-use, hashed at rest, and
  rate-limited.
- Creating and joining a family, roles (Owner/Member), and the family-scoping of specific financial
  resources are covered by FAM-01; AUTH-01 provides the authenticated identity and the enforcement
  point that FAM-01 builds on. A freshly registered person may exist with no family yet.
- Multi-factor authentication, device management, and "remember this device" are out of scope for
  the MVP.
- Exact credential lifetimes, password policy parameters, and lockout thresholds are configuration
  values to be fixed during planning; the spec only requires that they be short-lived, enforced,
  and secure.
- The MVP targets a small invited pilot (3–5 families); scale requirements are modest, but the
  isolation and privacy guarantees are strict per the constitution.
- All authentication happens over an encrypted transport channel.
