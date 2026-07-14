# Architecture Research: Warden MCP Data-Rights Agent

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP CLIENT (Claude, Cursor, etc.)         │
│                    ↕ MCP Protocol (stdio/SSE)               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              WARDEN MCP SERVER (TypeScript)             │  │
│  │                                                         │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │  │
│  │  │scan_     │  │generate_ │  │request_  │  │execute_│ │  │
│  │  │subject   │  │impact_   │  │execution │  │approved│ │  │
│  │  │          │  │report    │  │          │  │_action │ │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘ │  │
│  │       │              │              │              │      │  │
│  │  ┌────┴──────────────┴──────────────┴──────────────┴──┐ │  │
│  │  │              CORE SERVICE LAYER                     │ │  │
│  │  │                                                      │ │  │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │ │  │
│  │  │  │ DataScanner │  │ ImpactEngine│  │ Executor   │    │ │  │
│  │  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘    │ │  │
│  │  │        │                │                │           │ │  │
│  │  │  ┌─────┴────────────────┴────────────────┴───────┐  │ │  │
│  │  │  │            DATA ADAPTER LAYER                  │  │ │  │
│  │  │  │  ┌──────┐  ┌──────┐  ┌─────────────┐         │  │ │  │
│  │  │  │  │ PG   │  │ Mongo│  │ MockPayment │         │  │ │  │
│  │  │  │  │Adapter│  │Adapter│ │ Adapter     │         │  │ │  │
│  │  │  │  └──┬───┘  └──┬───┘  └─────┬───────┘         │  │ │  │
│  │  │  └─────┼──────────┼────────────┼─────────────────┘  │ │  │
│  │  │        │          │            │                     │ │  │
│  │  └────────┼──────────┼────────────┼─────────────────────┘ │  │
│  │           │          │            │                        │  │
│  │  ┌────────┼──────────┼────────────┼─────────────────────┐ │  │
│  │  │   CROSS-CUTTING CONCERNS                             │ │  │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │ │  │
│  │  │  │ AuditLogger  │  │ SnapshotMgr  │  │ ApprovalQ │  │ │  │
│  │  │  │ (hash chain) │  │ (pre-exec)   │  │ (pending) │  │ │  │
│  │  │  └──────────────┘  └──────────────┘  └───────────┘  │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  DATABASES                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────────┐ │
│  │ Postgres │  │ MongoDB  │  │ MockPay  │  │ Audit Log       │ │
│  │ (users,  │  │ (sessions│  │ (ledger) │  │ (append-only    │ │
│  │ profiles,│  │  logs)   │  │          │  │  hash-chained)  │ │
│  │ orders)  │  │          │  │          │  │                 │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────────────┘ │
├──────────────────────────────────────────────────────────────────┤
│  DASHBOARD (Next.js)                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────────┐ │
│  │ Pending  │  │ Blast    │  │ Approve/ │  │ Audit Log       │ │
│  │ Requests │  │ Radius   │  │ Deny/    │  │ Feed + Verify   │ │
│  │ List     │  │ Viewer   │  │ Rollback │  │ Button          │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## Component Boundaries

### 1. MCP Server Layer (Tool Definitions)
- Thin layer — maps MCP tool calls to core service methods
- Handles input validation (zod schemas)
- Returns structured MCP responses
- **Talks to:** Core Service Layer only

### 2. Core Service Layer
- Business logic — orchestration, state transitions
- `DataScanner`: Fan-out queries across all adapters, aggregate results
- `ImpactEngine`: Analyze scan results, generate blast radius (template + optional LLM)
- `Executor`: Manage approval tokens, execute mutations, trigger snapshots
- **Talks to:** Data Adapters, Cross-Cutting Concerns

### 3. Data Adapter Layer
- Uniform interface for heterogeneous databases
- Each adapter implements: `findByIdentifier()`, `deleteRecords()`, `getSchema()`
- Adapter pattern allows adding new data sources without changing core logic
- **Talks to:** Actual database connections

### 4. Cross-Cutting Concerns
- `AuditLogger`: Hash-chained append-only log — used by ALL operations
- `SnapshotManager`: Copy affected rows to snapshot tables before mutation
- `ApprovalQueue`: Pending action state management + approval tokens

### 5. Dashboard (Separate Process)
- Next.js app — calls MCP server or exposes its own REST API
- Polling-based live feed (React Query)
- Approval actions trigger `execute_approved_action` MCP tool

## Data Flow

```
1. SCAN:     Client → scan_subject(email) → DataScanner → [PG, Mongo, MockPay] → AuditLog → Results
2. IMPACT:   Client → generate_impact_report(scan_id) → ImpactEngine → Template+LLM → AuditLog → Report
3. REQUEST:  Client → request_execution(scan_id, action) → ApprovalQueue → AuditLog → PendingToken
4. APPROVE:  Dashboard → execute_approved_action(token) → SnapshotMgr → Executor → AuditLog → Done
5. ROLLBACK: Dashboard → rollback_action(exec_id) → SnapshotMgr.restore() → AuditLog → Restored
```

## Build Order (dependency-driven)

1. **Database seeding + adapters** (foundation — nothing works without data)
2. **Audit logger** (cross-cutting — needed by everything else)
3. **MCP server skeleton + scan tool** (first demoable feature)
4. **Impact engine** (builds on scan results)
5. **Approval gate + dashboard** (most judge-facing surface)
6. **Execute + snapshot + rollback** (the climax)
7. **Integrity verification** (polish — 10-minute feature)

---
*Researched: 2026-07-14*
