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
COPY . .
# Topological build: @famifinances/contracts (dist) before the API.
RUN pnpm --filter @famifinances/contracts build \
  && pnpm --filter @famifinances/api build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
# The API's contracts imports are type-only (erased at runtime), but ship the
# built package so the workspace symlink resolves if a value import is ever added.
COPY --from=build /repo/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build /repo/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
