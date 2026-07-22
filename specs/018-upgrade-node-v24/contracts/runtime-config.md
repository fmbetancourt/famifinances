# Contract: Runtime Configuration Surfaces

The "interface" this feature exposes is the set of configuration declarations that developers,
CI, and the container build read to determine the mandatory Node.js version. Each surface below
is a contract: the exact expected content after the upgrade. These are the assertions
`/speckit-tasks` and reviewers verify (SC-003 consistency).

> Values are authoritative. `>=24.18.0` is intentional for `engines`; version files are exact.

## C-1 · root `package.json` (FR-001)

```jsonc
{
  "engines": {
    "node": ">=24.18.0"   // was ">=20"
  }
  // packageManager: "pnpm@10.32.1"  ← unchanged
}
```

- **Contract**: `engines.node === ">=24.18.0"`. No other keys in this file change.

## C-2 · `.nvmrc` (FR-002) — NEW FILE, repo root

```text
24.18.0
```

- **Contract**: single line, no `v` prefix (nvm/fnm accept both; bare form is canonical), trailing
  newline. Exact `24.18.0`.

## C-3 · `.node-version` (FR-002) — NEW FILE, repo root

```text
24.18.0
```

- **Contract**: identical value to `.nvmrc`. Consumed by Volta/fnm/asdf-style managers.

## C-4 · `.npmrc` (FR-007) — NEW FILE, repo root

```ini
engine-strict=true
```

- **Contract**: `engine-strict=true` present at repo root. Enables pnpm to abort with
  `ERR_PNPM_UNSUPPORTED_ENGINE` when Node is outside `engines.node` (drives SC-004). Do not add
  unrelated registry/auth keys.

## C-5 · `apps/api/Dockerfile` (FR-003)

```dockerfile
# Multi-stage build for the FamiFinances API (modular monolith).
FROM node:24.18.0-alpine AS base   # was node:20-alpine
```

- **Contract**: only the base-stage `FROM` tag changes to `24.18.0-alpine`. The `deps`, `build`,
  and `runtime` stages inherit via `FROM base` / `--from=...` and MUST NOT hardcode a Node tag.
  The image must still build `argon2` cleanly (FR-005).

## C-6 · `.github/workflows/ci.yml` (FR-004)

```yaml
      - name: Set up Node 24.18.0        # was "Set up Node 20"
        uses: actions/setup-node@v4
        with:
          node-version: '24.18.0'        # was 20 — quoted to preserve trailing zero
          cache: pnpm
```

- **Contract**: `setup-node.node-version === '24.18.0'` (quoted string). Step name updated for
  accuracy. `cache: pnpm` and all other steps unchanged.

## C-7 · `README.md` (FR-006)

- **Contract**: the prerequisites line `Node.js 20 LTS` becomes `Node.js v24.18.0`. No other
  "Node 20"/"20 LTS" reference remains in `README.md`.

## C-8 · `specs/002-project-foundation/*` (FR-006)

- **Contract**: documentation references to the runtime — `quickstart.md`, `research.md`,
  `plan.md`, `contracts/ci-pipeline.md` — update "Node 20"/"Node.js 20 LTS" to `Node.js v24.18.0`
  so historical foundation docs stay consistent with the current mandate. (Sync Impact / prose
  only; no behavior.)

## Consistency assertion (SC-003)

After all edits, a repo-wide grep MUST return **zero** stale runtime references outside git
history:

```bash
grep -rInE 'node[ .:_-]*(20|>=20)( |$|-lts| lts)' \
  package.json .nvmrc .node-version .npmrc apps/api/Dockerfile \
  .github/workflows/ci.yml README.md specs/002-project-foundation/
# Expected: no matches
```

And every surface above resolves to the `24.18.0` line. Any single surface disagreeing is a
contract violation and blocks merge.
