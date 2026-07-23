# Contract: `apps/api/Dockerfile` multi-stage build + HEALTHCHECK

Assertions for the fixed Dockerfile. Base image stays `node:24.18.0-alpine` (from FAM-23).

## C-1 · `build` stage resolves workspace binaries (FR-001, FR-002)

The `build` stage MUST make pnpm workspace package `node_modules` (with `.bin` symlinks) available
before running the topological build, in addition to the root `node_modules`:

```dockerfile
FROM base AS build
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /repo/packages/contracts/node_modules ./packages/contracts/node_modules
COPY . .
# Topological: contracts (dist) before the API. `nest` now resolves from apps/api/node_modules/.bin.
RUN pnpm --filter @famifinances/contracts build \
  && pnpm --filter @famifinances/api build
```

- **Contract**: after this stage, `apps/api/node_modules/.bin/nest` exists and `nest build`
  succeeds; `@famifinances/contracts` is built before `@famifinances/api`.

## C-2 · `runtime` stage is lean and boots (FR-005, US1/AC2)

- **Contract**: runtime image excludes build-only tooling (`nest` CLI, TypeScript, devDependencies).
  It contains the compiled `apps/api/dist` + `packages/contracts/dist` and only the **production**
  dependency tree needed to `require` from `dist/main.js`. `docker run … node dist/main.js` boots
  the API on Node v24.x without `MODULE_NOT_FOUND`.
- Preferred mechanism: `pnpm --filter @famifinances/api deploy --prod` (or a `--prod`-pruned copy of
  `apps/api/node_modules`) rather than shipping the dev tree.

## C-3 · `HEALTHCHECK` directive (FR-004)

Runtime stage MUST declare:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
```

- **Contract**: uses BusyBox `wget` (no new package); probes `/health`; non-2xx/connection failure
  → non-zero exit → container `unhealthy`. `EXPOSE 3000` and `CMD ["node","dist/main.js"]` unchanged.

## C-4 · Build/health success criteria

- **SC-001**: `docker build -t famifinances-api -f apps/api/Dockerfile .` exits `0`, completing
  `deps` → `build` → `runtime`.
- **SC-003**: `docker inspect --format='{{json .State.Health.Status}}'` reports `"healthy"` within
  30s of `docker run`.
