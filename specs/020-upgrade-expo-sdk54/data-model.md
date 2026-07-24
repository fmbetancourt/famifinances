# Data Model: Upgrade Mobile App to Expo SDK 54 (FAM-26)

**Phase 1 output.** This feature introduces **no runtime/persistent domain entities** and no
database schema — it is a dependency-version migration. The only modeled "entity" is the
mobile app's build/configuration surface, captured here so the change is explicit and
verifiable. No MongoDB collections, no Mongoose schemas, no `packages/contracts` type changes.

## Entity: MobileAppConfig (configuration, not persisted)

Represents the declarative configuration that pins the Expo runtime and its peer packages.
The "state transition" of interest is the SDK 51 → SDK 54 migration.

### Fields

| Field | Source file | Before (SDK 51) | After (SDK 54) | Validation rule |
|---|---|---|---|---|
| `expo` | `package.json` deps | `~51.0.0` | `~54.0.0` | Must resolve to installed SDK 54; drives Expo Go compatibility (FR-002). |
| `react` | `package.json` deps | `18.2.0` | `19.1.0` | Must equal SDK 54's bundled React (FR-004). |
| `react-native` | `package.json` deps | `0.74.0` | `0.81.x` | Must equal SDK 54's bundled RN. |
| `expo-router` | `package.json` deps | `~3.5.0` | `~6.0.0` | Must be SDK 54's router; **not** `~4.0.0` (see research R2). |
| `expo-secure-store` | `package.json` deps | `~13.0.0` | `~15.0.0` | Token store API must remain source-compatible (FR-004). |
| `babel-preset-expo` | `package.json` devDeps | `~11.0.0` | `~54.0.0` | Must match SDK 54. |
| `jest-expo` | `package.json` devDeps | `~51.0.2` | `~54.0.0` | Must match SDK 54; drives test transform. |
| `@types/react` | `package.json` devDeps | `~18.2.79` | `~19.1.0` | Must track React 19 for strict typecheck (FR-003). |
| `@testing-library/react-native` | `package.json` devDeps | `^12.5.2` | `^13.x` | v13 required for React 19 (research R3). |
| `react-test-renderer` | `package.json` devDeps | `18.2.0` | **removed** | Deprecated in React 19; RNTL v13 no longer needs it. |
| `newArchEnabled` | `app.json` → `expo` | `true` | `true` (unchanged) | MUST stay `true` (spec clarification). |
| `plugins` | `app.json` → `expo` | `["expo-router","expo-secure-store"]` | unchanged | Both plugins valid under SDK 54. |
| `experiments.typedRoutes` | `app.json` → `expo` | `true` | `true` (unchanged) | Typed routes must still generate (`.expo/types`). |
| `main` | `package.json` | `expo-router/entry` | unchanged | Router entry point valid under expo-router 6. |

### State transition

```text
[SDK 51 config] --(edit package.json + `expo install --fix` + `pnpm install`)--> [SDK 54 config]
        |                                                                                |
        | invariants preserved across the transition:                                    |
        |   • newArchEnabled === true                                                    |
        |   • plugins + typedRoutes unchanged                                            |
        |   • @famifinances/contracts still compiles (strict, no `any`)                  |
        |   • all existing tests still pass                                              |
        v                                                                                v
  QR scan → Expo Go SDK 54 red-screen incompat                     QR scan → app home screen renders
```

### Validation gates (map to Success Criteria)

- **SC-002 / FR-003**: `pnpm --filter @famifinances/mobile typecheck` exits `0`.
- **SC-003 / AC3**: `pnpm test` (workspace) passes 100%.
- **AC4 / FR-003**: `@famifinances/contracts` imports compile under strict mode.
- **SC-001 / FR-002 / AC2**: physical-device Expo Go (SDK 54) loads the home screen without
  the version-mismatch dialog.

### Relationships

- `MobileAppConfig` **consumes** `packages/contracts` (`workspace:*`) — unchanged; verified,
  not modified.
- `MobileAppConfig` is **independent** of `apps/api` — no API/OpenAPI change in this feature.
