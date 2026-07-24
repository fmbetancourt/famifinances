# Feature Specification: Upgrade Mobile App to Expo SDK 54 (FAM-26)

**Feature Branch**: `020-upgrade-expo-sdk54`

**Created**: 2026-07-23

**Status**: Draft

**Input**: User description: "FAM-26 https://soyfmbetancourt.atlassian.net/browse/FAM-26"

## Clarifications

### Session 2026-07-23

- Q: Should the upgrade maintain `"newArchEnabled": true` in `app.json`? → A: Maintain `"newArchEnabled": true` (Standard Expo SDK 54 default architecture).
- Q: Should `expo-router` be upgraded to match the Expo SDK 54 peer dependency? → A: Yes — upgrade `expo-router` to the SDK 54 release (`~6.0.0`). *(Correction 2026-07-23 during /speckit-plan: the original answer said `~4.0.0`, but that is the SDK 52 router; SDK 54 ships `expo-router ~6.0.0` alongside React Native 0.81 / React 19.1. See plan research R2.)*

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Expo Go SDK 54 Compatibility for Physical Devices (Priority: P1)

As a developer or tester, I want `apps/mobile` to target Expo SDK 54, so that I can launch the development server, scan the QR code using the latest Expo Go mobile app on physical devices (Android / iOS), and test the mobile application without SDK version mismatch errors.

**Why this priority**: Without Expo SDK 54 compatibility, developers and product stakeholders cannot execute rapid end-to-end testing on physical devices via Expo Go (violating Constitution Principle VII: Fast & Accessible Capture UX).

**Independent Test**: Can be fully tested by running `pnpm --filter @famifinances/mobile start`, scanning the QR code with the Expo Go mobile app (SDK 54) on a physical phone, and verifying the application main screen renders cleanly without version error dialogs.

**Acceptance Scenarios**:

1. **Given** a physical device with Expo Go SDK 54 installed, **When** launching `pnpm --filter @famifinances/mobile start` and scanning the QR code, **Then** the application bundles successfully and displays the home screen without version error popups.
2. **Given** updated Expo SDK 54 dependencies in `apps/mobile/package.json`, **When** running type checking (`pnpm --filter @famifinances/mobile typecheck`), **Then** TypeScript completes with 0 errors.

---

### User Story 2 - Monorepo & Contract Compilation Integrity (Priority: P2)

As a developer, I want all shared contracts (`packages/contracts`) and NestJS API integrations to remain fully functional after upgrading the mobile app dependencies, so that client-server type safety is preserved.

**Why this priority**: Upgrading framework versions must not introduce breaking changes or drift in shared contract types across the monorepo.

**Independent Test**: Can be tested by running `pnpm test` and `pnpm typecheck` across all workspace packages and confirming zero regressions.

**Acceptance Scenarios**:

1. **Given** updated mobile dependencies, **When** executing workspace-wide test suites (`pnpm test`), **Then** all mobile unit tests and contract validations pass cleanly.
2. **Given** shared contract imports from `@famifinances/contracts`, **When** building and type checking the workspace, **Then** TypeScript strict mode assertions pass without type errors.

---

### Edge Cases

- What happens if peer dependencies (e.g. `react-native`, `react`, `expo-router`, `expo-secure-store`) conflict during `pnpm install`? Dependencies must be aligned using official Expo SDK 54 compatible versions (`npx expo install --fix`).
- How does the upgrade affect Expo Router navigation and typed routes? Typed route configurations in `app.json` and Expo Router entry point (`expo-router/entry`) must be validated against SDK 54 standards.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Dependencies in `apps/mobile/package.json` MUST be updated to target Expo SDK 54 (`expo@~54.0.0`) and its corresponding peer dependencies (`react@19.1.0`, `react-native@0.81.x`, `expo-router@~6.0.0`, `expo-secure-store@~15.0.0`, `babel-preset-expo@~54.0.0`, `jest-expo@~54.0.0`), maintaining `"newArchEnabled": true` in `app.json`. Exact patch pins are resolved by `npx expo install --fix`.
- **FR-002**: The mobile development server (`pnpm --filter @famifinances/mobile start`) MUST initialize cleanly and accept connections from Expo Go SDK 54 clients.
- **FR-003**: The mobile application MUST maintain full TypeScript strict mode compliance with `@famifinances/contracts`.
- **FR-004**: All mobile navigation screens, hooks, and secure storage utilities MUST operate without fatal runtime errors (red-box) or breaking API changes under Expo SDK 54. Non-fatal console deprecation notices (yellow-box) that do not alter behavior are acceptable but SHOULD be recorded for follow-up.

### Key Entities

- **MobileAppConfig**: Configuration attributes in `apps/mobile/package.json` and `app.json` defining SDK runtime version, router entry, and plugin hooks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `pnpm --filter @famifinances/mobile start` connects cleanly with Expo Go (SDK 54) on physical devices without version mismatch errors.
- **SC-002**: `pnpm --filter @famifinances/mobile typecheck` completes with exit code 0 and 0 errors.
- **SC-003**: `pnpm test` across the monorepo passes 100% of unit and integration tests.

## Assumptions

- **Target SDK**: Expo SDK 54 is the standard current release for mobile app stores.
- **Package Management**: All dependency installations must use pnpm workspace resolution rules (`pnpm --filter @famifinances/mobile`).
- **Device Support**: Supports both Android and iOS devices running current Expo Go app builds.
