# Roadmap: Warden

**Created:** 2026-07-14
**Milestone:** v1.0 — Governed Data-Rights Execution Agent
**Phases:** 7
**Granularity:** Standard

## Phase Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Foundation & Data Layer | Project scaffold, database setup, seed data, adapter interfaces | INFR-01..05 | 5 |
| 2 | Audit Logger (Hash Chain) | Tamper-evident append-only audit log with SHA-256 hash chaining | AUDT-01..03 | 4 |
| 3 | MCP Server & Data Scanner | MCP server skeleton + multi-system scan tool | MCP-01, MCP-06, DISC-01..05 | 5 |
| 4 | Impact Report Engine | Blast-radius analysis with hybrid template + LLM enrichment | IMPT-01..04, MCP-02 | 4 |
| 5 | Approval Gate & Dashboard | Human-in-the-loop approval workflow + ops console UI | APPR-01..05, MCP-03, DASH-01..03, DASH-07 | 5 |
| 6 | Execute, Snapshot & Rollback | Pre-execution snapshots, data deletion/anonymization, and full rollback | EXEC-01..06, MCP-04, MCP-05, DASH-04 | 5 |
| 7 | Integrity Verification & Polish | Audit chain verification, live log feed, error handling, demo readiness | AUDT-04..05, DASH-05..06 | 4 |

---

## Phase Details

### Phase 1: Foundation & Data Layer
**Goal:** Set up the project scaffold with TypeScript, configure database connections (Postgres + MongoDB + mock payment ledger), create data adapters with uniform interfaces, and seed all databases with rich synthetic data that tells a demoable story.

**Requirements:** INFR-01, INFR-02, INFR-03, INFR-04, INFR-05

**UI hint**: no

**Success criteria:**
1. TypeScript project compiles with MCP SDK, pg, mongodb dependencies installed
2. Docker Compose starts Postgres + MongoDB with health checks passing
3. Data adapter interface defined with `findByIdentifier()`, `deleteRecords()`, `getSchema()` methods — implementations for PG, Mongo, MockPayment
4. Seed script populates ~500 rows across 4-5 Postgres tables, MongoDB sessions/logs collection, and mock payment entries — completes in < 5 seconds
5. At least one "interesting" user (e.g., jane.doe@email.com) has data scattered across all 3 systems with orphan-able billing records

---

### Phase 2: Audit Logger (Hash Chain)
**Goal:** Build the tamper-evident, append-only audit log with SHA-256 hash chaining. This is the cross-cutting foundation — every subsequent feature writes to this log.

**Requirements:** AUDT-01, AUDT-02, AUDT-03

**UI hint**: no

**Success criteria:**
1. Audit entries are appended to a dedicated Postgres table with columns: id, timestamp, action, actor, details, prev_hash, hash
2. Each entry's hash = SHA-256(canonicalized_entry_data + prev_hash) — verified by automated test
3. Identifiers stored in audit entries are hashed/anonymized (not raw PII) — verified by inspection
4. Attempting to insert with incorrect prev_hash fails — hash chain integrity enforced at insert time

---

### Phase 3: MCP Server & Data Scanner
**Goal:** Stand up the MCP server skeleton with stdio transport and implement the `scan_subject` tool — the first demoable feature. Fan-out queries across all connected data stores and return aggregated, structured results.

**Requirements:** MCP-01, MCP-06, DISC-01, DISC-02, DISC-03, DISC-04, DISC-05

**UI hint**: no

**Success criteria:**
1. MCP server starts successfully via stdio transport and is discoverable by MCP Inspector
2. `scan_subject("jane.doe@email.com")` returns structured hits from Postgres, MongoDB, and mock payment ledger
3. Each hit includes: source system, table/collection name, row count, field sensitivity tags
4. Scan action is logged to the audit trail with hash chain intact
5. No stdout pollution — all debug output goes to stderr only

---

### Phase 4: Impact Report Engine
**Goal:** Build the blast-radius analysis engine that transforms raw scan results into a human-readable impact report. Uses deterministic templates with optional LLM enrichment for narrative polish.

**Requirements:** IMPT-01, IMPT-02, IMPT-03, IMPT-04, MCP-02

**UI hint**: no

**Success criteria:**
1. `generate_impact_report(scan_id)` produces a structured report with sections: data found, downstream dependencies, risk level, recommended action
2. Report correctly identifies downstream breaks (e.g., "3 active subscriptions reference this user — deleting will orphan billing records")
3. Template-based output works without any LLM API key configured (deterministic fallback)
4. With LLM enrichment enabled, report includes plain-English narrative summary

---

### Phase 5: Approval Gate & Dashboard
**Goal:** Build the human-in-the-loop approval workflow and the ops console dashboard. This is the most judge-facing surface — pending requests, blast radius display, approve/deny buttons, professional design.

**Requirements:** APPR-01, APPR-02, APPR-03, APPR-04, APPR-05, MCP-03, DASH-01, DASH-02, DASH-03, DASH-07

**UI hint**: yes

**Success criteria:**
1. `request_execution(scan_id, "delete")` creates a pending action with unique approval token — does NOT execute any mutation
2. Dashboard displays pending requests with status badges (pending/approved/denied/executed/rolled-back)
3. Clicking "Approve" transitions the request to approved state; clicking "Deny" transitions to denied — both logged to audit trail
4. Double-approve attempt returns "already processed" — idempotent single-use tokens verified
5. Dashboard has professional ops-console aesthetic — status colors, clear hierarchy, responsive layout (not a CLI pretending to be a UI)

---

### Phase 6: Execute, Snapshot & Rollback
**Goal:** Build the execution engine with pre-mutation snapshots and full rollback capability. This is the demo's climax — delete data, then restore it with audit trail intact.

**Requirements:** EXEC-01, EXEC-02, EXEC-03, EXEC-04, EXEC-05, EXEC-06, MCP-04, MCP-05, DASH-04

**UI hint**: yes

**Success criteria:**
1. `execute_approved_action(token)` snapshots all affected rows to `_snapshots` tables before any mutation
2. Execution deletes/anonymizes user data across all connected systems — verified by re-scanning
3. Execution is transactional — partial failure rolls back all systems
4. `rollback_action(execution_id)` restores all data from snapshot — verified by re-scanning and comparing with pre-deletion state
5. Dashboard shows Rollback button for completed executions — clicking triggers full restore with audit log entry

---

### Phase 7: Integrity Verification & Polish
**Goal:** Add audit log integrity verification (the "verify chain" button), live audit log feed in dashboard, error handling for edge cases, and demo readiness polish.

**Requirements:** AUDT-04, AUDT-05, DASH-05, DASH-06

**UI hint**: yes

**Success criteria:**
1. "Verify Integrity" button walks the entire hash chain and displays green/red per entry
2. Deliberately tampering with one audit entry causes all subsequent entries to show red — verified in demo
3. Dashboard shows live-updating audit log feed with action type, timestamp, actor, and hash snippet
4. Edge cases handled gracefully: scan finds nothing, double-approve attempt, rollback of non-existent execution

---
*Roadmap created: 2026-07-14*
*Last updated: 2026-07-14 after initial creation*
