# Implementation Plan: Upgrade Mobile App to Expo SDK 54 (FAM-26)

**Branch**: `020-upgrade-expo-sdk54` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/020-upgrade-expo-sdk54/spec.md`

**Jira**: [FAM-26](https://soyfmbetancourt.atlassian.net/browse/FAM-26) — `[Mobile] Upgrade apps/mobile from Expo SDK 51 to SDK 54 for Expo Go compatibility` (Bug, Highest)

## Summary

`apps/mobile` currently targets **Expo SDK 51** (`expo@~51.0.0`, `react-native@0.74.0`,
`react@18.2.0`, `expo-router@~3.5.0`). The public Expo Go app on the stores has advanced to
**SDK 54**, so scanning the dev-server QR from a physical device fails with a hard
"Project is incompatible with this version of Expo Go" red screen. This blocks the
fast physical-device testing loop that Constitution Principle VII depends on.

The technical approach is a **dependency-version migration** (no product/behavior change):
align every Expo-managed package in `apps/mobile` to the SDK 54 release train using Expo's
canonical resolver (`npx expo install expo@^54.0.0` then `npx expo install --fix`),
reconcile the two React-19 test-tooling breaks it surfaces (`react-test-renderer` removal +
`@testing-library/react-native` v13), and prove no regression via `typecheck`, `test`, and a
physical-device Expo Go smoke test. Shared `@famifinances/contracts` types must keep compiling
under strict mode across the workspace.

> **⚠️ Spec/Jira version correction (resolved in [research.md](./research.md)):** The spec
> clarification and the Jira technical notes cite `expo-router@~4.0.0` and
> `React Native ~0.76 / React 18.3` — **those are the Expo SDK 52 numbers, not SDK 54.**
> The authoritative SDK 54 targets are **React Native 0.81, React 19.1.0, and
> `expo-router@~6.0.0`.** This plan uses the SDK 54 numbers; the intent of FR-001 (align to
> the SDK 54 train) is honored, only the literal version constants are corrected.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node v24.18.0 (repo runtime)

**Primary Dependencies**: Expo SDK 54 (`expo@~54.0.0`), React Native 0.81, React 19.1.0,
`expo-router@~6.0.0`, `expo-secure-store@~15.0.0`; dev: `jest-expo@~54.0.0`,
`babel-preset-expo@~54.0.0`, `@testing-library/react-native@^13`, `jest@^29`

**Storage**: N/A for this feature (config/dependency change only). `expo-secure-store` remains
the token store; no schema change.

**Testing**: Jest via `jest-expo` preset; `@testing-library/react-native`; `tsc --noEmit`
for typecheck. Physical-device manual smoke test via Expo Go (SDK 54).

**Target Platform**: Android & iOS via Expo Go SDK 54 (managed workflow, `newArchEnabled: true`)

**Project Type**: Mobile app inside a pnpm monorepo (`apps/mobile`, `apps/api`, `packages/contracts`)

**Performance Goals**: N/A — parity with current behavior; success is "no regression".

**Constraints**: pnpm-only workspace resolution; TypeScript strict, no `any`; must keep
`newArchEnabled: true` and typed routes (`experiments.typedRoutes: true`); no new product
capability may be introduced (YAGNI / scope discipline).

**Scale/Scope**: 12 Expo Router screens + auth feature module; ~10 existing test files that
must continue to pass. No API endpoints added or changed.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Impact | Verdict |
|-----------|--------|---------|
| I. Family Data Isolation | No auth/scoping logic changes; existing cross-family behavior untouched. | ✅ Pass |
| II. Financial Privacy by Design | No logging changes. `no-secret-logging.test.ts` must still pass post-upgrade. | ✅ Pass (guard test in regression set) |
| III. Derived Balance Integrity | No money-movement code touched. | ✅ N/A |
| IV. Test-First & DoD | Existing suite is the regression net; DoD requires physical-device validation (SC-001) — matches this feature exactly. Config change validated on device. | ✅ Pass |
| V. Modular Monolith Simplicity (YAGNI) | Version bump only; no architecture, no new capability. Removing deprecated `react-test-renderer` reduces surface. | ✅ Pass |
| VI. Shared, Documented Contracts | `@famifinances/contracts` consumption must keep compiling (AC4 / FR-003); no OpenAPI change (no API change). Strict mode preserved. | ✅ Pass |
| VII. Fast & Accessible Capture UX | This feature **restores** the fast physical-device loop that the SDK mismatch broke. | ✅ Pass (directly serves the principle) |

**Result**: PASS — no violations. Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/020-upgrade-expo-sdk54/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output — SDK 54 version matrix + migration breaks
├── data-model.md        # Phase 1 output — MobileAppConfig (config entity)
├── quickstart.md        # Phase 1 output — validation runbook (typecheck/test/device)
├── contracts/           # Phase 1 output — see contracts/README.md (no new API contract)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
apps/mobile/
├── package.json         # PRIMARY EDIT — SDK 54 dependency versions
├── app.json             # Verify: newArchEnabled:true, plugins, typedRoutes (expect no edit)
├── tsconfig.json        # extends expo/tsconfig.base — verify still resolves under SDK 54
├── babel.config.js      # babel-preset-expo — no edit expected
├── jest.config.js       # jest-expo preset + .pnpm transformIgnorePatterns — verify
├── jest.setup.ts        # test setup — verify against jest-expo 54
├── expo-env.d.ts        # generated (gitignored) — regenerated by expo
├── app/                 # 12 Expo Router screens + 4 __tests__ (must keep passing)
└── src/features/auth/   # session/api/storage + 6 __tests__ (must keep passing)

packages/contracts/      # consumed by mobile — must keep compiling (no edit expected)
apps/api/                # unaffected — no edit
```

**Structure Decision**: This is a mobile+API monorepo; the change is confined to
`apps/mobile`. The single primary edit is `apps/mobile/package.json`; `app.json`,
`tsconfig.json`, `babel.config.js`, `jest.config.js`, and `jest.setup.ts` are
verification points (expected no change, but SDK 54 may require touch-ups surfaced in
research). `packages/contracts` and `apps/api` are verification-only (must not regress).

## Complexity Tracking

> No Constitution Check violations — section intentionally empty.
