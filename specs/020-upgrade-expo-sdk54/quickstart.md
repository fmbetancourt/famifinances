# Quickstart / Validation Runbook: Expo SDK 54 Upgrade (FAM-26)

Run these steps end-to-end to prove the upgrade meets all acceptance criteria. Commands run
from the **repo root** unless noted. See [research.md](./research.md) for version rationale and
[data-model.md](./data-model.md) for the exact fields that change.

## Prerequisites

- Node **v24.18.0** (repo runtime), **pnpm** installed (never npm/yarn).
- Expo Go **SDK 54** installed on a physical Android or iOS device on the same LAN.
- Clean git working tree on branch `020-upgrade-expo-sdk54`.

## Step 1 — Apply the SDK 54 version set

```bash
cd apps/mobile
npx expo install expo@^54.0.0
npx expo install --fix        # rewrites Expo-owned deps to the validated SDK 54 pins
```

Then reconcile the third-party React-19 test tooling that `--fix` does not own
(research R3):

- remove `react-test-renderer` from `devDependencies`
- set `@testing-library/react-native` to `^13`
- confirm `@types/react` is `~19.1`

```bash
cd ../..                       # repo root
pnpm install                   # workspace-consistent lockfile
```

**Expected**: `pnpm install` completes with **no unresolved peer-dependency errors**
(the Edge Case in the spec). `apps/mobile/package.json` now shows `expo ~54`, `react 19.1`,
`react-native 0.81.x`, `expo-router ~6`, `expo-secure-store ~15`, `jest-expo ~54`,
`babel-preset-expo ~54`, and **no** `react-test-renderer`.

## Step 2 — Verify configuration invariants (expected no edits)

Confirm `apps/mobile/app.json` still has:

- `expo.newArchEnabled: true`
- `expo.plugins: ["expo-router", "expo-secure-store"]`
- `expo.experiments.typedRoutes: true`
- `main` (package.json) = `expo-router/entry`

**Expected**: all present, unchanged.

## Step 3 — Typecheck (SC-002 / FR-003 / AC4)

```bash
# fresh start once so typed-route + expo-env types regenerate, then typecheck
pnpm --filter @famifinances/mobile start   # let it bundle once, then Ctrl-C
pnpm --filter @famifinances/mobile typecheck
pnpm typecheck                              # workspace-wide, proves contracts still compile
```

**Expected**: exit code `0`, **0 TypeScript errors**, no `any` introduced. `@famifinances/contracts`
imports in the auth module compile under strict mode.

## Step 4 — Tests (SC-003 / AC3)

```bash
pnpm --filter @famifinances/mobile test    # 10 test files (auth session/api + screen tests)
pnpm test                                  # full monorepo suite
```

**Expected**: 100% pass. In particular:
- `no-secret-logging.test.ts` passes (Constitution II guard holds).
- `session-*`, `sign-in/up`, `reset-password`, `protected-route`, `refresh-interceptor`
  suites pass unchanged (RNTL v12→v13 API is source-compatible for `render/screen/fireEvent`).

> If a `react-test-renderer` peer error or an RNTL API break appears, that is the expected
> React-19 migration point from research R3 — fix within the test tooling, not by pinning
> back to React 18.

## Step 5 — Physical-device Expo Go smoke test (SC-001 / FR-002 / AC2)

```bash
pnpm --filter @famifinances/mobile start
```

Scan the QR code with **Expo Go SDK 54** on the physical device.

**Expected**:
- **No** "Project is incompatible with this version of Expo Go" red screen (the original bug).
- App bundles and the **home / sign-in screen renders cleanly**.
- No runtime deprecation red-box warnings from `expo-router`, `expo-secure-store`, or the New
  Architecture (FR-004).

## Acceptance mapping

| Criterion | Proven by |
|---|---|
| AC1 / FR-001 — deps on SDK 54 | Step 1 |
| AC2 / FR-002 / SC-001 — Expo Go loads | Step 5 |
| AC3 / SC-002 / SC-003 — typecheck + tests | Steps 3–4 |
| AC4 / FR-003 — contracts compile | Step 3 (`pnpm typecheck`) |
| FR-004 — no runtime deprecations | Step 5 |

## Record for the PR

Paste the actual `npx expo install --fix` output and the final `apps/mobile/package.json`
diff into the PR — those are the source of truth for the exact patch pins (research R1).
