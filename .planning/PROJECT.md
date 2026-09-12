# Warden — Governed Data-Rights Execution Agent

## What This Is

Warden is an MCP (Model Context Protocol) agent that finds, proves, and executes a user's data-deletion or data-access rights across every connected system in an organization — but it never acts without showing the blast radius first, and every action it takes can be undone and independently audited. It's trust infrastructure for AI-powered data operations, not an autonomous deletion bot.

Built as a portfolio-grade project demonstrating production-level governance patterns: human-in-the-loop approval gates, tamper-evident audit trails, pre-execution snapshots with full rollback, and multi-system data discovery.

## Core Value

Every irreversible action requires a human decision, and every action — taken or undone — is independently auditable with cryptographic proof. The governance layer IS the product.

## Current Milestone: v2.0 Warden — 4-Week War Plan: Enterprise Hardening & Adversarial Resilience

**Goal:** Transform Warden from an MVP demo into a battle-tested, measurably verified, attack-resilient, production-governed AI data-rights platform.

**Target features:**
- **Week 1 (Evaluation Harness):** Automated invariant testing (`npm run eval`) covering 11 critical edge/failure scenarios and structured scorecard
- **Week 2 (Adversarial Attack Suite):** Comprehensive threat model (`docs/THREAT_MODEL.md`) and 27-case empirical attack test suite across 4 attack vectors
- **Week 3 (Production Architecture):** Hierarchical RBAC auth, multi-approver quorum policies, formal execution state machine, and distributed compensation partial-failure engine
- **Week 4 (AI-Native Control Layer):** Controlled agent boundary orchestration where autonomous models request operations but Warden strictly gates and decides

## Requirements

### Validated (v1.0 Milestone)

- [x] **DISC-01..05**: Multi-system data discovery: scan across Postgres + MongoDB + payment ledger (Phase 3)
- [x] **IMPT-01..04**: Impact report generation: produce human-readable blast-radius and orphan risk document (Phase 4)
- [x] **APPR-01..05**: Human-in-the-loop approval gate: no irreversible action executes without human approval (Phase 5)
- [x] **EXEC-01..06**: Pre-execution snapshotting, deletion/anonymization, and full rollback across all systems (Phase 6)
- [x] **AUDT-01..05**: SHA-256 hash-chained tamper-evident audit log with verification endpoint (Phase 2, 7)
- [x] **DASH-01..07**: Web-based ops dashboard with live audit feed and interactive demo flow (Phase 5, 7)
- [x] **MCP-01..06**: MCP server protocol compliance exposing tools and HTTP health endpoint (Phase 3, 8)

### Active (v2.0 Milestone)

- [ ] **EVAL-01**: Comprehensive evaluation harness runner executed via `npm run eval`
- [ ] **EVAL-02**: Invariant-based test suite covering 11 core failure & concurrency scenarios
- [ ] **EVAL-03**: Evaluation scorecard reporting Pass/Fail, Latency, Recovery rate, and Unauthorized execution rates
- [ ] **ATTK-01**: Comprehensive threat model document (`docs/THREAT_MODEL.md`) mapping 4 attack classes
- [ ] **ATTK-02**: Adversarial test harness executing 27 simulated attacks across Agent, MCP, Data, and Governance vectors
- [ ] **ATTK-03**: Empirical security scorecard proving blocked vs remaining attack vectors
- [ ] **ARCH-01**: Role-based access control (RBAC) layer (Viewer, Operator, Approver, Admin) replacing static shared secret
- [ ] **ARCH-02**: Multi-approver quorum policy engine enforced by risk tier (LOW/MEDIUM/HIGH/CRITICAL)
- [ ] **ARCH-03**: Formal execution state machine with explicit invalid transition guards and idempotency keys
- [ ] **ARCH-04**: Distributed partial failure engine with automated two-phase compensation and matrix tests
- [ ] **AGNT-01**: Controlled AI agent orchestration layer utilizing Warden MCP tools under strict capability boundaries
- [ ] **AGNT-02**: End-to-end verification proving AI agents cannot bypass governance or execute without approval

### Out of Scope

- Real payment provider integration (Stripe, etc.) — mock payment ledger stub demonstrates the pattern without API complexity
- Cloud IdP vendor lock-in (Okta, Auth0) — modular RBAC interface with clean local authentication stub
- Chatbot/conversational customer UI — Warden is an ops control plane, not a consumer chat interface
- Autonomous un-gated deletion — undermines the core differentiator of human-in-the-loop governance

## Context

**Market context:** 35% of executives cannot pull the plug on rogue AI agents; 67% report breaches from unapproved AI tools. Warden demonstrates verifiable trust infrastructure where AI agents operate with strictly bounded authority.

**Strategic Pivot (v2.0):** Stop declaring "it works." Start proving exactly how it behaves under stress, adversarial attack, distributed partial failure, and multi-agent concurrency.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Generic compliance framing | Broader applicability across jurisdictions | Validated (v1.0) |
| SHA-256 tamper-evident hash chain | Tamper-detection without distributed blockchain overhead | Validated (v1.0) |
| Pre-execution full snapshot before delete | Ensures 100% rollback capability | Validated (v1.0) |
| Dedicated Eval Harness (`npm run eval`) | Quantifiable confidence replacing anecdotal testing | Active (v2.0) |
| Adversarial Threat Model & 27 Attacks | Empirical verification of agent and MCP vulnerabilities | Active (v2.0) |
| Risk-tiered multi-approver quorum | Enterprise governance requiring 2-of-3 for critical deletions | Active (v2.0) |
| Strict capability boundary for LLM agents | Model can request; Warden decides and executes | Active (v2.0) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-12 — Initialized Milestone v2.0 (4-Week War Plan)*
