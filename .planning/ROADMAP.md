# Roadmap: Warden

**Created:** 2026-09-12  
**Milestone:** v2.0 — 4-Week War Plan: Enterprise Hardening & Adversarial Resilience  
**Phases:** 4 (Phases 8–11)  
**Granularity:** Standard  

---

## Phase Overview

| # | Week | Phase | Goal | Requirements | Status | Success Criteria |
|---|---|---|---|---|---|---|
| 8 | Week 1 | Turn Warden into a Measurable System | Build evaluation harness (`npm run eval`), 11 automated failure scenarios, core invariant checks, and terminal scorecard | EVAL-01..15 | ✅ Complete | 4/4 |
| 9 | Week 2 | Break Warden (Adversarial Attack Suite) | Threat model (`docs/THREAT_MODEL.md`) and 27-case empirical attack test suite across 4 attack classes | ATTK-01..06 | ⏳ Planned | 4 |
| 10 | Week 3 | Production-Shaped Architecture | RBAC authorization, multi-approver quorum policy, formal state machine, and distributed compensation engine | ARCH-01..07 | ⏳ Planned | 4 |
| 11 | Week 4 | AI-Native Control Layer | Governed autonomous agent orchestration with strict capability boundary and end-to-end evaluation pipeline | AGNT-01..05 | ⏳ Planned | 4 |

---

## Phase Details

### Phase 8: Week 1 — Turn Warden into a Measurable System (Evaluation Harness)

**Goal:** Transform Warden from an anecdotal "it works" demonstration into an empirical, measurable system with a dedicated Evaluation Harness CLI (`npm run eval`), invariant verification, 11 automated edge/failure scenarios, and a structured scorecard.

**Requirements:** EVAL-01, EVAL-02, EVAL-03, EVAL-04, EVAL-05, EVAL-06, EVAL-07, EVAL-08, EVAL-09, EVAL-10, EVAL-11, EVAL-12, EVAL-13, EVAL-14, EVAL-15

**UI hint:** no (CLI harness)

**Success criteria:**
1. Running `npm run eval` executes an automated evaluation runner covering all 11 failure/edge scenarios (Normal, No Match, Duplicate, Stale Token, Denied, Double Approval race, Double Execution race, Partial Failure, Rollback Failure, Audit Tamper, Concurrent Requests).
2. Core invariants verified: zero unauthorized executions permitted, zero duplicate executions, 100% rollback success rate for valid snapshots, and instant audit tamper detection.
3. Automated test suite executes without requiring manual UI clicks or interactive input.
4. Structured scorecard printed to stdout with exact metrics: total cases, pass/fail counts, critical failures, rollback success rate, unauthorized execution count, duplicate execution count, audit tamper status, and p50/p95 latency breakdown.

---

### Phase 9: Week 2 — Break Warden (Adversarial Threat Model & Attack Suite)

**Goal:** Attack Warden systematically across 4 attack classes (Agent, MCP, Data, and Governance attacks) to produce `docs/THREAT_MODEL.md` and an automated 27-attack empirical test suite.

**Requirements:** ATTK-01, ATTK-02, ATTK-03, ATTK-04, ATTK-05, ATTK-06

**UI hint:** no (Security documentation & test suite)

**Success criteria:**
1. `docs/THREAT_MODEL.md` document created outlining comprehensive attack surface across 4 classes: Agent attacks, MCP attacks, Data attacks, and Governance attacks.
2. Automated adversarial test harness attempts all 27 attack vectors against the live server and APIs.
3. Attack defenses verified: prompt injections cannot manipulate tool schemas, SQL injections cannot bypass Postgres queries, forged approval tokens are rejected, and audit log manipulations are flagged.
4. Empirical attack scorecard published detailing blocked vs remaining attack vectors with mitigation roadmap.

---

### Phase 10: Week 3 — Production-Shaped Architecture

**Goal:** Eliminate architectural limitations by building a 4-tier RBAC authorization layer, risk-tiered multi-approver quorum policies, a formal execution state machine with invalid transition guards, and an automated distributed compensation engine.

**Requirements:** ARCH-01, ARCH-02, ARCH-03, ARCH-04, ARCH-05, ARCH-06, ARCH-07

**UI hint:** yes (Dashboard multi-approver and role-based views)

**Success criteria:**
1. Role-based access control (RBAC) layer enforces Viewer, Operator, Approver, and Admin permissions on all dashboard views and mutating API routes.
2. Multi-approver quorum engine enforces approval requirements based on blast-radius risk tier: LOW (1 approver), MEDIUM (1 approver), HIGH (2 approvers), CRITICAL (2-of-3 approvers).
3. Formal execution state machine enforces valid state progression (`REQUESTED -> APPROVED -> EXECUTING -> EXECUTED -> ROLLED_BACK`) and rejects invalid transitions with idempotency keys.
4. Distributed partial failure compensation engine automatically rolls back successful operations when a partial failure occurs across Postgres, MongoDB, or the ledger, validated against 10+ failure matrix tests.

---

### Phase 11: Week 4 — AI-Native Control Layer & Governed Autonomy Boundary

**Goal:** Build the controlled AI agent orchestration layer above Warden where autonomous models (Claude / GPT / Gemini) can analyze data and request operations, while Warden strictly gates, authorizes, and executes all destructive actions.

**Requirements:** AGNT-01, AGNT-02, AGNT-03, AGNT-04, AGNT-05

**UI hint:** yes (Agent interaction feed & governance telemetry)

**Success criteria:**
1. Controlled AI agent layer connects to Warden MCP server to perform end-to-end data-rights workflows (scan -> impact report -> explain risk -> request execution).
2. Strict capability boundary verified: AI model has zero direct execution authority and cannot trigger data mutation without human quorum approval.
3. Adversarial agent test verifies that even a compromised or prompt-injected model cannot bypass the approval gate.
4. Agent governance telemetry streams decisions to the SHA-256 audit log and reports metrics directly into the evaluation scorecard.

---

## Milestone v1.0 History (Phases 1–7)

| # | Phase | Status | Completed |
|---|---|---|---|
| 1 | Foundation & Data Layer | ✅ Complete | 2026-07-19 |
| 2 | Audit Logger (Hash Chain) | ✅ Complete | 2026-07-19 |
| 3 | MCP Server & Data Scanner | ✅ Complete | 2026-07-19 |
| 4 | Impact Report Engine | ✅ Complete | 2026-07-19 |
| 5 | Approval Gate & Dashboard | ✅ Complete | 2026-07-19 |
| 6 | Execute, Snapshot & Rollback | ✅ Complete | 2026-07-24 |
| 7 | Integrity Verification & Polish | ✅ Complete | 2026-07-24 |
