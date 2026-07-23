# Phase 1 Data Model: Health Check

This feature introduces no persisted entity and no Mongoose schema. The only "entity" is the
transient HTTP response body of the liveness probe.

## Entity: HealthStatus (transient response DTO)

Represents the API process's liveness at request time. Computed in-process; never stored.

### Fields

| Field | Type | Value | Notes |
|-------|------|-------|-------|
| `status` | `string` (literal `"ok"`) | always `"ok"` when the process can serve the request | The mere fact the handler runs and returns proves liveness (FR-003). |

### Shape

```json
{ "status": "ok" }
```

### Rules

- The payload MUST be static — no DB read, no family/financial data, no timestamps derived from
  sensitive state (constitution I & II). A liveness probe answers "is the process responsive?", not
  "is every dependency healthy?" (clarification / Principle V).
- HTTP status MUST be `200` on success (SC-002). If the process cannot serve, no response is
  produced and the transport failure itself signals `unhealthy` to Docker (Decision 4).
- No TypeScript type is added to `packages/contracts`: no client consumes this shape (it is an
  ops/orchestrator surface, not part of the mobile↔API contract). A local `interface` / inline
  return type in the controller suffices (Principle VI note in plan).

### State (container health, derived — not stored)

Docker derives container health from repeated `HEALTHCHECK` probes; this is runtime state owned by
the Docker daemon, not application data:

```text
starting ──(first success within start-period+interval)──▶ healthy
   │                                                            │
   └──(3 consecutive non-2xx / connection failures)──▶ unhealthy ◀┘
```

- **starting → healthy**: first successful `wget` probe (SC-003: within 30s).
- **healthy → unhealthy**: `--retries=3` consecutive failures.
