# Warden — Governed Data-Rights Execution Agent

## What This Is

Warden is an MCP (Model Context Protocol) agent that finds, proves, and executes a user's data-deletion or data-access rights across every connected system in an organization — but it never acts without showing the blast radius first, and every action it takes can be undone and independently audited. It's trust infrastructure for AI-powered data operations, not an autonomous deletion bot.

Built as a portfolio-grade project demonstrating production-level governance patterns: human-in-the-loop approval gates, tamper-evident audit trails, pre-execution snapshots with full rollback, and multi-system data discovery.

## Core Value

Every irreversible action requires a human decision, and every action — taken or undone — is independently auditable with cryptographic proof. The governance layer IS the product.

## Current State

Phase 1 (Foundation & Data Layer) is complete — TypeScript scaffold, Docker databases, DataAdapter interfaces, and multi-system synthetic data seeding are fully implemented.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Multi-system data discovery: scan across Postgres + MongoDB to find all records associated with a user identity
- [ ] Impact report generation: produce a human-readable blast-radius document showing what breaks downstream if data is deleted
- [ ] Human-in-the-loop approval gate: no irreversible action executes without explicit human approval via the dashboard
- [ ] Pre-execution snapshotting: snapshot all affected rows before any mutation, enabling full restore
- [ ] Execute + rollback: perform approved deletions/anonymizations and restore from snapshots on demand
- [ ] Hash-chained tamper-evident audit log: every action (scan, request, approve, execute, rollback) is logged with SHA-256 hash chaining
- [ ] Audit log integrity verification: one-click verification that walks the hash chain and reports tampering
- [ ] Ops dashboard: web-based control plane showing pending requests, blast radius reports, approve/deny/rollback controls, and live audit log
- [ ] MCP server protocol compliance: expose all tools as proper MCP server endpoints consumable by any MCP-compatible client

### Out of Scope

- Real payment provider integration (Stripe, etc.) — mock payment ledger stub demonstrates the pattern without API complexity
- Production auth/identity (Okta, Descope) — hardcoded admin role with mention of production integration path
- Chatbot/conversational UI — this is an ops console, not a chat toy
- Auto-approval logic ("if confidence > 90%") — undermines the entire differentiator of human-gated governance
- Mobile app — web-first, ops console doesn't need native mobile
- Full GDPR/DPDP legal compliance — demonstrate the technical pattern, not legal certification

## Context

**Origin:** Initially conceived for a hackathon (now abandoned), repositioned as a portfolio/hackathon-ready project with no time constraint. The original roadmap provided strategic positioning for judges and competitive framing.

**Market context:** 35% of executives can't "pull the plug" on a rogue AI agent. 67% report breaches from unapproved AI tools. 46% cite integration with existing systems as the #1 blocker. Warden directly addresses trust and governance in AI agent ecosystems.

**Data rights landscape:** GDPR right-to-erasure, India's DPDP Act, and similar regulations globally create legal mandates for data deletion capabilities. Warden demonstrates the technical execution pattern without being tied to a specific jurisdiction.

**MCP ecosystem:** MCP hackathon winners in 2026 were governance/identity tools (not new agent tricks). The approval-gate + audit trail pattern aligns with what the ecosystem rewards.

**Demo strategy:** The "rollback moment" — deleting user data, then restoring it with audit trail intact — is the climax feature. The kill switch as a feature, not a limitation.

## Constraints

- **Architecture**: MCP server protocol — tools must be exposable as MCP endpoints, not just REST APIs
- **Databases**: Postgres (primary user data) + MongoDB (sessions/logs) — demonstrates multi-system pattern without unnecessary complexity
- **Impact Report**: Hybrid approach — deterministic template structure with optional LLM enrichment for plain-English narrative
- **Deployment**: Self-hosted or cloud platform (Vercel/Railway/Render) — no vendor lock-in to abandoned NitroStack/NitroCloud
- **Security model**: Hardcoded admin role for demo; mention production integration path with enterprise IdP
- **Audit integrity**: SHA-256 hash chain on append-only log — tamper-evident, not tamper-proof (important distinction for honest positioning)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Generic compliance framing (not GDPR/DPDP-specific) | Broader applicability, avoids jurisdiction-specific edge cases | — Pending |
| Hybrid impact reports (template + optional LLM) | Reliability of templates, polish of LLM — best of both worlds | — Pending |
| All 5 MCP tools in v1 scope | Portfolio project with flexible timeline — build the full story | — Pending |
| Drop NitroStack/NitroCloud | Abandoned hackathon platform — use standard open-source MCP tooling | — Pending |
| Postgres + MongoDB (not SQLite) | Must demonstrate real multi-system fan-out, not toy DB | — Pending |

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
*Last updated: 2026-07-19 after completing Phase 1*
