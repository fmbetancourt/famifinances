# Phase 1 Data Model: Runtime Environment Specification

This feature introduces no application/domain entities. The single conceptual entity from the
spec — **Runtime Environment Specification** — is a configuration manifest distributed across
files rather than a persisted record. It is modeled here as the authoritative version matrix that
every declaration surface MUST agree on (SC-003: 100% consistency).

## Entity: Runtime Environment Specification

A logical manifest asserting the mandatory Node.js runtime and its enforcement across local,
CI, and containerized environments.

### Fields

| Field | Value (target) | Source of truth | Validation rule |
|-------|----------------|-----------------|-----------------|
| `nodeEngineRange` | `>=24.18.0` | root `package.json` → `engines.node` | Must be `>=24.18.0` (FR-001) |
| `nodeExactVersion` | `24.18.0` | `.nvmrc`, `.node-version` | Both files present, identical value (FR-002) |
| `engineStrict` | `true` | `.npmrc` → `engine-strict=true` | Present at repo root (FR-007) |
| `dockerBaseImage` | `node:24.18.0-alpine` | `apps/api/Dockerfile` → `FROM ... AS base` | Tag == `24.18.0-alpine` (FR-003) |
| `ciNodeVersion` | `'24.18.0'` | `.github/workflows/ci.yml` → `setup-node.node-version` | Exact quoted `24.18.0` (FR-004) |
| `packageManager` | `pnpm@10.32.1` | root `package.json` → `packageManager` | Unchanged (constitution tooling constraint) |
| `nativeBindings` | `argon2@^0.41.1`, `mongodb-memory-server@^10.0.1` | `apps/api/package.json` | Build + run clean under Node 24, no deprecation warnings (FR-005) |
| `docsRuntime` | `Node.js v24.18.0` | `README.md`, `specs/002-project-foundation/*` | No lingering "Node 20"/"20 LTS" mentions (FR-006) |

### Relationships

- `nodeEngineRange` **is enforced by** `engineStrict` (pnpm reads `engines.node` only when
  `engine-strict=true`).
- `nodeExactVersion`, `ciNodeVersion`, and `dockerBaseImage` **must be mutually consistent** —
  all resolve to the `24.18.0` line so local, CI, and container runtimes match (SC-003).
- `nativeBindings` **depend on** the resolved Node ABI; changing the Node line re-validates them
  (FR-005).

### State transitions

The manifest has a simple two-state lifecycle for this feature:

```text
[ Node >=20 baseline ]
        │  apply FR-001..FR-007 edits + install Node 24.18.0 locally
        ▼
[ Node v24.18.0 enforced ]  ── verified by ──▶  green typecheck+lint+test+build (SC-001)
                                                 fail-fast on Node <24.18.0 (SC-004)
```

There is no per-record persistence or runtime mutation; "state" is the aggregate git-tracked
configuration. A partial edit (some surfaces migrated, others not) is an **invalid intermediate
state** and MUST be caught by the consistency check in `quickstart.md` before merge (SC-003).

### Validation summary (maps to Success Criteria)

- **SC-001** — full unit + e2e suite green under Node v24.18.0.
- **SC-002** — `pnpm install --frozen-lockfile` produces 0 native compilation errors.
- **SC-003** — no declaration surface disagrees with the matrix above.
- **SC-004** — running any `pnpm` command on Node `< 24.18.0` fails before scripts execute.
