# Contracts: Upgrade Mobile App to Expo SDK 54 (FAM-26)

**No new or changed external contracts.** This feature is a dependency-version migration of
`apps/mobile`. It adds **no** REST endpoints, changes **no** OpenAPI documents, and modifies
**no** shared types in `packages/contracts`. Per the plan template, contract files are skipped
for internal-only changes.

## The one contract that applies: preserve the existing `@famifinances/contracts` boundary

Constitution Principle VI requires the mobile↔API agreement to hold at compile time. The SDK 54
upgrade must be **contract-transparent**:

- **Obligation**: every `@famifinances/contracts` import used by `apps/mobile` (auth session,
  API client, verification, family) MUST keep compiling under TypeScript strict mode after the
  React 19 / SDK 54 bump. No `any` may be introduced to silence a type error.
- **Verification** (not a new artifact — an executable check):
  - `pnpm --filter @famifinances/mobile typecheck` → exit `0` (SC-002 / AC4)
  - workspace `pnpm typecheck` / `pnpm test` → no contract-drift regressions (SC-003)
- **Non-obligation**: because no API surface changes, there is **no** OpenAPI update required
  (Constitution DoD's "documented in OpenAPI if it changes the API" clause does not trigger).

If, during implementation, a `@famifinances/contracts` type must change to satisfy the
upgrade, that is a scope signal — stop and revisit the plan, because this feature asserts
zero contract change.
