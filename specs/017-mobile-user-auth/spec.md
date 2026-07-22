# Feature Specification: Mobile User Authentication & Access Control (AUTH-02 / FAM-8)

**Feature Branch**: `017-mobile-user-auth`

**Created**: 2026-07-22

**Status**: Draft (Aclarado y Ratificado)

**Input**: User description: "FAM-8: Completar Flujo Móvil de Autenticación y Persistencia de Sesión"

## Clarifications & Architectural Decisions

### Session 2026-07-22

- Q: Where should the app navigate a user upon sign-in if they do not belong to a family? → A: Redirect to Family Onboarding screen (`app/(family)/onboarding.tsx`) if `familyId` is null in the session.
- Q: Is biometric unlock (Face ID / Touch ID) required upon app launch for valid sessions in MVP 1.0? → A: No, standard automatic entry via valid SecureStore session tokens is used for MVP 1.0; biometrics are deferred to post-MVP.

### Architectural Decisions (Ratified)

1. **Family Membership Resolution (`FR-007`)**: During `SessionProvider` bootstrap, the mobile app calls `GET /api/v1/families/me`. On `200 OK`, `familyId` is stored in session state and routes to `(app)`. On `403 Forbidden`/`404 Not Found`, `familyId` is set to `null` and routes to `(family)/onboarding`. No shared contract changes needed.
2. **Onboarding Scope Separation (`FR-007` vs `FAM-9`)**: `FAM-8` implements a functional placeholder route at `app/(family)/onboarding.tsx` with a Sign Out option to satisfy routing rules without scope creep. The full interactive Create/Join UI is assigned to `FAM-9` (`FAM-102`).
3. **Mobile Test Tooling (`Principle IV: Test-First`)**: `FAM-8` configures Jest + `@testing-library/react-native` in `apps/mobile`, replacing `"test": "echo..."` with unit tests for `SessionContext`, the pure `password-policy` validator (`evaluate()`), and token interceptor.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign In and Secure Session Persistence (Priority: P1)

A family member opens the mobile app, enters their registered email and password, signs in successfully, and remains logged in securely across app restarts without re-entering credentials.

**Why this priority**: Core baseline requirement for the mobile app. Without sign-in and session persistence, users cannot access any family financial features.

**Independent Test**: Enter valid credentials on `sign-in.tsx`, force-close the mobile app, reopen it, and verify that the user lands directly on the main app screen (or family onboarding placeholder if no family).

**Acceptance Scenarios**:

1. **Given** an unauthenticated user on the sign-in screen, **When** they submit valid email and password credentials, **Then** access and refresh tokens are stored encrypted in SecureStore, session state becomes authenticated, and user is navigated to the main app (or Family Onboarding if user has no family membership).
2. **Given** an authenticated user whose access token has expired, **When** the mobile app sends an API request, **Then** the client transparently rotates tokens using the refresh token without interrupting the user's flow.
3. **Given** an unauthenticated user or an expired session, **When** the user attempts to access any protected screen, **Then** the application redirects them immediately to the sign-in screen.

---

### User Story 2 - Account Registration & Email Verification (Priority: P1)

A new family member registers an account on the mobile app, receives an email verification code (OTP), enters the code, and activates their account for family joining.

**Why this priority**: Essential onboarding mechanism to allow new family members to create accounts directly from their mobile devices.

**Independent Test**: Register with a new email and valid 12+ character password on `sign-up.tsx`, complete the OTP entry on `verify-email.tsx`, and verify the account state transitions to verified.

**Acceptance Scenarios**:

1. **Given** a new user on the sign-up screen, **When** they submit their email and a valid password meeting complexity rules (≥12 characters with mixed case, numbers, and symbols), **Then** the account is created and the user is routed to the email verification screen.
2. **Given** a user on the email verification screen, **When** they enter the 6-digit OTP code received by email, **Then** the backend verifies the account and grants authenticated access.
3. **Given** a sign-up attempt with a weak password, **When** submitted, **Then** the UI displays clear, real-time validation feedback listing the missing security requirements.

---

### User Story 3 - Password Reset & Secure Logout (Priority: P2)

A user who forgot their password requests a reset code via email and sets a new password, or an authenticated user explicitly logs out of their session.

**Why this priority**: Critical self-service account recovery and explicit session termination features for user privacy and security.

**Independent Test**: Trigger "Forgot Password" on `forgot-password.tsx`, enter code and new password on `reset-password.tsx`, then sign in with the new password. Or tap "Sign Out" and verify local secure storage is cleared.

**Acceptance Scenarios**:

1. **Given** a user requesting password recovery on `forgot-password.tsx`, **When** they provide their registered email and submit the valid OTP with a new password on `reset-password.tsx`, **Then** the password is updated and they can sign in with the new credentials.
2. **Given** an authenticated user, **When** they select "Sign Out", **Then** the refresh token is revoked on the backend, local tokens are wiped from SecureStore, and the user is redirected to the sign-in screen.

---

### Edge Cases

- **Network failure during automatic token refresh**: The mobile client retains local state in a pending offline mode rather than abruptly wiping user credentials, reattempting when network connectivity is restored.
- **Cold start with an invalidated/revoked refresh token**: If the refresh token request returns HTTP 401/403, the app clears SecureStore completely and routes to `sign-in.tsx` displaying a friendly message ("Your session has expired. Please sign in again.").
- **Concurrent API calls during token expiration**: The mobile HTTP client queues parallel pending requests while a single refresh operation is in flight, resolving all pending requests once the new token is acquired.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Mobile app MUST store access and refresh tokens in hardware-backed encrypted storage (`expo-secure-store`).
- **FR-002**: Mobile client MUST automatically intercept HTTP 401 responses and attempt a single transparent refresh token rotation before retrying the failed request.
- **FR-003**: Mobile app MUST enforce client-side password complexity validation (minimum 12 characters, requiring uppercase, lowercase, numbers, and special characters) matching API policy.
- **FR-004**: Mobile app MUST provide dedicated screens for Sign In (`sign-in.tsx`), Sign Up (`sign-up.tsx`), Email Verification (`verify-email.tsx`), Forgot Password (`forgot-password.tsx`), and Reset Password (`reset-password.tsx`).
- **FR-005**: Mobile app MUST clear all local secure storage and invalidate the refresh token on the server upon explicit user sign-out.
- **FR-006**: Mobile app MUST NEVER write raw passwords, access tokens, refresh tokens, or user financial data to console logs, telemetry, or unencrypted storage.
- **FR-007**: Mobile app MUST navigate users with no family membership directly to the Family Onboarding flow upon successful sign-in/verification (`GET /families/me` -> 403/404 -> `app/(family)/onboarding.tsx`).
- **FR-008**: Mobile app MUST allow direct session restoration from SecureStore on app launch without mandatory biometric prompts for MVP 1.0.
- **FR-009**: Mobile app MUST include automated unit tests using Jest + `@testing-library/react-native` for `SessionContext`, password complexity validation, and token interceptor logic (`Principle IV`).
- **FR-010**: Mobile app MUST surface a friendly, non-technical throttle message on the credential screens (`sign-in.tsx`, `sign-up.tsx`) when the API responds HTTP 429, without exposing account existence, consistent with the existing verify-email resend handling.
- **FR-011**: On failed sign-in (invalid email or password), the mobile app MUST display a single uniform, non-technical error message that does NOT reveal whether the email is registered or which factor failed, consistent with the API's uniform credential-error response.

### Key Entities

- **Session State**: In-memory session held by `SessionContext`, encapsulating `isAuthenticated`, `isLoading`, and authenticated `user` identity metadata (including `familyId`). Access and refresh tokens are NOT kept in this state — they live only in SecureStore (FR-001, FR-006) and are read on demand by the API client.
- **Auth Error**: Standardized error structure containing status code, error code/type, and localized user-friendly display message.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of valid sign-in attempts navigate to the main app (or onboarding if no family) within 1.5 seconds on the reference network (home Wi-Fi or 4G/LTE, RTT ≤ 100 ms), measured from the submit tap to the first rendered destination screen.
- **SC-002**: 100% of expired access tokens refresh transparently without user intervention or lost request payloads.
- **SC-003**: 0 instances of sensitive financial tokens, passwords, or personal data leaking into application or system logs.
- **SC-004**: Unauthenticated users are prevented 100% of the time from accessing protected routes.
- **SC-005**: 100% of mobile unit tests (`pnpm --filter @famifinances/mobile test`) pass in CI pipeline.

## Assumptions

- Backend API authentication endpoints (`/api/v1/auth/*`) and family endpoints (`/api/v1/families/*`) are already fully implemented, tested, and available in `apps/api`.
- Expo SecureStore API is available and supported on target iOS and Android mobile platforms.
- Biometric unlock (FaceID/TouchID) is out of scope for MVP 1.0 and deferred to future releases.
