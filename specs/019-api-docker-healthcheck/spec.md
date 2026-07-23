# Feature Specification: Fix API Docker Build and Health Check (FAM-25)

**Feature Branch**: `019-api-docker-healthcheck`

**Created**: 2026-07-22

**Status**: Draft

**Input**: User description: "FAM-25 https://soyfmbetancourt.atlassian.net/browse/FAM-25"

## Clarifications

### Session 2026-07-22

- Q: Should `/health` be a lightweight liveness check or deep probe? → A: Lightweight liveness check (`{"status": "ok"}`) verifying API app process responsiveness without blocking on external database connectivity.
- Q: Which tool/command should be used for the Docker `HEALTHCHECK` in `apps/api/Dockerfile`? → A: `wget` command (`wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1`) leveraging Alpine BusyBox built-in utilities.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reliable API Container Image Build (Priority: P1)

As a developer or CI/CD pipeline, I want `apps/api/Dockerfile` to successfully build the API container image using pnpm workspace dependencies, so that containerized deployments can be produced without build-stage binary resolution failures (such as `nest: not found`).

**Why this priority**: Without a working Dockerfile build, container images cannot be compiled, preventing deployment to staging or production environments.

**Independent Test**: Can be fully tested by executing `docker build -t famifinances-api -f apps/api/Dockerfile .` from the repository root and verifying zero-error completion.

**Acceptance Scenarios**:

1. **Given** a clean repository workspace with `pnpm-lock.yaml`, **When** `docker build` is executed targeting `apps/api/Dockerfile`, **Then** the multi-stage build completes all stages (`deps`, `build`, `runtime`) successfully without missing binary errors.
2. **Given** a built runtime container image, **When** starting the container via `docker run`, **Then** the API process boots cleanly using Node.js v24.x runtime.

---

### User Story 2 - Container Health Monitoring & Probe Endpoint (Priority: P2)

As an infrastructure operator, load balancer, or container orchestrator, I want the NestJS API application to expose an unauthenticated health status endpoint and include a Docker `HEALTHCHECK` directive, so that container readiness and runtime health can be verified automatically.

**Why this priority**: Health checks are necessary for container orchestration, zero-downtime deployments, and automated container restarts upon failure.

**Independent Test**: Can be tested by running the container, issuing an HTTP GET request to `/health`, and verifying Docker container status via `docker inspect --format='{{json .State.Health.Status}}'`.

**Acceptance Scenarios**:

1. **Given** a running API container instance, **When** an HTTP GET request is sent to `/health`, **Then** the API returns HTTP 200 OK status with a JSON payload indicating healthy status (e.g., `{"status": "ok"}`).
2. **Given** a running container with Docker `HEALTHCHECK` configured, **When** the health check interval elapses, **Then** Docker evaluates the container status as `healthy`.

---

### Edge Cases

- What happens if `@famifinances/contracts` is required during the build step? The build stage must execute topological builds (`contracts` before `api`) with all workspace package binaries available.
- How does the health check endpoint behave during startup or under database connection loss? The endpoint should respond promptly with HTTP 200 OK for operational process readiness.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `build` stage in `apps/api/Dockerfile` MUST have access to executable binaries in workspace package `node_modules` (specifically `apps/api/node_modules/.bin/nest` or pnpm workspace resolution) required to compile `@famifinances/api`.
- **FR-002**: Multi-stage Docker build MUST compile dependent packages (`@famifinances/contracts`) prior to building `@famifinances/api`.
- **FR-003**: The NestJS API MUST expose an unauthenticated HTTP GET `/health` endpoint returning a lightweight liveness payload (`{"status": "ok"}`) without blocking on external database connections.
- **FR-004**: `apps/api/Dockerfile` runtime stage MUST declare a `HEALTHCHECK` instruction querying `/health` using Alpine BusyBox `wget` (`wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1`).
- **FR-005**: The runtime container image MUST remain lean, keeping unnecessary build tools out of the final production image layer.

### Key Entities

- **HealthStatus**: Represents API runtime **liveness**. The response payload is exactly `{"status":"ok"}` — a single `status` indicator. Timestamps and per-dependency (e.g., database) availability details are intentionally **out of scope** for this liveness probe, per FR-003 and the Session 2026-07-22 clarification (a deep/readiness probe is deferred, YAGNI).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `docker build -t famifinances-api -f apps/api/Dockerfile .` completes with exit code 0.
- **SC-002**: HTTP GET `/health` returns HTTP 200 OK within 200ms when container is running.
- **SC-003**: `docker inspect` shows container health status as `"healthy"` within 30 seconds of startup.

## Assumptions

- **Base Image**: Uses `node:24.18.0-alpine` per monorepo container standards.
- **Package Manager**: pnpm workspace is used for dependency management and workspace filtering.
- **Authentication**: `/health` endpoint is explicitly public and bypassed by authentication guards.
- **API Documentation (Constitution VI)**: `/health` is an operational **liveness** endpoint that lives outside the versioned business API (`/api/v1`) and is intentionally **NOT** published in the OpenAPI/Swagger surface consumed by the mobile client. This is an explicit, accepted scoping decision — Principle VI's OpenAPI mandate governs the mobile↔API contract, which this ops/orchestrator endpoint is not part of.
- **Container Port**: The API image standardizes on port **3000** (`EXPOSE 3000`); the in-container `HEALTHCHECK` targets `localhost:3000` accordingly. Overriding `PORT` inside the container is **not supported** for this image (an external orchestrator maps host ports instead). FR-004's literal `:3000` command is therefore intentional.
