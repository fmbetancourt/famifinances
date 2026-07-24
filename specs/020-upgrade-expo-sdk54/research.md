# Research: Upgrade Mobile App to Expo SDK 54 (FAM-26)

**Phase 0 output** — resolves all NEEDS CLARIFICATION and reconciles the spec/Jira
version discrepancy before design.

## R1 — Authoritative Expo SDK 54 version matrix

**Decision**: Target the SDK 54 release train with these versions; treat
`npx expo install --fix` as the source of truth for exact patch pins.

| Package | Current (SDK 51) | Target (SDK 54) | Notes |
|---|---|---|---|
| `expo` | `~51.0.0` | `~54.0.0` | Root SDK pin. |
| `react` | `18.2.0` | `19.1.0` | **React 19** — major. Confirmed on Expo SDK 54 docs. |
| `react-native` | `0.74.0` | `0.81.x` | Confirmed "React Native 0.81" on Expo SDK 54 docs. |
| `expo-router` | `~3.5.0` | `~6.0.0` | **Not `~4.0.0`** (that is SDK 52). See R2. |
| `expo-secure-store` | `~13.0.0` | `~15.0.0` | Aligned to SDK 54 train. |
| `babel-preset-expo` (dev) | `~11.0.0` | `~54.0.0` | Unified `~54` versioning. |
| `jest-expo` (dev) | `~51.0.2` | `~54.0.0` | Unified `~54` versioning. |
| `@types/react` (dev) | `~18.2.79` | `~19.1.0` | Must track React 19. |
| `react-test-renderer` (dev) | `18.2.0` | **REMOVE** | Deprecated in React 19. See R3. |
| `@testing-library/react-native` (dev) | `^12.5.2` | `^13.x` | v13 drops the react-test-renderer peer. See R3. |
| `@babel/core` (dev) | `^7.24.0` | `^7.25+` | Bumped by resolver if needed. |
| `jest` (dev) | `^29.7.0` | `^29.7.0` | Stays on 29 for jest-expo 54. |
| `typescript` (dev) | `^5.6.3` | `^5.6+` | No forced change. |

**Rationale**: Expo publishes one mutually-compatible dependency set per SDK. The two
independently-verified anchors — **RN 0.81** and **React 19.1.0** (Expo SDK 54 versions
page) — uniquely identify the SDK 54 train, from which the peer versions above follow.
Running `npx expo install --fix` rewrites `package.json` to the exact validated pins, so
the canonical procedure is authoritative over any hand-typed constant.

**Alternatives considered**:
- *Hand-pin every version manually*: rejected — brittle and duplicates what `expo install
  --fix` already guarantees; the resolver stays correct across patch releases.
- *Stop at SDK 52/53*: rejected — the Jira bug is Expo Go **SDK 54** on the stores; only
  SDK 54 clears the incompatibility red screen (SC-001).

> **⚠️ Exact patch numbers** (`0.81.5`, `~15.0.x`, etc.) are *representative*; the executed
> `expo install --fix` output is the record of truth and should be pasted into the PR.

## R2 — Correcting the `expo-router@~4.0.0` clarification (spec + Jira drift)

**Decision**: Use **`expo-router@~6.0.0`**, and correct the spec clarification/FR-001 to say
"SDK 54's `expo-router` (`~6.0.0`)" instead of `~4.0.0`.

**Rationale**: `expo-router` is released in lockstep with the SDK:

| SDK | react-native | react | expo-router |
|---|---|---|---|
| 51 | 0.74 | 18.2 | ~3.5 |
| 52 | 0.76 | 18.3 | ~4.0 |
| 53 | 0.79 | 19.0 | ~5.0 |
| **54** | **0.81** | **19.1** | **~6.0** |

The spec's `~4.0.0` and Jira's "RN 0.76 / React 18.3" both describe **SDK 52**. Installing
`expo-router@4` against `expo@54` produces peer-dependency conflicts during `pnpm install`
(the exact Edge Case the spec warns about) and would fail AC2. The spec's *intent* — "match
the standard Expo SDK 54 peer dependency" — is preserved; only the incorrect literal is fixed.

**Alternatives considered**: Honor the literal `~4.0.0` — rejected, it contradicts the SDK 54
goal and is internally inconsistent with FR-001's `expo@~54.0.0`.

## R3 — React 19 test-tooling break: `react-test-renderer` + `@testing-library/react-native`

**Decision**: Remove the `react-test-renderer` dependency and upgrade
`@testing-library/react-native` to `^13`.

**Rationale**: React 19 deprecates `react-test-renderer`; `@testing-library/react-native`
v13 ships its own renderer and **removes** the `react-test-renderer` peer dependency. Leaving
`react-test-renderer@18.2.0` pinned against React 19 causes a peer conflict, and keeping RNTL
v12 (which expects react-test-renderer) breaks under React 19. This is the highest-risk part
of the upgrade because it is **not** fully auto-fixed by `expo install --fix` (that command
targets Expo-owned packages; RNTL is third-party). The 10 existing test files use RNTL APIs
(`render`, `screen`, `fireEvent`) that are stable across v12→v13, so test-body changes should
be minimal-to-none — but the suite is the gate that proves it (AC3).

**Alternatives considered**: Keep RNTL v12 + react-test-renderer — rejected, incompatible
with React 19.

## R4 — Config & tooling verification points (expected no-change, must confirm)

**Decision**: Treat `app.json`, `tsconfig.json`, `babel.config.js`, `jest.config.js`,
`jest.setup.ts` as verify-only; edit only if SDK 54 forces it.

**Rationale / findings**:
- **`app.json`**: `newArchEnabled: true` is retained (spec clarification; also the SDK 54
  default). `plugins: ["expo-router","expo-secure-store"]` and `experiments.typedRoutes:true`
  remain valid in SDK 54. **No edit expected.**
- **`jest.config.js`**: the pnpm-specific `transformIgnorePatterns` allow-list must survive —
  jest-expo 54 still ships Flow/TS sources under `.pnpm`. Verify the pattern still matches;
  React 19 may add packages needing transform.
- **`tsconfig.json`**: extends `expo/tsconfig.base`; verify it resolves under SDK 54 and that
  `@types/react@19` does not surface new strict-mode errors in the 12 screens / auth module.
- **`babel.config.js`**: single `babel-preset-expo` preset — stable across the bump.
- **`expo-env.d.ts`**: generated + gitignored; regenerated by Expo, no manual edit.

## R5 — Monorepo (pnpm) install strategy

**Decision**: Edit versions in `apps/mobile/package.json`, then reconcile at the workspace
root with `pnpm install`; use `npx expo install --fix` (run within `apps/mobile`) to derive
the exact pins, then re-run `pnpm install` from root so the lockfile is workspace-consistent.

**Rationale**: The repo is a pnpm workspace; installs must go through pnpm resolution
(global rule + Constitution Tech Constraints). `expo install` writes the correct versions but
the authoritative lockfile update is `pnpm install` at root. `@famifinances/contracts` is a
`workspace:*` dependency and must keep resolving; verify with a workspace-wide typecheck.

**Alternatives considered**: `npm`/`yarn` per Expo docs' default examples — rejected
(pnpm-only mandate).

## R6 — `expo-router@6` peer dependencies added as direct deps (post-implementation record)

**Decision**: Add four packages to `apps/mobile/package.json` `dependencies` that FR-001 did
**not** enumerate, pinned via `npx expo install` to their SDK 54 versions:

| Package | Version | Why added |
|---|---|---|
| `expo-constants` | `~18.0.13` | `expo-router@6.0.24` peer (`^18.0.13`). |
| `expo-linking` | `~8.0.12` | `expo-router@6.0.24` peer (`^8.0.12`). |
| `@expo/metro-runtime` | `~6.1.2` | `expo-router@6.0.24` peer (`^6.1.2`). |
| `react-dom` | `19.1.0` | `expo-router@6.0.24` peer (`*`); pinned to match `react@19.1.0`. |
| `react-native-safe-area-context` | `~5.6.2` | `expo-router@6.0.24` **required native peer** (`>= 5.4.0`). |
| `react-native-screens` | `~4.16.0` | `expo-router@6.0.24` **required native peer**. |

> **⚠️ Native-peer crash caught only on device (2026-07-24).** `react-native-safe-area-context`
> and `react-native-screens` were absent after `expo install --fix` and were **not** flagged by
> `pnpm install` (declared as `*`/`>=` peers) nor by the Metro `expo export` bundle (JS bundles
> fine without them). On a physical Expo Go SDK 54 device the app red-boxed at first mount with a
> native `java.lang.String cannot be cast to java.lang.Boolean` in the Fabric view-mounting path.
> `npx expo-doctor` **is** the check that surfaces this ("Missing peer dependency … Required by:
> expo-router"). **Lesson: run `npx expo-doctor` as part of the upgrade gate — a green typecheck +
> Metro bundle does not prove native-module completeness under the New Architecture.** Fixed via
> `npx expo install react-native-safe-area-context react-native-screens`; doctor then 18/18.

**Rationale**: `expo-router@6.0.24` declares these as peer dependencies. Under pnpm's
`auto-install-peers`, the transitive resolution pulled **wrong-major** versions from the
`latest` tag (`expo-linking@57.x`, `expo-constants@57.x` — a later SDK's independent version
line, and `react-dom@19.2.8` mismatched against `react@19.1.0`), producing unmet-peer warnings
that would risk runtime routing/linking breakage. Running
`npx expo install expo-constants expo-linking @expo/metro-runtime react-dom` pins each to the
SDK-54-validated version and makes the dependency explicit and reproducible. These are the
canonical Expo Router peers, not scope creep: FR-001's list was representative (see R1), and
FR-001 itself defers exact pins to `expo install --fix`. The Metro bundle (983 modules) and a
clean workspace typecheck confirm they are required and correct.

**Alternatives considered**:
- *pnpm `overrides`/`peerDependencyRules` to force versions*: rejected — indirect and hides the
  real dependency; explicit direct deps via `expo install` is the Expo-canonical, self-documenting fix.
- *Leave them transitive*: rejected — `auto-install-peers` resolved wrong majors (57.x), an
  actual correctness risk, not a cosmetic warning.

## Open items / residual risk

- **[Resolved 2026-07-23] Exact patch pins** — resolved by `expo install --fix`:
  `expo ~54.0.36`, `expo-router ~6.0.24`, `expo-secure-store ~15.0.8`, `react 19.1.0`,
  `react-native 0.81.5`, `@types/react ~19.1.17`, `babel-preset-expo ~54.0.12`,
  `jest-expo ~54.0.17`, `@testing-library/react-native ^13.0.0` (react-test-renderer removed),
  plus the R6 peers. Still paste the raw install output into the PR (T016).
- **[Med] Third-party RN packages under React 19** — only RNTL is present today; if a
  transitive RN lib warns under the New Architecture + RN 0.81, surface it during the device
  smoke test rather than pre-solving (YAGNI).
- **[Low] Typed-routes regeneration** — `.expo/types` regenerate on first `expo start`;
  a stale cache can mask route type errors, so run `typecheck` after a fresh start.

**Sources**
- https://docs.expo.dev/versions/v54.0.0/
- https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/
- https://callstack.github.io/react-native-testing-library/
