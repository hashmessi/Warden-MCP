# Phase 06: Execute, Snapshot & Rollback - Context

**Gathered:** 2026-07-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the execution engine with pre-mutation snapshots and full rollback capability. This is the demo's climax — delete data, then restore it with audit trail intact.
</domain>

<decisions>
## Implementation Decisions

### Snapshot Storage Strategy
- **D-01:** Centralized Snapshot Table. Instead of creating `_snapshots` tables in every connected system (Postgres, MongoDB, Ledger), snapshots are serialized and stored centrally in a Postgres `snapshots` table. This dramatically simplifies the transaction boundary and rollback logic.

### Snapshot Serialization
- **D-02:** JSON-based Serialization. Records from all systems (including MongoDB objects and Payment Ledger rows) are stringified to JSON and stored in the central `snapshots` table alongside their original system name and record ID.

### Execution Transactionality
- **D-03:** Adapter-level error handling. The execution engine runs `snapshotRecords` across all adapters first. If any fail, it throws. If snapshots succeed, it runs `deleteRecords`. If any `deleteRecords` fails, it catches the error, triggers `rollbackAction`, and logs a failure audit event.

### Dashboard Rollback Trigger
- **D-04:** Node Script via Next.js API. The dashboard UI triggers rollbacks by calling an API route (`/api/approvals/[token]/rollback`), which in turn spawns a Node.js process to execute `npx tsx src/scripts/rollback.ts <executionId>`.

### The Agent's Discretion
- Code architecture for adapter registry and engine loop is already established.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Foundational
- `.planning/ROADMAP.md` — Phase 6 requirements and success criteria
- `.planning/REQUIREMENTS.md` — EXEC-01..06

### Existing Code Patterns (Already Implemented)
- `src/execution/engine.ts` — Core execution and rollback loop
- `src/adapters/postgres.adapter.ts` — Centralized snapshot queries
- `dashboard/app/api/approvals/[token]/rollback/route.ts` — Rollback API
</canonical_refs>
