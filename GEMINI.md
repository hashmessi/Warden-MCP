<!-- GSD:project-start source:PROJECT.md -->
## Project

**Warden — Governed Data-Rights Execution Agent**

Warden is an MCP (Model Context Protocol) agent that finds, proves, and executes a user's data-deletion or data-access rights across every connected system in an organization — but it never acts without showing the blast radius first, and every action it takes can be undone and independently audited. It's trust infrastructure for AI-powered data operations, not an autonomous deletion bot.

Built as a portfolio-grade project demonstrating production-level governance patterns: human-in-the-loop approval gates, tamper-evident audit trails, pre-execution snapshots with full rollback, and multi-system data discovery.

**Core Value:** Every irreversible action requires a human decision, and every action — taken or undone — is independently auditable with cryptographic proof. The governance layer IS the product.

### Constraints

- **Architecture**: MCP server protocol — tools must be exposable as MCP endpoints, not just REST APIs
- **Databases**: Postgres (primary user data) + MongoDB (sessions/logs) — demonstrates multi-system pattern without unnecessary complexity
- **Impact Report**: Hybrid approach — deterministic template structure with optional LLM enrichment for plain-English narrative
- **Deployment**: Self-hosted or cloud platform (Vercel/Railway/Render) — no vendor lock-in to abandoned NitroStack/NitroCloud
- **Security model**: Hardcoded admin role for demo; mention production integration path with enterprise IdP
- **Audit integrity**: SHA-256 hash chain on append-only log — tamper-evident, not tamper-proof (important distinction for honest positioning)
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

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
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
