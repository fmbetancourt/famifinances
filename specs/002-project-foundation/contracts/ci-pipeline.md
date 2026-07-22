# Contract: CI Pipeline (FND-01)

**Feature**: Project Foundation
**Date**: 2026-07-17

The CI pipeline is FND-01's primary new interface. This contract defines its triggers, jobs, and
pass/fail semantics so `/speckit-tasks` and implementation have an unambiguous target. The concrete
workflow lives at `.github/workflows/ci.yml`.

## Triggers

- `pull_request` targeting `main` — runs the full gate set; result gates the merge.
- `push` to `main` — runs the full gate set on the merged result (post-merge safety net).

## Environment

- Runner: `ubuntu-latest`.
- Node: v24.18.0 (`actions/setup-node`).
- Package manager: pnpm 10 (`pnpm/action-setup`), with pnpm store caching and the
  `mongodb-memory-server` binary cache (`~/.cache/mongodb-memory-server`).
- No repository/production secrets required for build or test.

## Jobs & steps (ordered; all blocking)

```text
job: quality-gates
  1. checkout
  2. setup pnpm + Node 24.18.0 (+ restore pnpm store & mongod caches)
  3. pnpm install --frozen-lockfile            # reproducible; runs approved native build scripts
  4. pnpm --filter @famifinances/contracts build  # dist for downstream typecheck
  5. pnpm -r typecheck                          # API + mobile (tsc --noEmit)
  6. pnpm -r lint                               # ESLint flat config across the workspace
  7. pnpm --filter @famifinances/api test       # unit
  8. pnpm --filter @famifinances/api test:e2e   # integration/e2e (mongodb-memory-server)
  9. pnpm --filter @famifinances/api build      # nest build
```

Steps run sequentially; the job fails on the first non-zero exit. (Splitting into parallel jobs is an
allowed optimization if the < 10-minute budget is threatened — see research R1.)

## Pass/fail semantics

| Outcome | Meaning |
|---------|---------|
| All steps exit 0 | Gate **passes**; the PR is eligible to merge. |
| Any step exits non-zero | Gate **fails**; the failing step is reported and merge is blocked. |

## Merge blocking (branch protection on `main`)

- The `quality-gates` status check MUST be **required** on `main`.
- The branch MUST be up to date before merge.
- Result: a red gate makes the PR unmergeable (FR-008, SC-003). Configured once via `gh api`
  (repository setting, outside the code diff).

## Non-goals (FND-01 CI)

- No native/EAS mobile build (mobile is validated by lint + typecheck; bootability verified locally).
- No deployment/publish steps (a later item).
- No coverage-threshold gate yet (can be added later without changing this contract's shape).
