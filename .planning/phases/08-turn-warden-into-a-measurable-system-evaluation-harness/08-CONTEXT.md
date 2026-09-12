# Phase 8: Turn Warden into a Measurable System (Evaluation Harness) - Context

**Gathered:** 2026-09-13  
**Status:** Ready for planning  
**Learning Guide:** [08-LEARNING.md](file:///c:/Users/Hashvanth/OneDrive/Desktop/MCP-proj/.planning/phases/08-turn-warden-into-a-measurable-system-evaluation-harness/08-LEARNING.md)

<domain>
## Phase Boundary

Build a production-grade, automated Evaluation Harness CLI (`npm run eval`) that shifts Warden from "it works" anecdotal claims to quantifiable, invariant-verified guarantees. The harness evaluates 11 critical edge, failure, race condition, and tamper scenarios across all three connected data stores (Postgres, MongoDB, mock ledger), enforcing core governance invariants and generating an empirical terminal scorecard plus persisted evaluation reports.
</domain>

<decisions>
## Implementation Decisions

### 1. Eval Harness Runner Architecture
- **D-01:** Build a lightweight, native TypeScript invariant runner at `src/eval/index.ts` invoked via `npm run eval`.
- **D-02:** Zero external test framework dependencies (no heavy Vitest/Jest setup required). Native `tsx` execution guarantees clean ESM handling, programmatic concurrency control, precise microsecond latency tracking, and isolation from standard dev server processes.

### 2. State Isolation & Test Seeding
- **D-03:** Use dynamic, isolated per-scenario subject identities formatted as `eval-<scenario>-<uuid>@warden.test`.
- **D-04:** Each evaluation scenario dynamically seeds its required records across PostgreSQL, MongoDB, and the payment ledger, executes its test cases, verifies invariants, and performs clean tear-down.
- **D-05:** Main seeded demo account (`jane.doe@email.com`) remains 100% untouched so developer demo environments are never corrupted during evaluation runs.

### 3. Fault Injection Strategy
- **D-06:** Implement a transparent `FaultInjectionAdapter` proxy wrapper around the standard `DataAdapter` interface.
- **D-07:** Scenarios declaratively configure simulated failures (e.g., throwing during `deleteRecords` on MongoDB while Postgres succeeds, or failing during snapshot restoration) without polluting production adapter logic with test conditionals.

### 4. Scorecard & Metrics Output
- **D-08:** Scorecard renders a clean ANSI terminal table displaying:
  - Total cases, Passed, Failed, and Critical failures
  - Rollback success rate percentage
  - Unauthorized execution count (must be 0)
  - Duplicate execution count (must be 0)
  - Audit tamper detection status (`detected` / `undetected`)
  - Latency breakdown (p50 and p95 in ms)
- **D-09:** Persist structured JSON and Markdown reports to `.eval-results/latest.json` and `.eval-results/latest.md` for historical trend tracking and CI/CD pipelines.

### Core Invariants Enforced
- **INV-01 (Authorization Gate):** No mutation can occur unless the approval state is strictly valid, unconsumed, and authenticated.
- **INV-02 (Execution Idempotency):** No duplicate execution or replay token can mutate data or create disjoint audit records.
- **INV-03 (Reversibility Guarantee):** Every executed mutation must be 100% restorable from its pre-execution snapshot.
- **INV-04 (Tamper-Evidence):** Any out-of-band modification to prior audit log entries must trigger a chain integrity violation.

### 11 Evaluated Scenarios
1. **NORMAL:** Valid deletion across all 3 systems, snapshot recorded, verified purged, rollback verified.
2. **NO MATCH:** Subject does not exist across systems; scanner returns clean zero-hit response without error.
3. **DUPLICATE:** Multiple requests for the same subject/action handled idempotently without redundant locks.
4. **STALE TOKEN:** Expired or already-used approval tokens immediately rejected by execution engine.
5. **DENIED:** Explicitly rejected execution request permanently blocks any subsequent execution attempt.
6. **DOUBLE APPROVAL:** Concurrent race condition attempting to approve the same pending token twice; only one succeeds.
7. **DOUBLE EXECUTION:** Concurrent race condition attempting to execute the same approved token twice; exactly one executes.
8. **PARTIAL FAILURE:** System 1 (Postgres) succeeds, System 2 (MongoDB) fails; execution aborts, compensation triggered, state reported as partial failure.
9. **ROLLBACK FAILURE:** Simulated failure during snapshot restoration enters explicit critical failure state and alerts audit logger.
10. **TAMPER:** Corrupting a previous audit record in Postgres causes `verifyIntegrity()` to detect chain break immediately.
11. **CONCURRENT REQUESTS:** Multiple simulated agents issuing simultaneous scan, impact, and approval requests without connection starvation or deadlocks.
</decisions>

<canonical_refs>
## Canonical References

- `src/scanner.ts` — Multi-system scanner implementation
- `src/execution/engine.ts` — Snapshot, execute, and rollback engine
- `src/approval/store.ts` — Postgres-backed approval store and status transitions
- `src/audit/logger.ts` — SHA-256 hash chain audit logger
- `src/adapters/types.ts` — DataAdapter interface contract
- `src/scripts/verify-e2e.ts` — Existing baseline E2E verification script
- `docs/THREAT_MODEL.md` (Upcoming Phase 9) — Adversarial threat vectors informing evaluation boundaries
</canonical_refs>
