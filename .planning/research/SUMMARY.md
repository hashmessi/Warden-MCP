# Research Summary: Warden MCP Data-Rights Agent

## Stack Decision

**TypeScript + `@modelcontextprotocol/sdk`** is the clear winner for the MCP server. It's the "native" language for MCP with the most mature SDK. Combine with:
- **Postgres** (via `pg`) for primary user data — relational, transactional, supports snapshot/rollback pattern
- **MongoDB** (via `mongodb`) for sessions/logs — flexible documents for audit entries
- **Next.js 15** for the ops dashboard — SSR, API routes, React ecosystem
- **Vercel + Railway** for deployment — free tiers, no DevOps overhead

## Table Stakes Features

1. **Multi-system data discovery** — scan across Postgres + MongoDB + mock payment ledger
2. **Human-in-the-loop approval gate** — no irreversible action without human click
3. **Immutable audit trail** — SHA-256 hash-chained, append-only
4. **Execute + delete/anonymize** — actually perform the approved mutations

## Key Differentiators

1. **Pre-execution snapshots + rollback** — THE demo climax. Nobody else will show a rollback
2. **Impact report / blast radius** — hybrid template + LLM enrichment
3. **Audit log integrity verification** — one-click chain walk, green/red per entry

## Critical Watch-Outs

1. **NEVER `console.log` in MCP server** — corrupts JSON-RPC stream, use `stderr` only
2. **Canonicalize JSON before hashing** — sorted keys or hash chain breaks randomly
3. **Test rollback obsessively** — foreign keys, partial restores, junction tables
4. **No PII in audit log** — store hashed identifiers, not raw emails
5. **Seed data must tell a story** — "interesting" users with cross-system data, orphan-able records
6. **Approval gate needs idempotency** — optimistic locking prevents double-approve race conditions

## Architecture Pattern

Layered architecture: MCP Tool Layer → Core Services → Data Adapters → Databases, with cross-cutting audit logger, snapshot manager, and approval queue. Dashboard is a separate Next.js process that interacts via REST API.

## Build Order

1. Foundation (project scaffold, DB seeding, adapters)
2. Audit logger (hash chain — everything depends on this)
3. MCP server + scan tool (first demoable feature)
4. Impact report engine
5. Approval gate + dashboard
6. Execute + snapshot + rollback (the climax)
7. Polish (integrity verification, error handling, demo prep)

---
*Synthesized: 2026-07-14*
