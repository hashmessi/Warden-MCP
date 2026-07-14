# Stack Research: Warden MCP Data-Rights Agent

## Recommended Stack (2026)

### MCP Server — TypeScript + `@modelcontextprotocol/sdk`

| Component | Choice | Version | Confidence | Rationale |
|-----------|--------|---------|------------|-----------|
| **Language** | TypeScript | 5.x | 🟢 High | MCP's "native" language — most feature-complete SDK, best documentation, strongest ecosystem |
| **MCP SDK** | `@modelcontextprotocol/sdk` | latest | 🟢 High | Official SDK from Anthropic. `Server` class + `StdioServerTransport` for local, SSE for remote |
| **Input Validation** | `zod` | 3.x | 🟢 High | Standard for MCP tool schemas — used in all official examples |
| **Runtime** | Node.js | 22 LTS | 🟢 High | Built-in `crypto` module for SHA-256 hashing, native ES module support |

### Databases

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Primary (users/data)** | PostgreSQL (via `pg` driver) | Relational, supports transactions for snapshot/rollback, strong query capabilities |
| **Secondary (sessions/logs)** | MongoDB (via `mongodb` driver) | Document store — good for flexible audit log entries, session data |
| **Mock Payment Ledger** | SQLite (via `better-sqlite3`) or in-memory JSON | Lightweight stub — demonstrates the multi-system pattern without real payment API complexity |

### Frontend Dashboard

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Framework** | Next.js 15 (App Router) | React-based, SSR for the ops dashboard, API routes for approval gate webhooks |
| **Styling** | Tailwind CSS 4 | Rapid UI development, responsive, clean ops-console aesthetic |
| **State** | React Query (TanStack) | Live polling for pending requests + audit log feed |

### Deployment

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Frontend** | Vercel | Free tier, instant deploys, native Next.js support |
| **Backend MCP Server** | Railway or Render | Persistent process for MCP server + database connections |
| **Databases** | Supabase (Postgres) + MongoDB Atlas (free tier) | Managed, free tiers available, no DevOps overhead |

### What NOT to Use

| Don't Use | Why |
|-----------|-----|
| NitroStack/NitroCloud | Abandoned platform from original hackathon context |
| Python FastMCP | Viable but TypeScript has better MCP SDK maturity and ecosystem |
| Express.js for MCP | MCP SDK handles transport — don't add unnecessary HTTP framework for MCP layer |
| Real Stripe API | Mock ledger demonstrates the pattern; real Stripe adds auth complexity without value |
| Socket.io for real-time | React Query polling is sufficient for dashboard — WebSockets add complexity |

---
*Researched: 2026-07-14*
