# Phase 1: Foundation & Data Layer — Context

**Gathered:** 2026-07-15  
**Status:** Ready for planning  
**Source:** Strategic analysis of roadmap + REQUIREMENTS.md + strategic summary (Mcp-proj-roadmap.md)

<domain>
## Phase Boundary

Phase 1 delivers the project scaffold and all infrastructure that subsequent phases depend on. No MCP tools are exposed in this phase — just reliable database connections, typed interfaces, and demo-ready seed data.

**Delivers:**
- TypeScript project with full dependency set (MCP SDK, pg, mongodb, zod, faker)
- Docker Compose for Postgres 16 + MongoDB 7 with health checks
- Three DataAdapter implementations (Postgres, MongoDB, mock payment ledger)
- Seed data: ~500 synthetic users with jane.doe@email.com scattered across all 3 systems
- Audit log table schema (empty — populated by Phase 2)

**Does NOT deliver:**
- Any MCP tools or server transport
- Audit logging logic (Phase 2)
- HTTP endpoints or dashboard (Phase 5)

</domain>

<decisions>
## Implementation Decisions

### Language & Runtime
- TypeScript 5.x with `"moduleResolution": "NodeNext"` and `"strict": true`
- Node.js 22 LTS (built-in crypto for Phase 2's SHA-256 hashing)
- `tsx` for dev-time execution, `tsc` for production builds

### Database Configuration
- Postgres 16 Alpine (smallest footprint, production-realistic version)
- MongoDB 7 (current LTS)
- Mock payment ledger: in-memory JSON (no SQLite overhead — simpler, fast, sufficient)

### Adapter Interface Design
- Single `DataAdapter` interface with 4 methods: `findByIdentifier`, `deleteRecords`, `getSchema`, `ping`
- `ScanResult` and `DataHit` types designed to serve Phase 3 fan-out exactly
- `hasOrphanRisk` + `orphanDetails` fields built into `DataHit` — feeds Phase 4 impact reports directly

### Seed Strategy
- 3 named demo users (jane.doe, john.smith, bob.wilson) + ~497 synthetic users
- Batch inserts (50 rows per batch) to stay under 5s seed time
- Idempotent: clears all rows before reinserting

### the agent's Discretion
- `createAdapterRegistry()` barrel function in `src/adapters/index.ts` — allows Phase 3 to iterate adapters without importing each one
- `.env.example` includes commented-out LLM keys for Phase 4 (forward-thinking, zero cost now)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Design
- `.planning/ROADMAP.md` — Phase boundaries and success criteria
- `.planning/REQUIREMENTS.md` — Full requirement IDs (INFR-01..05 for this phase)
- `.planning/STATE.md` — Technology decisions made at project init

### Strategic Context
- `Mcp-proj-roadmap (1).md` — Strategic framing, demo script, scoring alignment

### Research
- `.planning/phases/01-foundation-data-layer/01-RESEARCH.md` — Detailed schema SQL, adapter interface design, seed strategy

</canonical_refs>

<specifics>
## Specific Implementation Notes

- Jane Doe must have 2 active Postgres subscriptions — this is what creates the "3 active subscriptions will be orphaned" narrative in Phase 4
- The `audit_log` table must be created in Phase 1 (schema defined here) but remains empty — Phase 2 writes to it
- `src/adapters/types.ts` is the single source of truth for shared types — ALL phases import from here
- NodeNext module resolution requires `.js` extensions on all local imports (e.g., `import { query } from "../db/postgres.js"`)

</specifics>

<deferred>
## Deferred Ideas

- Real Stripe API integration → Explicitly out of scope (mock demonstrates pattern)
- Auth/identity system → Hardcoded admin role, mention Okta/Descope in Phase 5
- WebSockets for real-time → React Query polling in Phase 5
- Multi-tenancy → v2 backlog

</deferred>

---

*Phase: 01-foundation-data-layer*  
*Context gathered: 2026-07-15*
