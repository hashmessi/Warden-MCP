[![CI](https://github.com/hashmessi/Warden-MCP/actions/workflows/ci.yml/badge.svg)](https://github.com/hashmessi/Warden-MCP/actions/workflows/ci.yml)

# 🛡 Warden

> **Governed Data-Rights Execution Agent** — MCP server for auditable, reversible, human-gated data deletion.

Warden is a [Model Context Protocol](https://modelcontextprotocol.io) server that finds, proves, and executes data-deletion or anonymization rights across every connected system in an organization — but **never acts without showing the blast radius first**, and every action it takes can be undone and independently audited.

The governance layer **is** the product.

---

## Table of Contents

1. [Problem](#-problem)
2. [Solution](#-solution)
3. [Key Features](#-key-features)
4. [Architecture](#-architecture)
5. [Tech Stack](#-tech-stack)
6. [AI Architecture](#-ai-architecture)
7. [Database Schema](#-database-schema)
8. [MCP Tools API](#-mcp-tools-api)
9. [Dashboard API Routes](#-dashboard-api-routes)
10. [Local Setup](#-local-setup)
11. [Environment Variables](#-environment-variables)
12. [Deployment](#-deployment)
13. [Testing](#-testing)
14. [Known Limitations](#-known-limitations)
15. [Future Improvements](#-future-improvements)

---

## Problem

AI agents are being given direct access to production databases to "handle" data requests. The risks are real:

| Gap | Consequence |
|-----|-------------|
| No blast-radius preview | Unknown what breaks before you delete |
| No approval gate | Agent acts autonomously — no human checkpoint |
| No audit proof | Cannot prove what was deleted, when, or by whom |
| No rollback | Once gone, it is gone |

Regulations (GDPR, DPDP, CCPA) mandate auditable, reversible erasure workflows. Warden enforces this at the architecture level.

---

## Solution

Warden inserts a **governance layer** between the AI client and your data:

```
AI requests data deletion
        |
scan_subject          -> discovers ALL records across every connected system
generate_impact_report -> blast-radius: what breaks downstream if we delete?
request_execution     -> creates a pending action token -- NO mutation yet
        |
Human reviews in Ops Dashboard -> Approve / Deny
        |
execute_approved_action -> snapshots data first, then deletes/anonymizes
rollback_action         -> restores from snapshot on demand
        |
Audit log -> every step SHA-256 hash-chained, tamper-evident
```

No irreversible action executes without an explicit human decision. Every action — taken or undone — is independently auditable.

---

## Key Features

| Feature | Implementation |
|---------|----------------|
| **5 MCP tools** | `scan_subject`, `generate_impact_report`, `request_execution`, `execute_approved_action`, `rollback_action` |
| **Multi-system fan-out** | Parallel scan across Postgres, MongoDB, and payment ledger via uniform `DataAdapter` interface |
| **SHA-256 hash-chained audit log** | Every entry's hash depends on the previous — tamper one entry and all subsequent hashes break |
| **Pre-execution snapshots** | Full data snapshots taken before any mutation — rollback always available |
| **Persistent scan state** | Scan results and impact reports persisted to Postgres — server restarts do not lose mid-flow approval state |
| **Blast-radius impact report** | Structured risk assessment: `LOW` / `MEDIUM` / `HIGH` / `CRITICAL` with downstream dependency analysis |
| **Human approval gate** | `request_execution` creates a pending token; execution is blocked until the dashboard approves |
| **Optional LLM enrichment** | OpenAI GPT-4o-mini generates a plain-English narrative for impact reports (gracefully disabled if not configured) |
| **Ops Dashboard** | Next.js console for reviewing pending requests, approving/denying, rolling back, and verifying hash-chain integrity |
| **Health endpoint** | `GET /health` checks Postgres + MongoDB connectivity — used by Docker, Railway, and Render |

---

## Architecture

```
+-------------------------------------------------------------+
|              MCP Client (Claude / MCP Inspector / any)      |
+--------------------------|----------------------------------+
                           | stdio transport
+--------------------------V----------------------------------+
|                    Warden MCP Server                        |
|                  src/index.ts (Node.js)                     |
|                                                             |
|  scan_subject . generate_impact_report . request_execution  |
|  execute_approved_action . rollback_action                  |
|                                                             |
|  HTTP /health  (Railway / Render / Docker monitoring)       |
+------|------------------------------------|------------------+
       |                                   |
+------V--------+    +--------------------V-----------------+
|  Data Adapters|    |         Ops Dashboard (Next.js)      |
|               |    |                                      |
| . Postgres    |    |  Pending requests . Blast radius     |
| . MongoDB     |    |  Approve / Deny . Rollback           |
| . Ledger stub |    |  Live audit log feed                 |
+-------V-------+    |  Verify Integrity (hash chain walk)  |
        |            +--------------------------------------+
+-------V---------------------------------------------------------+
|              PostgreSQL -- Central State Store                   |
|                                                                  |
|  approvals . snapshots . execution_steps . audit_log            |
|  scans . impact_reports                                         |
+-----------------------------------------------------------------+
+-------V---------------------------------------------------------+
|              Audit Log -- SHA-256 Hash Chain                     |
|                                                                  |
|  entry1: hash = SHA256(data1 + "GENESIS")                        |
|  entry2: hash = SHA256(data2 + entry1.hash)                      |
|  entryN: hash = SHA256(dataN + entryN-1.hash)                    |
|                                                                  |
|  Tamper entry2 -> entry3 through entryN all fail verify          |
+-----------------------------------------------------------------+
```

### Request Flow

```
scan_subject(email)
  -> PostgresAdapter.findByIdentifier()    (users, subscriptions, profiles)
  -> MongoDBAdapter.findByIdentifier()     (sessions, activity_logs)
  -> PaymentAdapter.findByIdentifier()     (in-memory ledger stub)
  -> ScanResult persisted to Postgres scans table
  -> AuditLogger.appendLog(SCAN)

generate_impact_report(scan_id)
  -> Fetches ScanResult from cache / Postgres
  -> Computes risk: orphan_risk -> CRITICAL | financial -> HIGH | multi-pii -> MEDIUM
  -> Optionally enriches with OpenAI GPT-4o-mini narrative
  -> ImpactReport persisted to Postgres impact_reports table

request_execution(scan_id, action)
  -> Runs impact report
  -> Creates pending approval token in Postgres approvals table
  -> Returns token -- NO data changed

[Human approves via dashboard]

execute_approved_action(token)
  -> Validates token status === "approved"
  -> Phase A: snapshotRecords() across all adapters -> Postgres snapshots table
  -> Phase B: deleteRecords() / anonymizeRecords() across all adapters
  -> On failure: automatic rollback initiated
  -> AuditLogger.appendLog(EXECUTION_COMPLETED)

rollback_action(execution_id)
  -> Validates not already rolled back
  -> adapter.restoreRecords(executionId) across all adapters
  -> Updates approvals.status = "rolled_back"
  -> AuditLogger.appendLog(ROLLBACK_COMPLETED)
```

---

## Tech Stack

| Layer | Choice | Version |
|-------|--------|---------|
| **Language** | TypeScript | 7.x |
| **Runtime** | Node.js | 22 LTS |
| **MCP SDK** | `@modelcontextprotocol/sdk` | ^1.29.0 |
| **Input validation** | `zod` | ^4.4.3 |
| **Primary DB** | PostgreSQL (`pg`) | ^8.22.0 |
| **Secondary DB** | MongoDB (`mongodb`) | ^7.5.0 |
| **Payment stub** | In-memory JSON ledger | — |
| **Crypto** | Node.js `crypto` (SHA-256) | built-in |
| **Dashboard** | Next.js (App Router) | latest |
| **Dashboard styling** | Tailwind CSS | v4 |
| **Dashboard data fetching** | React Query (TanStack) | — |
| **MCP transport** | stdio | — |
| **CI** | GitHub Actions | — |
| **Containerization** | Docker (multi-stage) | — |

---

## AI Architecture

### Optional LLM Narrative Enrichment

Warden's impact report engine is **deterministic by default** — it always produces a structured risk assessment with no external dependencies. The optional LLM layer adds a plain-English summary for human reviewers.

```
generate_impact_report(scan_id)
  |
  V
computeRiskLevel(hits)          <- pure function, always runs
  |  orphan_risk       -> CRITICAL
  |  financial/vol>50  -> HIGH
  |  multi-pii         -> MEDIUM
  |  else              -> LOW
  V
ImpactReport (deterministic)
  |
  V
enrichWithNarrative(report)     <- optional, gracefully skipped
  |  if LLM_ENABLED=true AND OPENAI_API_KEY is set:
  |    POST https://api.openai.com/v1/chat/completions
  |    model: gpt-4o-mini
  |    prompt: structured summary of risk, records, dependencies
  |    -> appends narrative field to report
  |  else (or on error):
  |    returns report unchanged
  V
ImpactReport (with or without narrative)
```

**Design principle:** LLM failure never blocks execution. The governance gate works without AI — AI is an enhancement, not a dependency.

---

## Database Schema

### PostgreSQL (primary state)

| Table | Purpose |
|-------|---------|
| `approvals` | Pending / approved / denied / executed / rolled_back actions with approval token |
| `snapshots` | Pre-execution data snapshots (JSONB) indexed by `execution_id` and `source_system` |
| `execution_steps` | Step-by-step log of each execution phase (SNAPSHOT / MUTATE / ROLLBACK) |
| `audit_log` | SHA-256 hash-chained immutable audit trail; unique index on `hash` and `prev_hash` enforces chain integrity at the DB level |
| `scans` | Persisted scan results (JSONB) — survives server restarts |
| `impact_reports` | Persisted impact reports (JSONB) — referenced by `scan_id` FK |

**Audit log chain integrity** is enforced by a `WITH last_log AS (...)` CTE that checks `prev_hash` matches inside a single atomic `INSERT ... WHERE` — concurrent appends that race are rejected with a `23505` unique constraint violation.

### MongoDB (sessions and behavioral logs)

Collections scanned:
- `sessions` — user session records
- `activity_logs` — behavioral event logs

MongoDB is used by the MongoDB adapter for discovery, snapshot, delete/anonymize, and restore operations.

### Payment Ledger (in-memory stub)

An in-memory JSON array loaded at startup (seeded by `npm run seed`). Demonstrates the multi-system adapter pattern without requiring a real payment API. Snapshot/restore operates directly on the in-memory array.

---

## MCP Tools API

All tools are exposed over **stdio transport** using `@modelcontextprotocol/sdk`.

### `scan_subject`

Discover all records for a subject across every connected data system.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `identifier` | `string` | Yes | Email address or user ID to scan |

**Returns:** `ScanResult` — scan ID, list of data hits per system/table with sensitivity tags (`pii`, `financial`, `behavioral`, `system`), total record count.

---

### `generate_impact_report`

Produce a blast-radius assessment for a previous scan.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `scan_id` | `string` | Yes | Scan ID from a previous `scan_subject` call |

**Returns:** `ImpactReport` — risk level (`LOW`/`MEDIUM`/`HIGH`/`CRITICAL`), data found section, downstream dependency risks, recommended action, optional LLM narrative.

---

### `request_execution`

Request human approval for a delete or anonymize operation. **No data is modified.**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `scan_id` | `string` | Yes | Scan ID to operate on |
| `action` | `"delete"` or `"anonymize"` | Yes | Operation type |

**Returns:** Pending action record with `token` UUID. Direct the reviewer to the Ops Dashboard to approve or deny.

---

### `execute_approved_action`

Execute a human-approved action. Snapshots data first, then mutates across all systems. Automatically rolls back on partial failure.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | `string` | Yes | Approval token from `request_execution` |

**Returns:** `execution_id` UUID. Fails with error if token status is not `approved`.

---

### `rollback_action`

Restore all data from the pre-execution snapshot.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `execution_id` | `string` | Yes | Execution ID from `execute_approved_action` |

**Returns:** Success confirmation. Idempotency guard prevents double rollback.

---

## Dashboard API Routes

Internal Next.js API routes. All mutating routes require `X-Dashboard-Secret` header.

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/health` | `GET` | None | Dashboard health check |
| `/api/approvals` | `GET` | Required | List all approval requests |
| `/api/approvals/[token]` | `PATCH` | Required | Approve or deny a pending action |
| `/api/approvals/[token]/rollback` | `POST` | Required | Trigger rollback for an executed action |
| `/api/audit-log` | `GET` | Required | Paginated live audit log feed |
| `/api/verify-integrity` | `GET` | Required | Walk the full hash chain and report first break |
| `/api/demo` | `POST` | Required | Trigger demo tamper for hash chain demonstration |

---

## Local Setup

### Prerequisites

- [Node.js 22+](https://nodejs.org)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for Postgres + MongoDB)

### 1. Clone and install

```powershell
git clone https://github.com/hashmessi/Warden-MCP.git
cd Warden-MCP
npm install
cd dashboard; npm install; cd ..
```

### 2. Configure environment

```powershell
# MCP server
Copy-Item .env.example .env

# Dashboard
Copy-Item dashboard\.env.local.example dashboard\.env.local
```

Edit `dashboard/.env.local` and set `DASHBOARD_SECRET` to any string for local dev.

### 3. Start databases

```powershell
docker-compose up -d
# Wait ~15s for health checks to pass
```

### 4. Seed synthetic data

```powershell
npm run seed
# Seeds users, subscriptions, sessions, payment records
```

### 5. Start services (three separate terminals)

**Terminal 1 — Ops Dashboard:**
```powershell
cd dashboard
npm run dev
# -> http://localhost:3000
```

**Terminal 2 — MCP Inspector (interactive tool testing):**
```powershell
npx @modelcontextprotocol/inspector tsx src/index.ts
# -> MCP Inspector: http://localhost:6274
# -> Health check:  http://localhost:3001/health
```

**Terminal 3 — MCP server (direct stdio, optional):**
```powershell
npm run dev
```

### Full Demo Flow

```
1. scan_subject("jane.doe@email.com")
   -> Returns hits from Postgres, MongoDB, payment ledger

2. generate_impact_report("<scan_id>")
   -> Risk level, dependency warnings, recommended action

3. request_execution("<scan_id>", "delete")
   -> Returns approval token -- no data changed yet

4. Open http://localhost:3000, review blast radius, click Approve

5. execute_approved_action("<token>")
   -> Snapshots all data, then deletes across all systems

6. rollback_action("<execution_id>")
   -> Restores from pre-execution snapshot

7. npm run demo:tamper
   -> Corrupts one audit entry in Postgres
   -> Click "Verify Integrity" in dashboard -- chain break detected
```

---

## Environment Variables

### MCP Server (`.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_URL` | Yes | — | PostgreSQL connection string |
| `MONGODB_URL` | Yes | — | MongoDB connection string |
| `MONGODB_DB` | Yes | `warden_db` | MongoDB database name |
| `PORT` | No | `3001` | HTTP health endpoint port |
| `NODE_ENV` | No | `development` | Runtime environment |
| `LLM_ENABLED` | No | `false` | Enable OpenAI narrative enrichment |
| `OPENAI_API_KEY` | No | — | Required only if `LLM_ENABLED=true` |

### Dashboard (`dashboard/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_URL` | Yes | Same Postgres instance as MCP server |
| `MONGODB_URL` | Yes | Same MongoDB instance as MCP server |
| `MONGODB_DB` | Yes | Same database name |
| `DASHBOARD_SECRET` | Yes | Shared secret for `X-Dashboard-Secret` header on mutating routes |

See [`.env.production.example`](.env.production.example) for production values and source instructions.

---

## Deployment

### Cloud: Railway (MCP server) + Vercel (dashboard)

**Step 1 — Provision managed databases**

- **PostgreSQL:** [supabase.com](https://supabase.com) -> Project -> Settings -> Database -> Connection string
- **MongoDB:** [cloud.mongodb.com](https://cloud.mongodb.com) -> free M0 cluster -> Connect -> Drivers -> connection string

**Step 2 — Deploy MCP server to Railway**

Connect your GitHub repo to Railway. Railway auto-detects `railway.toml` and builds the `Dockerfile`. Set these environment variables in the Railway dashboard:

```
POSTGRES_URL=<supabase-url>
MONGODB_URL=<atlas-url>
MONGODB_DB=warden_db
PORT=3001
NODE_ENV=production
```

**Step 3 — Deploy dashboard to Vercel**

Connect your GitHub repo to Vercel, set **Root Directory** to `dashboard`, and add these environment variables in Vercel project settings:

```
POSTGRES_URL=<supabase-url>
MONGODB_URL=<atlas-url>
MONGODB_DB=warden_db
DASHBOARD_SECRET=<openssl rand -hex 32>
```

**Step 4 — Seed production data**

```powershell
$env:POSTGRES_URL="<prod-url>"; $env:MONGODB_URL="<prod-url>"; npm run seed
```

### Docker (self-hosted)

```powershell
# Build image
docker build -t warden .

# Run with env file
docker run -p 3001:3001 --env-file .env warden

# Full local stack with docker-compose
docker-compose up -d

# Optional: seed via Docker
docker-compose --profile seed up seed
```

The `Dockerfile` is a two-stage build: TypeScript compiled in Stage 1 (`node:22-alpine`), only production `node_modules` and compiled `dist/` copied to Stage 2. Includes a Docker `HEALTHCHECK` that polls `GET /health`.

---

## Testing

### CI Pipeline (GitHub Actions)

Three parallel jobs on every push to `main`/`master` and every pull request:

| Job | Commands |
|-----|----------|
| **Backend** | `npm run typecheck` (tsc --noEmit) + `npm run build` |
| **Dashboard** | `npx tsc --noEmit` + `npm run build` (Next.js production build) |
| **Lint** | ESLint on dashboard (`--max-warnings 0`) |

### End-to-End Verification Script

Validates the full scan -> approve -> execute -> rollback loop against live databases:

```powershell
# Requires running Postgres + MongoDB
docker-compose up -d
npm run seed
npm run test:e2e
```

The script (`src/scripts/verify-e2e.ts`) asserts:
1. `scan_subject` finds records
2. Pending action created and approved
3. `executeAction` returns an execution ID
4. Second scan confirms records are deleted (count = 0)
5. `rollbackAction` restores data
6. Third scan confirms count matches original

Exit `0` = pass, exit `1` = fail with specific error message.

### Manual Verification

```powershell
# Health endpoint
Invoke-WebRequest http://localhost:3001/health | ConvertFrom-Json

# Interactive MCP tool calls via browser UI
npx @modelcontextprotocol/inspector tsx src/index.ts
# -> http://localhost:6274

# Tamper demo
npm run demo:tamper
# Then click "Verify Integrity" in the dashboard
```

---

## Known Limitations

| Limitation | Detail |
|------------|--------|
| **Single-approver model** | Any request with the correct `DASHBOARD_SECRET` can approve. No per-user auth or RBAC. |
| **Audit log race condition** | Concurrent appends are serialized by a `23505` unique constraint — high-throughput parallel writes will conflict and must retry. Acceptable for governance workloads. |
| **Payment ledger is in-memory** | Data is lost on server restart unless `npm run seed` is re-run. Demonstrates the adapter pattern; not a real payment integration. |
| **No real-time push** | Dashboard uses React Query polling. No WebSocket or SSE — updates require a poll interval or manual refresh. |
| **LLM enrichment is best-effort** | If OpenAI is unreachable or the key is invalid, narrative enrichment is silently skipped. The structured report is always returned. |
| **Tamper-evident, not tamper-proof** | The SHA-256 hash chain detects stored-entry modifications, but a Postgres admin with write access could reconstruct the chain. Suitable for audit and detection, not custody proof. |
| **Shared-secret dashboard auth** | `DASHBOARD_SECRET` is a single shared token. Replace with an IdP (Okta, Auth0) + NextAuth.js for production. |
| **No pagination on scan results** | `scan_subject` returns all hits in one response. Very large datasets may hit Node.js memory limits. |

---

## Future Improvements

| Improvement | Value |
|-------------|-------|
| Per-user auth (NextAuth.js + OAuth) | Named identities in audit log; revocable sessions |
| Approval comments | Approvers attach a reason to approve/deny decisions |
| Field-level anonymization config | Configurable strategies per field type rather than placeholder replacement |
| Additional adapters | Stripe API, Salesforce, S3 object storage, Elasticsearch |
| Scheduled compliance scans | Cron-triggered scanning for GDPR Article 17 erasure requests |
| Audit log WORM export | Export hash chain to S3 + Object Lock for regulatory retention |
| MCP Resources/Prompts | Expose scan results and audit log as MCP Resources for non-tool access |
| Multi-approver quorum | N-of-M approval requirement for CRITICAL risk operations |
| Streaming scan progress | MCP progress notifications for real-time status on large scans |

---

## Project Structure

```
warden/
├── src/
│   ├── index.ts               # MCP server (5 tools) + HTTP /health endpoint
│   ├── scanner.ts             # Multi-system parallel scan fan-out (Postgres-persisted)
│   ├── config.ts              # Typed config from environment variables
│   ├── adapters/
│   │   ├── types.ts           # DataAdapter interface
│   │   ├── postgres.adapter.ts
│   │   ├── mongodb.adapter.ts
│   │   ├── payment.adapter.ts # In-memory ledger stub
│   │   └── index.ts           # createAdapterRegistry()
│   ├── audit/
│   │   └── logger.ts          # SHA-256 hash chain (AuditLogger.appendLog)
│   ├── execution/
│   │   └── engine.ts          # executeAction() + rollbackAction()
│   ├── approval/
│   │   └── store.ts           # Approval CRUD (Postgres-backed)
│   ├── impact/
│   │   ├── report.ts          # ImpactReport generation + risk computation
│   │   ├── llm.ts             # Optional OpenAI narrative enrichment
│   │   └── types.ts
│   ├── db/
│   │   ├── postgres.ts        # Pool, initDb(), query()
│   │   ├── mongodb.ts         # MongoClient singleton + pingMongo()
│   │   └── ledger.json        # Payment ledger seed data
│   ├── utils/
│   │   └── crypto.ts          # hashIdentifier(), computeAuditHash()
│   ├── seed/
│   │   └── index.ts           # Synthetic data seeder (Faker.js)
│   └── scripts/
│       ├── tamper.ts          # Demo: corrupt one audit log entry
│       └── verify-e2e.ts      # End-to-end verification script
├── dashboard/
│   ├── app/
│   │   ├── page.tsx           # Ops console UI
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── providers.tsx      # React Query provider
│   │   ├── types.ts
│   │   ├── lib/auth.ts        # Dashboard API auth helper
│   │   └── api/
│   │       ├── health/
│   │       ├── approvals/[token]/
│   │       │   └── rollback/
│   │       ├── audit-log/
│   │       ├── verify-integrity/
│   │       └── demo/
│   ├── vercel.json
│   └── package.json
├── .github/workflows/ci.yml   # Typecheck + build + lint
├── Dockerfile                 # Multi-stage Node.js 22 build
├── docker-compose.yml         # Local: Postgres 16 + MongoDB 7
├── railway.toml               # Railway deployment config
├── .env.example               # Local dev template
└── .env.production.example    # Production template
```

---

## Security Notes

- Dashboard approve/deny/rollback routes require `X-Dashboard-Secret` header
- Audit log subject identifiers are SHA-256 hashed — raw PII is never stored in the audit log
- Scan results store identifiers in the `scans` table; restrict Postgres access in production
- **Production auth path:** Replace `DASHBOARD_SECRET` with an IdP integration (Okta, Auth0) + NextAuth.js

---

## License

[MIT](LICENSE)

---

*Built as a portfolio-grade demonstration of production governance patterns for AI agent ecosystems.*
*Every irreversible action requires a human decision. Every action is independently auditable with cryptographic proof.*
