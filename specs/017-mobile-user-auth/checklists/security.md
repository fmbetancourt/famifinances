# Security & Privacy Requirements Quality Checklist: Mobile User Authentication (`017-mobile-user-auth`)

**Purpose**: Validate the completeness, clarity, consistency, and measurability of security and privacy requirements prior to technical planning.
**Created**: 2026-07-22
**Reviewed**: 2026-07-22 (against post-remediation spec.md)
**Feature**: [spec.md](../spec.md)
**Focus Area**: Security & Privacy Requirements Quality (Author Pre-Plan Readiness)

## Requirement Completeness

- [X] CHK001 - Are hardware-backed storage requirements explicitly defined for all target mobile operating systems? [Completeness, Spec §FR-001] — FR-001 (`expo-secure-store`) + Assumptions (iOS & Android supported).
- [X] CHK002 - Are requirements specified for revoking server-side refresh tokens during explicit sign-out? [Completeness, Spec §FR-005] — FR-005 + US3-AS2.
- [X] CHK003 - Are password complexity validation rules (length, character classes) completely enumerated in requirements? [Completeness, Spec §FR-003] — FR-003 (≥12, upper/lower/number/special).
- [ ] CHK004 - Are token lifecycle parameters (access token duration vs refresh token rotation windows) specified in requirements? [Gap] — **Open (accepted)**: TTLs are owned by the API (feature 001) per Assumptions; the mobile spec only reacts to 401 (FR-002). Not restated here by design.

## Requirement Clarity

- [X] CHK005 - Is "hardware-backed encrypted storage" defined with specific cryptographic standards or platform APIs? [Clarity, Spec §FR-001] — Names the concrete platform API `expo-secure-store` (iOS Keychain / Android Keystore).
- [X] CHK006 - Is the single refresh token rotation attempt behavior unambiguously specified for concurrent 401 API responses? [Clarity, Spec §FR-002] — FR-002 + Edge Case "Concurrent API calls during token expiration" (single in-flight refresh, pending requests coalesced).
- [X] CHK007 - Is the exact error message structure defined for failed authentication attempts without exposing account existence? [Clarity, Spec §FR-004] — Closed by FR-011 (uniform, non-enumerating sign-in error) + the "Auth Error" Key Entity (structure). Covered in tasks by T037.

## Requirement Consistency

- [X] CHK008 - Are session restoration requirements on app launch consistent with the family onboarding redirection rule? [Consistency, Spec §FR-007, Spec §FR-008] — Reconciled in Architectural Decision #1 (bootstrap → `/families/me` → `(app)` or `(family)/onboarding`).
- [X] CHK009 - Do password validation requirements in the mobile client align consistently with backend API security policies? [Consistency, Spec §FR-003] — FR-003 "matching API policy".

## Privacy & Zero-Logging Coverage

- [X] CHK010 - Are zero-logging requirements explicitly extended to telemetry, crash reporting, and system debug outputs? [Coverage, Spec §FR-006] — FR-006 covers "console logs, telemetry, or unencrypted storage" (telemetry encompasses crash/analytics); reinforced by Constitution Principle II.
- [X] CHK011 - Are requirements specified to prevent sensitive tokens, credentials, or personal data from persisting in unencrypted device logs? [Completeness, Spec §FR-006] — FR-006 + SC-003.

## Edge Cases & Failure Recovery

- [X] CHK012 - Are local session retention requirements defined for network connectivity loss during automatic token refresh? [Edge Case, Spec §Edge Cases] — Edge Case "Network failure during automatic token refresh" (retriable offline, no credential wipe).
- [X] CHK013 - Are requirements specified for handling cold starts when a refresh token has been revoked or invalidated? [Edge Case, Spec §Edge Cases] — Edge Case "Cold start with an invalidated/revoked refresh token" (401/403 → clear SecureStore → sign-in + message).
- [X] CHK014 - Are rate-limiting and throttling error handling requirements specified for repeated failed sign-in attempts? [Gap, Exception Flow] — Closed by FR-010 (friendly 429 throttle message on credential screens, no enumeration).

## Measurability & Acceptance Criteria

- [X] CHK015 - Can the requirement of 0 sensitive data leaks in logs be objectively verified through automated compliance checks? [Measurability, Spec §SC-003] — SC-003 target + automated no-secret-logging test (tasks T031) under FR-009.
- [X] CHK016 - Is the sign-in latency target (1.5 seconds) measurable from the mobile user's interaction start? [Measurability, Spec §SC-001] — SC-001 "measured from the submit tap to the first rendered destination screen" on the reference network.

## Notes

- **Status**: 15/16 satisfied by the current spec. CHK007 closed via FR-011. CHK004 remains an intentional, accepted boundary (below).
- **CHK004 (accepted gap)**: Access-token TTL and refresh-rotation windows are an API-side concern (feature 001), assumed implemented per the spec's Assumptions. The mobile client is TTL-agnostic — it reacts to 401 via the single-flight interceptor (FR-002). No mobile requirement needed; recorded as an intentional boundary.
- **CHK007 (closed)**: Resolved by adding FR-011 — failed sign-in shows a single uniform, non-enumerating error. Implemented by task T037.
