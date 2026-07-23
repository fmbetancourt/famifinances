# Multi-stage build for the FamiFinances API (modular monolith).
FROM node:24.18.0-alpine AS base
RUN corepack enable
WORKDIR /repo

# Install workspace dependencies using the lockfile for reproducible builds.
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /repo/node_modules ./node_modules
# pnpm's isolated linker keeps each workspace package's .bin (e.g. `nest`) in that
# package's own node_modules, symlinked into the root store — copy the API's so
# `nest build` resolves in the build stage (FR-001). `packages/contracts` has no
# dependencies of its own (no node_modules); its `tsc` resolves from the root .bin.
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY . .
# Topological build: @famifinances/contracts (dist) before the API.
RUN pnpm --filter @famifinances/contracts build \
  && pnpm --filter @famifinances/api build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo
# Lean, self-contained runtime: install ONLY production dependencies (no `nest` CLI /
# devDependencies) so the image stays small (FR-005), while pnpm's workspace symlinks
# still let `node dist/main.js` resolve every runtime require.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --prod
# Compiled output from the build stage (contracts dist ships so the workspace symlink
# resolves if a value import is ever added; the API's imports are type-only today).
COPY --from=build /repo/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /repo/apps/api/dist ./apps/api/dist
WORKDIR /repo/apps/api
EXPOSE 3000
# Liveness probe via Alpine BusyBox wget — no extra layer (FR-004).
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
CMD ["node", "dist/main.js"]
