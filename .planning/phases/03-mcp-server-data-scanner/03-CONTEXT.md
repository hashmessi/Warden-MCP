# Phase 3: MCP Server & Data Scanner — Context

**Gathered:** 2026-07-19
**Status:** Ready for planning
**Mode:** Agent discretion (user requested efficient execution)

<domain>
## Phase Boundary

Phase 3 stands up the MCP server skeleton with stdio transport and implements the first demoable tool: `scan_subject`. It fans out across all three connected data systems and returns aggregated structured results logged to the audit trail.

**Delivers:**
- MCP server (`src/index.ts`) using `@modelcontextprotocol/sdk` Server + StdioServerTransport
- `scan_subject` tool — zod-validated input, fan-out to adapter registry, audit log entry
- No stdout pollution — all debug goes to stderr

**Does NOT deliver:**
- `generate_impact_report` tool (Phase 4)
- `request_execution` tool (Phase 5)
- Any dashboard or HTTP endpoints

</domain>

<decisions>
## Implementation Decisions

### MCP Server Transport
- **D-01:** Use `StdioServerTransport` (reads stdin, writes stdout as JSON-RPC 2.0). All internal logging MUST use `console.error()` — never `console.log()`.

### Tool Input Schema
- **D-02:** `scan_subject` accepts `{ identifier: string }` — validated with zod. The identifier is an email or user ID string.

### Scan Architecture
- **D-03:** Single `scanner.ts` module exports `scanSubject(identifier)` — calls `createAdapterRegistry()`, fans out in parallel with `Promise.all`, assembles `ScanResult` with a `crypto.randomUUID()` scan ID.
- **D-04:** ScanResult is stored in-memory per session (Map keyed by scanId) for Phase 4 lookup. No DB persistence needed yet.

### Audit Integration
- **D-05:** After scan completes, call `AuditLogger.appendLog({ action: "SCAN", actor: "mcp-client", subject: identifier, details: { scanId, totalRecords, systemsScanned } })`.

### Error Handling
- **D-06:** If a single adapter fails, the scan continues with a partial result — the error is included in the response and logged to stderr. Never throw to MCP level.

### File Layout
```
src/
  index.ts          ← MCP server bootstrap (replaces placeholder)
  scanner.ts        ← scan_subject business logic
```

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Foundation
- `.planning/ROADMAP.md` — Phase 3 success criteria (lines 55–68)
- `.planning/REQUIREMENTS.md` — MCP-01, MCP-06, DISC-01..05

### Existing Code (read before writing)
- `src/adapters/index.ts` — `createAdapterRegistry()` barrel function
- `src/adapters/types.ts` — `ScanResult`, `DataHit`, `DataAdapter` interfaces
- `src/audit/logger.ts` — `AuditLogger.appendLog()` method signature
- `src/audit/types.ts` — `AuditAction` union type
- `src/config.ts` — config shape
- `src/db/postgres.ts` — `query()` returns `T[]` (not `{ rows }`)

### MCP SDK
- `@modelcontextprotocol/sdk` — already installed at `^1.29.0`

</canonical_refs>

<specifics>
## Specific Implementation Notes

- NodeNext module resolution requires `.js` extensions on all local imports
- `console.log()` is FORBIDDEN in MCP server — it will corrupt the JSON-RPC stream
- The `scan_subject` tool MUST appear under `tools/list` and be callable by MCP Inspector
- Phase 4 will read the in-memory scan store; export `getScanResult(scanId)` from `scanner.ts`

</specifics>

<deferred>
## Deferred Ideas

- Persistent scan result storage (Phase 4 or 5 can persist to DB if needed)
- Streaming/progressive scan results
- Rate limiting / auth on MCP tools (Phase 5 handles auth)

</deferred>

---

*Phase: 03-mcp-server-data-scanner*
*Context gathered: 2026-07-19*
