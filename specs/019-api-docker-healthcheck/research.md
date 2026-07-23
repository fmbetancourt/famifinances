# Phase 0 Research: Fix API Docker Build and Health Check

The spec's two clarifications (liveness-only `/health`; `wget` for `HEALTHCHECK`) are already
resolved in `spec.md`. No `NEEDS CLARIFICATION` remains in Technical Context. The decisions below
fix the implementation approach.

## Decision 1 — Build-stage workspace binary resolution (`nest: not found`)

- **Decision**: In the `build` stage, in addition to the root `node_modules`, copy the
  **workspace package** `node_modules` from the `deps` stage so pnpm's per-package `.bin` symlinks
  (e.g. `apps/api/node_modules/.bin/nest`) are present:

  ```dockerfile
  FROM base AS build
  COPY --from=deps /repo/node_modules ./node_modules
  COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
  COPY --from=deps /repo/packages/contracts/node_modules ./packages/contracts/node_modules
  COPY . .
  RUN pnpm --filter @famifinances/contracts build \
    && pnpm --filter @famifinances/api build
  ```

- **Rationale**: pnpm's isolated node-linker keeps each workspace package's direct-dependency
  symlinks (including CLI `.bin` entries) under that package's own `node_modules`, pointing into
  the root `node_modules/.pnpm` virtual store. The current stage copies only the root store, so
  `nest` (a devDependency of `apps/api`) is unresolved. Confirmed empirically: in the `deps` stage,
  `apps/api/node_modules/.bin/nest` exists while `node_modules/.bin/nest` does not.
  `.dockerignore` excludes `**/node_modules/`, so the later `COPY . .` cannot supply them — they
  must come from `deps`. This is the smallest change that respects the existing multi-stage layout
  (FR-001, FR-002).
- **Alternatives considered**:
  - *Re-run `pnpm install --frozen-lockfile --offline` in the `build` stage* — recreates all
    symlinks reliably, but re-does resolution work already done in `deps` and needs the store
    mounted/copied anyway; more moving parts than the targeted COPY. Kept as fallback if symlink
    copying proves fragile across Docker/pnpm versions.
  - *`pnpm --filter @famifinances/api deploy`* — powerful but reshapes the whole Dockerfile; over-
    scoped for a targeted fix (Principle V).
  - *Hoisted node-linker (`node-linker=hoisted` in `.npmrc`)* — would flatten binaries to root, but
    changes dependency resolution semantics for the entire monorepo (local + CI) to fix a
    container-only issue. Rejected as disproportionate.

## Decision 2 — Runtime stage stays lean and resolvable (FR-005 + US1/AC2)

- **Decision**: Keep build-only tooling out of the runtime image. The runtime stage copies the
  compiled `apps/api/dist`, `packages/contracts/dist`, the root `node_modules`, and the API's
  **production** `node_modules` needed to resolve `require`s from `/repo/apps/api/dist/main.js`.
  Prefer producing the API's prod dependency tree via `pnpm --filter @famifinances/api deploy
  --prod` (or copying `apps/api/node_modules` after a `--prod` prune) rather than shipping the full
  dev tree.
- **Rationale**: `node dist/main.js` runs from `WORKDIR /repo/apps/api`; Node resolves modules from
  `apps/api/node_modules` then the root. The current runtime copies only root `node_modules`, which
  works for hoisted/.pnpm-stored deps but is fragile for the API's direct deps under the isolated
  linker — and the image has never actually booted (build failed first). Shipping only prod deps
  keeps the image lean (FR-005) while guaranteeing boot (US1/AC2). Validate real boot in quickstart.
- **Alternatives considered**: copy the full dev `node_modules` into runtime (simplest, but violates
  FR-005 leanness and enlarges the image with `nest`/typescript). Rejected.

## Decision 3 — Exposing `/health` at the un-prefixed, un-versioned path

- **Decision**: (a) Controller declared `@Controller({ path: 'health', version: VERSION_NEUTRAL })`;
  (b) exclude health from the global prefix:
  `app.setGlobalPrefix('api', { exclude: [{ path: 'health', method: RequestMethod.GET }] })` in
  `app.setup.ts`; (c) annotate the handler with `@SkipThrottle()`.
- **Rationale**: `app.setup.ts` applies `setGlobalPrefix('api')` + URI versioning `defaultVersion
  '1'`, so an ordinary controller resolves at `/api/v1/health`. FR-004's `HEALTHCHECK` targets
  `http://localhost:3000/health`, so the route must skip **both** the prefix and the version
  segment. `VERSION_NEUTRAL` + prefix `exclude` yields exactly `/health`. `@SkipThrottle()` prevents
  periodic probes from consuming the global 30-req/60s budget and getting 429s under load. No JWT
  concern: the API has no global auth guard (auth is per-route), so the endpoint is public by
  simply omitting `@UseGuards` (FR-003).
- **Alternatives considered**:
  - *Point `HEALTHCHECK` at `/api/v1/health`* — avoids prefix/version gymnastics but contradicts the
    spec's explicit `/health` target and couples the probe URL to API versioning. Rejected.
  - *A raw Express middleware for `/health` before Nest routing* — bypasses Nest DI/testing
    conventions; harder to e2e-test through the shared harness. Rejected.

## Decision 4 — `HEALTHCHECK` command and tuning

- **Decision**: Add to the runtime stage:

  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
  ```

- **Rationale**: `wget` ships with Alpine BusyBox (no extra layer, FR-004). `--spider` performs a
  HEAD-like fetch without saving a body; non-2xx or connection failure yields a non-zero exit → the
  container is marked `unhealthy`. `--start-period=10s` gives Nest time to boot before failures
  count, supporting SC-003 (`healthy` within 30s); `--interval=30s` keeps probe traffic negligible
  vs. the throttle budget even without skip (belt-and-suspenders with Decision 3).
- **Alternatives considered**: `curl` (not in the base image → extra layer, violates FR-005);
  Node-based inline probe (heavier process spawn each interval). Rejected.

## Decision 5 — Response shape and DB independence

- **Decision**: `GET /health` returns HTTP 200 with a static body `{ "status": "ok" }` computed in
  the controller with no injected DB/Mongoose dependency.
- **Rationale**: Clarification fixed this as a **liveness** check of process responsiveness, not a
  readiness/deep probe. Excluding DB connectivity keeps it fast (< 200ms, SC-002) and avoids
  flapping `unhealthy` during transient DB blips (constitution Principle V; also avoids leaking DB
  error detail per Principle II).
- **Alternatives considered**: `@nestjs/terminus` readiness with a Mongo ping — richer, but pulls a
  new dependency and contradicts the liveness clarification. Deferred (YAGNI).

## Consolidated outcome

No unresolved unknowns. Build fix = copy workspace `node_modules` in `build` (+ lean prod runtime);
endpoint = isolated version-neutral, prefix-excluded, throttle-skipped `/health` returning static
`{"status":"ok"}`; `HEALTHCHECK` via BusyBox `wget`. Proceed to Phase 1.
