<!--
Sync Impact Report
==================
Version change: (template / unratified) → 1.0.0
Rationale: Initial ratification of the FamiFinances constitution derived from the
approved product/feasibility definition (Notion "01 · Definición…") and PRD +
backlog (Notion "02 · PRD + Backlog…"), decision date 2026-07-15.

Modified principles: N/A (initial adoption)
Added principles:
  - I. Family Data Isolation (NON-NEGOTIABLE)
  - II. Financial Privacy by Design
  - III. Derived Balance Integrity
  - IV. Test-First & Definition of Done
  - V. Modular Monolith Simplicity (YAGNI)
  - VI. Shared, Documented Contracts
  - VII. Fast & Accessible Capture UX
Added sections:
  - Technology & Security Constraints
  - Development Workflow & Quality Gates
Removed sections: none

Templates reviewed for consistency:
  - .specify/templates/plan-template.md ✅ (generic "Constitution Check" gate;
    no hardcoded principle names; no change required)
  - .specify/templates/spec-template.md ✅ (no change required)
  - .specify/templates/tasks-template.md ✅ (no change required)
  - .specify/templates/checklist-template.md ✅ (no change required)
  - .claude/skills/speckit-* command files ✅ (use hyphenated /speckit-*
    references appropriate for Claude skills; no outdated agent-specific names)

Follow-up TODOs: none
-->

# FamiFinances Constitution

FamiFinances is a collaborative family finance MVP for the Chilean market: a family
records income, expenses, and transfers through fast assisted manual entry, and sees
its monthly budget (estimated vs. real) on a shared dashboard. The product does **not**
promise real-time bank balances — it presents the state derived from movements actually
recorded, always stamped with a "last updated" mark.

## Core Principles

### I. Family Data Isolation (NON-NEGOTIABLE)

The family is the privacy boundary and the owner of all financial data.

- A user belongs to exactly one family; families MUST never read or modify each other's data.
- Every financial query and mutation MUST derive the family scope from the authenticated
  session, NEVER from a family identifier supplied by the client.
- Roles MUST be enforced server-side: Owner administers members and configuration; Member
  records and consults shared data.
- Cross-family authorization tests are mandatory and MUST accompany any endpoint that touches
  family-scoped data. A feature is not done until these tests exist and pass.

**Rationale:** Cross-family leakage is rated a high risk in the product definition and is the
single most damaging failure mode for a shared-finance product.

### II. Financial Privacy by Design

Sensitive financial detail MUST NOT escape the system boundary through logs, telemetry, or
third-party tooling.

- Monetary amounts, notes, and sensitive identifiers MUST NEVER be written to error tools,
  analytics, or application logs. Observability captures product events and errors only.
- Passwords MUST use a robust hash; access tokens MUST be short-lived with secure renewal.
- Inputs MUST be validated at the backend; rate limits MUST be applied; secrets MUST live
  outside the repository.
- Data-in-transit encryption is required. Managed-storage defaults (e.g., Atlas TLS/AES-256)
  do not absolve the project from configuring access, backups, and operations correctly.
- Backups with a **tested restore** are a precondition before any external family joins the pilot.

**Rationale:** The product handles real household financial data; Chilean Law 21.719 takes
effect 2026-12-01 and requires a specific legal review before public launch.

### III. Derived Balance Integrity

Balances are computed, never stored as an editable source of truth.

- Account balance MUST be derived from its initial balance plus its movements. No editable
  balance field may act as the source of truth.
- A transfer MUST decrease the origin account and increase the destination account, and MUST
  NOT change income or expense totals (no double counting).
- An income category MUST NOT be usable on an expense, nor vice versa.
- Every movement MUST record its author, occurrence date, and creation date; edits and
  deletions MUST be controlled and auditable.

**Rationale:** Data accuracy is the product's core value proposition when there is no bank
sync; integrity rules protect the numbers the family trusts.

### IV. Test-First & Definition of Done

Tests are written alongside implementation, proportioned to risk, and gate delivery.

- Follow test-driven development: write tests with (ideally before) the implementation;
  authorization and money-movement logic MUST be covered.
- A user story is Done only when it: meets all its acceptance criteria; has tests appropriate
  to its risk; respects family isolation; exposes no financial data in logs; is documented in
  OpenAPI if it changes the API; is validated on a physical mobile device when it changes
  mobile UX; and introduces no capability outside the approved Must/Should scope.

**Rationale:** A solo developer on a 12-week horizon cannot rely on manual regression;
executable checks and an explicit DoD are the quality floor.

### V. Modular Monolith Simplicity (YAGNI)

Build the simplest architecture that delivers the value, and add complexity only when a
measured need justifies it.

- The system is a modular monolith. Microservices, WebSockets/live sync, and distributed
  architecture are OUT of scope and MUST NOT be introduced without a documented operational
  or business metric that justifies the split.
- Scope discipline is enforced via MoSCoW: Won't-have items (CSV import, bank sync, Gmail
  reading, credential storage, payments, conversational AI) MUST NOT be built in the MVP.
- Prefer vertical, shippable slices over horizontal scaffolding.

**Rationale:** Time and budget are the binding constraints; unnecessary architecture directly
threatens the delivery plan.

### VI. Shared, Documented Contracts

The mobile app and API agree through explicit, versioned, typed contracts.

- The REST API MUST be documented with OpenAPI; any API change updates that documentation.
- Shared types live in `packages/contracts` and are consumed by both `apps/mobile` and `apps/api`.
- TypeScript strict mode is mandatory; the `any` type is forbidden. Prefer named exports.
- Code MUST follow SOLID and a clean layered (hexagonal-friendly) structure within the monolith.

**Rationale:** A single developer benefits most from a shared contract that makes client/server
drift a compile-time error rather than a runtime surprise.

### VII. Fast & Accessible Capture UX

Recording a movement must be near-frictionless, and status must be readable by everyone.

- The add-movement flow asks for amount and type first; account, category, and date carry
  sensible defaults (last used account/category); frequent templates are provided.
- Status MUST NOT be communicated by color alone: always pair color with a monetary value, a
  text label, and an icon.
- All amounts MUST be formatted in CLP. Each screen SHOULD present one primary action.
- The UI MUST show a "last updated" mark and MUST NOT imply real-time bank balances.

**Rationale:** MVP accuracy depends on registration discipline; capture friction and unclear
status are the top adoption risks.

## Technology & Security Constraints

- **Mobile:** Expo + React Native + TypeScript + Expo Router (mobile-first, Android & iOS).
  Support the stable Expo version current at implementation start.
- **API:** NestJS, REST, OpenAPI.
- **Data:** MongoDB with Mongoose. Currency is CLP only for the MVP.
- **Repository:** simple monorepo — `apps/mobile`, `apps/api`, `packages/contracts`.
- **Tooling:** use pnpm (never npm or yarn) for package management.
- **Deployment:** Docker from the start; a managed container service for deployment.
- **Account types:** bank, digital wallet, cash, credit card. Institution labels (Santander,
  Banco Falabella, Mercado Pago, BCI, MACHBANK) are manual tags and MUST NOT be presented as
  a live integration with those institutions.
- **Regulatory:** a specific legal review against Chilean Law 21.719 is required before public
  launch; open-finance/bank integration requires provider, consent, commercial, and regulatory
  investigation before any date is committed.

## Development Workflow & Quality Gates

- **Commits:** English, conventional format (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`,
  `docs:`). Conversation may be in Spanish; code, comments, and commits are in English.
- **Constitution Check:** every plan (`/speckit-plan`) MUST pass the Constitution Check gate
  before Phase 0 and re-check after Phase 1 design; violations go in Complexity Tracking with
  justification or the design is simplified.
- **Delivery cadence:** work proceeds in the approved Must-first backlog order via vertical
  slices; Should items are deferred (not quality) when weekly capacity drops below plan.
- **Pilot gate:** the pilot is limited to 3–5 invited families and MUST NOT open until tested
  backups/restore and family-isolation tests are in place.
- **Automation gate:** no automation (bank sync, CSV, Gmail) is built until the MVP demonstrates
  activation, category coverage, and recurring budget use.

## Governance

This constitution supersedes other practices for the FamiFinances project. When guidance
conflicts, the constitution wins.

- **Amendments** MUST be proposed with a written rationale, reviewed, and versioned. Any
  amendment that changes behavior expected of code MUST include or reference the corresponding
  migration/impact note across dependent templates.
- **Versioning policy** (semantic):
  - MAJOR — backward-incompatible governance/principle removals or redefinitions.
  - MINOR — a new principle/section or materially expanded guidance.
  - PATCH — clarifications, wording, and non-semantic refinements.
- **Compliance review:** all PRs and reviews MUST verify compliance with these principles;
  added complexity MUST be justified against Principle V. Use the Spec Kit templates and the
  project's runtime guidance files for day-to-day development conventions.

**Version**: 1.0.0 | **Ratified**: 2026-07-15 | **Last Amended**: 2026-07-16
