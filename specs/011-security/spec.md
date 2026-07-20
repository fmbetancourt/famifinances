# Feature Specification: API Security Hardening (SEC-01)

**Feature Branch**: `011-security`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "SEC-01 · Seguridad y hardening — harden the API's transport and edge: standard security response headers on every response, a CORS allowlist that rejects unknown origins, request body-size limits, and stricter rate limits on authentication/credential endpoints (beyond the global baseline), plus verified error/log hygiene (no internal detail, no financial data, no account enumeration) and an operational security checklist (secrets outside the repo, backups with a tested restore, dependency vulnerability review) as the pilot precondition. Cross-cutting over all modules; builds on FND-01 (config/validation) and AUTH-01 (endpoints to protect)."

## Clarifications

### Session 2026-07-20

- Q: How is the CORS allowlist configured? → A: **Deny-by-default**, allowlist supplied via environment — no configured origins means no cross-origin browser access; clients with no `Origin` (native app, server-to-server) are never blocked.
- Q: What threshold/window for credential-endpoint rate limiting? → A: **~5 attempts per minute per IP** (and per identifier where applicable) on login/register/reset/verify, on top of the global 30/min baseline; externally configurable.
- Q: What is the scope of the pre-pilot operational checklist (US6)? → A: The **dependency scan is automated in CI** (quality-gates) inside SEC-01; backups + **tested restore**, secrets-outside-repo, and enforced TLS are **documented and verified as a manual pre-pilot gate** (not automated here).
- Q: Does `register` need to hide whether an email already exists (enumeration)? → A: **No — the existing `409` on a duplicate email is an accepted tradeoff** (the user needs to know to sign in instead); the anti-enumeration requirement applies to **password reset** (which stays uniform). The register tradeoff is recorded in the security checklist.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Security response headers on every response (Priority: P1) 🎯 MVP

Every API response carries standard security headers so clients and browsers enforce transport and content
protections, and the server does not advertise identifying details, reducing the attack surface for the whole
API at once.

**Why this priority**: Headers are a global, low-risk, high-coverage protection that applies to every existing
and future endpoint; it is the minimal deployable hardening slice.

**Independent Test**: Call any endpoint and confirm the response includes the required security headers (a
strict transport policy, no-sniff, frame/embedding denial, a restrictive referrer policy) and omits
server-identifying headers.

**Acceptance Scenarios**:

1. **Given** any API request, **When** the response is returned, **Then** it includes the required security
   headers (strict transport security, content-type-options `nosniff`, frame/embedding denied, a restrictive
   referrer policy).
2. **Given** any API response, **When** its headers are inspected, **Then** no server-identifying header (e.g.
   an `X-Powered-By`-style banner) is present.
3. **Given** a new endpoint added later, **When** it responds, **Then** the same headers apply automatically
   (headers are global, not per-route).

---

### User Story 2 - CORS allowlist (Priority: P1)

The API accepts cross-origin browser requests only from configured, trusted origins and rejects all others, so
a malicious web page cannot drive authenticated requests from a victim's browser.

**Why this priority**: A permissive CORS policy would let any site call the API with the user's session; an
allowlist is a core browser-facing protection. Native mobile requests (which send no `Origin`) are unaffected.

**Independent Test**: Send a cross-origin request from an allowlisted origin and confirm it is permitted; send
one from an unlisted origin and confirm it is not granted cross-origin access.

**Acceptance Scenarios**:

1. **Given** a request from an allowlisted origin, **When** it is made, **Then** the response grants that origin
   cross-origin access.
2. **Given** a request from an origin not on the allowlist, **When** it is made, **Then** cross-origin access is
   not granted to it.
3. **Given** a request with no `Origin` (e.g. the native mobile app or a server-to-server call), **When** it is
   made, **Then** it is processed normally (CORS does not block non-browser clients).

---

### User Story 3 - Request body-size limits (Priority: P1)

The API rejects request bodies larger than a configured maximum before processing them, mitigating
resource-exhaustion abuse from oversized payloads.

**Why this priority**: Unbounded request bodies are a cheap denial-of-service and memory-pressure vector; a size
cap is a simple, global safeguard.

**Independent Test**: Send a request whose body exceeds the configured maximum and confirm it is rejected with a
clear error and without being fully processed; a normal-sized request succeeds.

**Acceptance Scenarios**:

1. **Given** a request body over the configured limit, **When** it is sent, **Then** it is rejected with a clear
   "payload too large" error and is not processed.
2. **Given** a request body within the limit, **When** it is sent, **Then** it is processed normally.

---

### User Story 4 - Stricter rate limits on authentication endpoints (Priority: P1)

Authentication and credential endpoints (sign-in, registration, password-reset request/confirm, email-code
submission) enforce stricter rate limits than the global baseline, throttling brute-force and
credential-stuffing while leaving normal paced use unaffected.

**Why this priority**: Credential endpoints are the highest-value target; the global baseline alone is too
loose for them. This directly protects account security.

**Independent Test**: Issue repeated attempts against a credential endpoint beyond its threshold within the
window and confirm further attempts are throttled; a legitimate paced sequence is not throttled.

**Acceptance Scenarios**:

1. **Given** repeated attempts on a credential endpoint beyond its threshold within the window, **When** the
   next attempt is made, **Then** it is throttled (rate-limited) rather than processed.
2. **Given** a throttled request, **When** it is rejected, **Then** the response is clear but does not reveal
   whether an account exists or any internal detail (no enumeration).
3. **Given** a legitimate user acting at a normal pace, **When** they authenticate, **Then** they are not
   throttled.

---

### User Story 5 - Verified error, log, and secret hygiene (Priority: P1)

Error responses never leak internal detail, logs never contain sensitive data, and secrets live outside the
repository and are validated at startup, so failures and observability cannot become a data-leak channel.

**Why this priority**: Privacy by design (constitution II) is non-negotiable for a financial product; this
story verifies and closes any gaps in the existing hygiene across all modules.

**Independent Test**: Trigger validation, not-found, unauthorized, and unexpected errors and confirm responses
carry no stack trace, database/driver text, or secret; inspect logs and confirm no secret, token, password,
monetary amount, or note content appears.

**Acceptance Scenarios**:

1. **Given** any handled error, **When** the response is returned, **Then** it contains a safe message with no
   stack trace, database/driver detail, or secret.
2. **Given** an unexpected (unhandled) error, **When** it occurs, **Then** the response is a generic message and
   the internal detail is recorded only in redacted server logs.
3. **Given** a missing or invalid required secret at startup, **When** the service boots, **Then** it fails
   fast rather than starting in an insecure state.
4. **Given** any log or analytics output, **When** it is inspected, **Then** it contains no secret, token,
   password, monetary amount, or note content.

---

### User Story 6 - Pre-pilot operational security checklist (Priority: P2)

Before any external family joins the pilot, an operational security checklist is satisfied and recorded:
secrets are outside the repository, backups are taken with a **tested restore**, dependencies are scanned for
known vulnerabilities, and transport encryption is enforced.

**Why this priority**: These are the constitution's pilot preconditions, but they gate the pilot rather than
the first hardening deploy; hence P2.

**Independent Test**: Review the recorded checklist and confirm each item is satisfied — including evidence of a
successful backup restore and a dependency vulnerability scan result.

**Acceptance Scenarios**:

1. **Given** the pre-pilot review, **When** the checklist is evaluated, **Then** secrets-outside-repo,
   tested-restore, dependency-scan, and enforced-transport-encryption are each confirmed.
2. **Given** a high-severity dependency vulnerability, **When** the scan runs, **Then** the build fails or the
   risk is explicitly reviewed and accepted before release.

---

### Edge Cases

- **Preflight requests**: CORS preflight (OPTIONS) from an allowlisted origin succeeds; from an unlisted origin
  it is not granted access.
- **No-Origin clients**: native mobile and server-to-server requests (no `Origin` header) are never blocked by
  CORS.
- **Throttle window reset**: after the rate-limit window passes, a previously throttled identifier may try
  again.
- **Oversized upload**: a body far over the limit is rejected early, not buffered whole.
- **Enumeration**: the **password-reset** response does not reveal whether an email is registered (uniform).
  The **register** endpoint may return a `409` on a duplicate email — an **accepted tradeoff** (the user must
  know to sign in instead), recorded in the security checklist.
- **Misconfigured allowlist**: an empty/unset origin allowlist denies all cross-origin browser access (secure
  default) rather than allowing all.
- **Header duplication**: applying global headers must not duplicate or conflict with existing per-response
  headers.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every API response MUST include standard security headers — a strict transport security policy
  (HSTS with a max-age), `X-Content-Type-Options: nosniff`, frame/embedding denial, and a restrictive
  referrer policy — and MUST NOT expose server-identifying headers.
- **FR-002**: The API MUST restrict cross-origin browser access to an environment-supplied **allowlist** of
  origins, **deny-by-default** (no configured origins → no cross-origin browser access); requests from
  non-allowlisted origins MUST NOT be granted cross-origin access. Requests without an `Origin` (native app,
  server-to-server) MUST be processed normally.
- **FR-003**: The API MUST reject request bodies larger than a configured maximum with a clear "payload too
  large" error, without fully processing the payload.
- **FR-004**: Authentication and credential endpoints (sign-in, registration, password-reset request/confirm,
  email-verification code submission) MUST enforce stricter rate limits than the global baseline — a default of
  **~5 attempts per minute per IP** (and per identifier where applicable), externally configurable.
- **FR-005**: Throttled or rejected security responses MUST be clear but MUST NOT reveal whether an account
  exists or expose internal detail (no account enumeration).
- **FR-006**: Error responses MUST NOT contain stack traces, database/driver messages, secrets, or other
  internal detail; unexpected errors MUST return a generic message.
- **FR-007**: Secrets and credentials MUST live outside the repository, be supplied via environment/config, and
  be **validated at startup**; a missing/invalid required secret MUST cause a fast failure (no insecure boot).
- **FR-008**: No secret, token, password, monetary amount, or note content may appear in logs, error output, or
  analytics events.
- **FR-009**: Security headers, CORS policy, and body-size limits MUST be applied **globally** (all routes and
  API versions), automatically covering endpoints added later.
- **FR-010**: The security configuration (allowed origins, body-size limit, rate-limit thresholds and windows)
  MUST be externally configurable without code changes, with secure defaults.
- **FR-011**: Before the pilot, a security checklist MUST be satisfied and recorded as a **manual gate**:
  secrets outside the repo, backups with a **tested restore**, and enforced transport encryption. (The
  dependency review is automated per FR-012.)
- **FR-012**: The dependency set MUST be scanned for known vulnerabilities **automatically in the build/CI**
  (quality-gates); a high-severity finding MUST fail the build or be explicitly reviewed and accepted before
  release.

### Key Entities *(include if feature involves data)*

- **Security Configuration** *(configuration, not user data)*: the externally-supplied settings that govern the
  edge — the CORS origin allowlist, the request body-size limit, and the rate-limit thresholds/windows for
  credential endpoints. Has secure defaults; never contains secrets in the repository.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of API responses carry the required security headers and omit server-identifying headers.
- **SC-002**: 100% of cross-origin browser requests from non-allowlisted origins are denied cross-origin access;
  allowlisted origins and no-`Origin` clients are unaffected.
- **SC-003**: 100% of requests exceeding the configured body-size limit are rejected without full processing.
- **SC-004**: Repeated credential-endpoint attempts beyond the threshold are throttled 100% of the time, while a
  legitimate paced authentication is never throttled.
- **SC-005**: No error response exposes a stack trace, database/driver message, or secret (verified across
  validation, not-found, unauthorized, and unexpected errors).
- **SC-006**: No secret, token, password, monetary amount, or note content appears in logs across the API.
- **SC-007**: Before the pilot, a backup has been taken and a restore has been **successfully tested**, and the
  result is recorded.
- **SC-008**: The build reports dependency vulnerabilities; a high-severity finding blocks release or is
  explicitly accepted.

## Assumptions

- **Native mobile is the primary client** (Expo/React Native), which sends no browser `Origin`; the CORS
  allowlist mainly guards a future/administrative **web** client, and native/server-to-server calls are never
  blocked by CORS.
- **A baseline global rate limit already exists** (a shared throttler); SEC-01 adds **stricter** per-endpoint
  limits for credential routes on top of it, and reuses the existing per-account sign-in lockout.
- **Error, log, and secret hygiene largely exist already** (a uniform error filter, log redaction, startup env
  validation); SEC-01 **verifies and closes gaps** across all modules rather than rebuilding them.
- **Transport encryption (TLS) is terminated by the managed platform**; SEC-01 requires it be enforced and
  documented, not implemented in the app.
- **Secure defaults**: an empty origin allowlist denies all cross-origin browser access (deny-by-default); the
  body-size limit and credential rate limits ship with sensible defaults, all externally configurable.
- **Dependency scanning runs in the build/CI** (e.g. the existing quality-gates pipeline); the exact tool is a
  plan detail.
- **The operational checklist (US6) is a documented, verifiable gate**; the tested-restore and dependency-scan
  evidence are recorded, not asserted by application tests.
- **Delivery is API-first**; there is no mobile UI for this feature (it is edge/config hardening).
- **Reuses** FND-01 (config/env validation) and AUTH-01 (the credential endpoints being rate-limited).

## Dependencies

- **FND-01** — configuration and startup environment validation. Required.
- **AUTH-01** — the authentication/credential endpoints protected by stricter rate limits. Required.
- Applies **globally** across all existing modules (headers, CORS, body limits, log/error hygiene).

## Out of Scope

- A third-party penetration test, a Web Application Firewall, or DDoS protection appliances.
- Multi-factor authentication, SSO, or federated identity.
- Automated secret rotation and a full secrets-management platform.
- The Chilean Law 21.719 legal review and a formal threat model (tracked separately).
- Field-level encryption at rest beyond the managed-storage defaults.
