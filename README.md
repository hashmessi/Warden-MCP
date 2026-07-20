# 🛡 Warden

**Trust infrastructure for AI-powered data operations.**

Warden is an MCP (Model Context Protocol) server that finds, proves, and executes data-deletion rights across every connected system in an organization — but never acts without showing the blast radius first. Every action is cryptographically audited and can be fully reversed.

---

## The Problem

AI agents are being given access to production databases to "handle" data requests. But:

- **No blast radius preview** — you don't know what breaks before you delete
- **No approval gate** — the agent just acts, no human checkpoint
- **No audit proof** — did it delete what it said? Can you prove it?
- **No rollback** — once it's gone, it's gone

35% of executives can't "pull the plug" on a rogue AI agent. 67% report breaches from unapproved AI tools. Warden changes that.

---

## The Solution

Warden adds a **governance layer** between the AI and your data:

```
AI requests data deletion
        ↓
scan_subject          → discovers ALL records across every connected system
generate_impact_report → blast-radius: what breaks downstream if we delete?
request_execution     → creates pending action, NO mutation yet
        ↓
Human reviews in dashboard → Approve / Deny
        ↓
execute_approved_action → snapshots first, then deletes/anonymizes
rollback_action         → restores from snapshot if needed
        ↓
Audit log → every step is SHA-256 hash-chained, tamper-evident
```

**The governance layer IS the product.** Not an autonomous deletion bot — a trust primitive.

---

## Industry Need

| Signal | Why It Matters |
|--------|----------------|
| **GDPR / DPDP / CCPA** | Legal mandates for auditable, reversible data erasure workflows |
| **AI governance gap** | MCP hackathon winners in 2026 were governance/identity tools — the ecosystem needs trust primitives |
| **Enterprise blocker** | 46% cite AI integration with existing systems as the #1 blocker — Warden's adapter pattern directly addresses this |
| **Accountability** | 67% of organizations report breaches from unapproved AI tools — human-gated approval is the only reliable safeguard |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Client (Claude / any)                 │
└──────────────────────────┬──────────────────────────────────┘
                           │ stdio transport
┌──────────────────────────▼──────────────────────────────────┐
│                    Warden MCP Server                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  scan_subject  │  generate_impact_report             │   │
│  │  request_execution  │  execute_approved_action       │   │
│  │  rollback_action                                     │   │
│  └──────────────────────────────────────────────────────┘   │
└──────┬──────────────────────────────┬───────────────────────┘
       │                              │
┌──────▼────────┐    ┌───────────────▼─────────────────────── ┐
│  Data Adapters│    │         Ops Console (Next.js 16)        │
│               │    │                                         │
│ · Postgres    │    │  Pending requests · Blast radius detail │
│ · MongoDB     │    │  Approve / Deny · Rollback              │
│ · Ledger stub │    │  Live audit log feed                    │
└───────┬───────┘    │  Verify Integrity (hash chain walk)     │
        │            └─────────────────────────────────────────┘
┌───────▼──────────────────────────────────────────────────── ┐
│              Audit Log (SHA-256 Hash Chain)                  │
│                                                              │
│  entry₁: hash = SHA256(data₁ + "GENESIS")                  │
│  entry₂: hash = SHA256(data₂ + entry₁.hash)                │
│  entry₃: hash = SHA256(data₃ + entry₂.hash)                │
│                                                              │
│  Tamper entry₂ → entry₃ through entryₙ all fail verify     │
└──────────────────────────────────────────────────────────── ┘
```

**Databases:** PostgreSQL (user data, approvals, snapshots, audit log) + MongoDB (sessions, activity logs) + in-memory payment ledger stub.

---

## What Makes This Novel

| Feature | What It Demonstrates |
|---------|---------------------|
| **SHA-256 hash-chained audit log** | Tamper-evident — not just logged, but cryptographically proven. One tampered entry breaks all subsequent hashes. |
| **Pre-execution snapshots** | Rollback is always possible because data is snapshotted before any mutation |
| **Blast radius preview** | Human sees exactly what breaks downstream (orphaned billing records, active sessions) before approving |
| **Human-in-the-loop gate** | No irreversible action executes without explicit human approval — the architecture enforces this |
| **MCP-native** | Works with Claude, custom agents, or any MCP-compatible client via stdio transport |
| **Multi-system fan-out** | Single scan simultaneously covers Postgres + MongoDB + payment ledger via uniform DataAdapter interface |

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| MCP Server | TypeScript + `@modelcontextprotocol/sdk` | Native language for MCP, best SDK maturity |
| Primary DB | PostgreSQL (`pg`) | Transactions for snapshot/rollback, relational for audit chain |
| Secondary DB | MongoDB (`mongodb`) | Document store for sessions and flexible logs |
| Dashboard | Next.js 16 + TailwindCSS 4 + React Query | SSR, API routes, live polling |
| Audit integrity | Node.js `crypto` (SHA-256) | Built-in, no dependencies |

---

## Demo Walkthrough

### Prerequisites

```bash
# Start databases
docker-compose up -d

# Seed synthetic data (jane.doe@email.com has data across all 3 systems)
npm run seed

# Start dashboard (localhost:3000)
cd dashboard && npm run dev

# Start MCP server via MCP Inspector (separate terminal)
npx @modelcontextprotocol/inspector tsx src/index.ts
```

### The Full Flow

```bash
# 1. DISCOVER — find all records for a user
scan_subject("jane.doe@email.com")
# → Returns hits from Postgres users/subscriptions/profiles,
#   MongoDB sessions, payment ledger

# 2. ANALYZE — what breaks if we delete?
generate_impact_report("<scan_id>")
# → "3 active subscriptions will be orphaned"
# → Risk level: HIGH

# 3. REQUEST — create pending action (NO data changed yet)
request_execution("<scan_id>", "delete")
# → Returns approval token

# 4. APPROVE — go to localhost:3000, review blast radius, click Approve

# 5. EXECUTE — snapshots first, then deletes across all 3 systems
execute_approved_action("<token>")

# 6. ROLLBACK — restore from pre-execution snapshot
rollback_action("<execution_id>")

# 7. TAMPER + VERIFY — the hash chain demo
npm run demo:tamper          # Corrupts one audit entry in Postgres
# Click "Verify Integrity" in dashboard
# → Chain break detected — entry and all subsequent entries fail
```

---

## Project Structure

```
warden/
├── src/
│   ├── index.ts              # MCP server + 5 tool definitions
│   ├── scanner.ts            # Multi-system scan fan-out
│   ├── audit/
│   │   └── logger.ts         # SHA-256 hash chain implementation
│   ├── execution/
│   │   └── engine.ts         # Snapshot + execute + rollback
│   ├── adapters/             # Postgres / MongoDB / Ledger adapters
│   ├── approval/             # Approval store
│   └── scripts/
│       └── tamper.ts         # Demo tamper script
├── dashboard/
│   ├── app/
│   │   ├── page.tsx          # Ops console UI
│   │   └── api/
│   │       ├── approvals/    # Approval CRUD routes
│   │       ├── audit-log/    # Live audit feed
│   │       └── verify-integrity/ # Hash chain verification
└── .planning/                # GSD planning artifacts
```

---

*Built as a portfolio-grade demonstration of production governance patterns for AI agent ecosystems.*
*Every irreversible action requires a human decision. Every action is independently auditable with cryptographic proof.*
