# Warden — Governed Data-Rights Execution Agent

> An MCP agent that finds, proves, and executes a user's data-deletion or data-access rights across every system in your company — but it never acts without showing you the blast radius first, and every action it takes can be undone and independently audited.

## Quick Start

### Prerequisites
- Node.js 22 LTS
- Docker Desktop

### Setup

```bash
# 1. Clone and install
npm install

# 2. Copy environment config
cp .env.example .env

# 3. Start databases
docker compose up -d

# 4. Wait for health checks, then seed
npm run seed

# 5. Start the server (Phase 3+)
npm run dev
```

### Verify Setup
```bash
# TypeScript compiles cleanly
npm run typecheck

# Databases are running
docker compose ps
```

## Architecture

| Component | Technology |
|-----------|------------|
| MCP Server | TypeScript + @modelcontextprotocol/sdk |
| Primary DB | PostgreSQL 16 |
| Secondary DB | MongoDB 7 |
| Payment Ledger | In-memory mock |
| Dashboard | Next.js 15 (Phase 5+) |

## Project Phases

1. **Foundation & Data Layer** ← *current*
2. Audit Logger (Hash Chain)
3. MCP Server & Data Scanner
4. Impact Report Engine
5. Approval Gate & Dashboard
6. Execute, Snapshot & Rollback
7. Integrity Verification & Polish

## Demo Users

| Email | Scenario |
|-------|----------|
| jane.doe@email.com | High-profile: data in ALL 3 systems, active subscriptions |
| john.smith@email.com | Clean user: single system, safe to delete |
| bob.wilson@email.com | Edge case: expired subscriptions, no payment records |
