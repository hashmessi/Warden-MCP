# Requirements: Warden

**Milestone:** v2.0 — 4-Week War Plan: Enterprise Hardening & Adversarial Resilience  
**Defined:** 2026-09-12  
**Core Value:** Every irreversible action requires a human decision, and every action — taken or undone — is independently auditable with cryptographic proof. The governance layer IS the product.

---

## Milestone v2.0 Scoped Requirements

### Week 1: Evaluation Harness & Measurable Invariants

- [x] **EVAL-01**: Comprehensive evaluation CLI harness executable via `npm run eval` producing structured terminal metrics
- [x] **EVAL-02**: Core Invariant 1: No data mutation can occur unless approval state is strictly valid and unconsumed
- [x] **EVAL-03**: Core Invariant 2: No duplicate or replayed execution can mutate state or create inconsistent audit records
- [x] **EVAL-04**: Core Invariant 3: Every executed mutation must be 100% restorable from its pre-execution snapshot
- [x] **EVAL-05**: Automated scenario test: NORMAL flow (valid deletion and multi-system purge verification)
- [x] **EVAL-06**: Automated scenario test: NO MATCH flow (non-existent subject handled gracefully with zero false positives)
- [x] **EVAL-07**: Automated scenario test: DUPLICATE flow (same request submitted twice handled idempotently)
- [x] **EVAL-08**: Automated scenario test: STALE TOKEN flow (expired or previously consumed token rejected)
- [x] **EVAL-09**: Automated scenario test: DENIED flow (denied execution request is permanently blocked from execution)
- [x] **EVAL-10**: Automated scenario test: DOUBLE APPROVAL & DOUBLE EXECUTION race conditions with lock serialization
- [x] **EVAL-11**: Automated scenario test: PARTIAL FAILURE (DB1 succeeds, DB2 fails -> compensation verified)
- [x] **EVAL-12**: Automated scenario test: ROLLBACK FAILURE (recovery failure handled with safe alert state)
- [x] **EVAL-13**: Automated scenario test: TAMPER detection (audit chain corruption detected and reported)
- [x] **EVAL-14**: Automated scenario test: CONCURRENT REQUESTS (simultaneous agent operations without deadlock)
- [x] **EVAL-15**: Evaluation scorecard reporting: Cases count, Passed, Failed, Critical failures, Rollback success %, Unauthorized exec, Duplicate exec, Audit tamper detection, and latency percentiles

### Week 2: Adversarial Threat Model & Attack Suite

- [ ] **ATTK-01**: Comprehensive threat model document created at `docs/THREAT_MODEL.md` detailing 4 attack classes
- [ ] **ATTK-02**: Agent Attack Suite: automated test harness simulating prompt injection, malicious tool arguments, fake approval intent, tool replay, stale token reuse, and privilege escalation
- [ ] **ATTK-03**: MCP Attack Suite: automated test harness simulating malicious tool descriptions, altered schemas, unexpected tool injection, capability drift, and tool-result tampering
- [ ] **ATTK-04**: Data Attack Suite: automated test harness simulating SQL injection attempts, identifier confusion, mass deletion payloads, cross-tenant access, corrupted snapshots, and corrupted rollbacks
- [ ] **ATTK-05**: Governance Attack Suite: automated test harness simulating approval bypass, forged approval tokens, approval racing, execution racing, and direct audit trail manipulation
- [ ] **ATTK-06**: Empirical Security Scorecard: report documenting results of 27 attack vectors (blocked vs remaining vulnerabilities with mitigation posture)

### Week 3: Production-Shaped Architecture

- [ ] **ARCH-01**: Role-based access control (RBAC) authorization layer replacing `X-Dashboard-Secret` (User -> Identity -> Role -> Policy -> Action)
- [ ] **ARCH-02**: Role permission matrix enforced on all routes: Viewer (read-only), Operator (scan/request), Approver (approve/deny), Admin (emergency controls/rollback)
- [ ] **ARCH-03**: Multi-approver quorum policy engine enforced by risk tier: LOW (1 approver), MEDIUM (1 approver), HIGH (2 approvers), CRITICAL (2-of-3 approvers)
- [ ] **ARCH-04**: Formalized execution state machine: `REQUESTED -> APPROVED -> EXECUTING -> EXECUTED -> ROLLED_BACK` with explicit validation rejecting invalid transitions (e.g. `EXECUTED -> APPROVED ❌`, `DENIED -> EXECUTING ❌`, `ROLLED_BACK -> EXECUTING ❌`)
- [ ] **ARCH-05**: Execution idempotency keys preventing concurrent or duplicate execution requests
- [ ] **ARCH-06**: Distributed partial failure compensation engine: when System A & B succeed but System C fails, trigger compensating rollback of A & B while preserving C
- [ ] **ARCH-07**: Failure matrix test suite validating 10+ distributed failure and compensation combinations across Postgres, MongoDB, and payment ledger

### Week 4: AI-Native Control Layer & Governed Autonomy Boundary

- [ ] **AGNT-01**: Controlled AI agent orchestration layer utilizing Warden MCP tools (Claude / GPT / Gemini client adapter)
- [ ] **AGNT-02**: Strict capability boundary: model can inspect, scan, and request impact analysis, but has ZERO destructive mutation authority
- [ ] **AGNT-03**: Governed operational loop: Agent scans -> explains risk -> requests approval -> WAITS for human quorum -> triggers approved execution -> verifies & reports
- [ ] **AGNT-04**: End-to-end governed autonomy verification demonstrating that adversarial model outputs cannot bypass governance gates
- [ ] **AGNT-05**: Telemetry and evaluation pipeline connecting agent actions directly to the SHA-256 audit log and evaluation scorecard

---

## Validated Requirements (v1.0 Milestone)

- [x] **DISC-01..05**: Multi-system data discovery across Postgres, MongoDB, and payment ledger (Phase 3)
- [x] **IMPT-01..04**: Blast-radius impact report with downstream dependency analysis and risk scoring (Phase 4)
- [x] **APPR-01..05**: Human-in-the-loop approval gate with single-use tokens and dashboard UI (Phase 5)
- [x] **EXEC-01..06**: Transactional execution, pre-execution snapshotting, and full rollback across all systems (Phase 6)
- [x] **AUDT-01..05**: SHA-256 hash-chained tamper-evident audit log with verification endpoint (Phase 2, 7)
- [x] **DASH-01..07**: Dark-mode ops console with live audit feed and interactive demo flow (Phase 5, 7)
- [x] **MCP-01..06**: MCP server protocol compliance with 5 core tools and HTTP health endpoint (Phase 3, 8)
- [x] **INFR-01..05**: Multi-system synthetic data seeding and Docker Compose setup (Phase 1)

---

## Out of Scope (v2.0 Milestone)

| Feature | Reason |
|---|---|
| Enterprise IdP vendor integration (Okta, Auth0) | Modular RBAC architecture with local identity stub demonstrates production pattern without external SaaS account requirements |
| Production Stripe API billing integration | Mock payment ledger demonstrates distributed 3-system transaction pattern without payment credentials |
| Autonomous un-gated deletion | Fundamental violation of Warden's core value proposition |
| Consumer mobile app | Warden is a DevOps / compliance ops control plane |

---

## Traceability Matrix

| Requirement | Phase | Status |
|---|---|---|
| EVAL-01..15 | Phase 8 (Week 1) | ✅ Complete |
| ATTK-01..06 | Phase 9 (Week 2) | ⏳ Planned |
| ARCH-01..07 | Phase 10 (Week 3) | ⏳ Planned |
| AGNT-01..05 | Phase 11 (Week 4) | ⏳ Planned |
