# Phase 5: Approval Gate & Dashboard — Context

**Gathered:** 2026-07-19
**Status:** Ready for planning
**Mode:** Mixed (UI aesthetic = agent discretion; layout = agent discretion)

<domain>
## Phase Boundary

Phase 5 builds two things:

1. **`request_execution` MCP tool** — Creates a pending action with a unique approval token. DOES NOT execute any mutation. Returns a `PendingAction` object with token and status.
2. **Ops console dashboard** — Next.js 15 App Router UI that shows pending requests, blast-radius context, and Approve/Deny controls. API routes handle state transitions.

**Does NOT deliver:**
- Actual data deletion/anonymization (Phase 6)
- Rollback button (Phase 6)
- Audit log integrity verification (Phase 7)
- Live audit log feed (Phase 7)

</domain>

<decisions>
## Implementation Decisions

### D-01: Approval Token
- `crypto.randomUUID()` — cryptographically random, no expiry (demo scope), single-use enforced in the approval store
- Status state machine: `pending → approved | denied`
- `approved` and `denied` are terminal — no re-submission without a new scan (APPR-04, APPR-05)

### D-02: State Storage
- In-memory Map: `approvalStore = Map<token, PendingAction>` — consistent with scanStore/reportStore pattern from Phases 3–4
- Key: `token` (UUID string)
- Phase 6 reads from this store to execute approved actions

### D-03: Dashboard Layout
- **Agent discretion selected:** Split-panel ops console layout
  - Left panel: compact table of pending requests (subject, risk badge, timestamp, status)
  - Right panel: full blast-radius detail when a request is selected
  - If nothing selected: right panel shows "Select a request" empty state
- Responsive: collapses to single column on narrow screens

### D-04: Dashboard Aesthetic
- **Agent discretion selected:** Dark glassmorphism with vivid status accents
  - Background: deep navy/charcoal (#0f1117 or similar)
  - Glass cards: `backdrop-filter: blur` with semi-transparent borders
  - Status colors: PENDING=amber, APPROVED=emerald, DENIED=rose, CRITICAL=red
  - Typography: Inter or similar premium font
  - Subtle animations on status transitions
  - Must look portfolio-grade and demoable

### D-05: Approve/Deny Flow
- Clicking Approve or Deny opens a confirmation modal (no accidental clicks)
- Modal shows: subject identifier, risk level, recommended action text
- On confirm: POST to `/api/approvals/[token]/[action]`
- UI flips status badge optimistically, refetches state via polling or React Query

### D-06: Dashboard Data Fetching
- Next.js API routes (`/api/approvals`) serve the approval store data as JSON
- React Query with 5-second polling (no WebSockets needed per stack decision)
- Dashboard is a standalone Next.js app in `dashboard/` subdirectory

### D-07: MCP Tool
- Tool name: `request_execution`
- Input: `{ scan_id: string, action: "delete" | "anonymize" }`
- Validates scan_id exists in scanStore, generates token, stores PendingAction
- Returns `{ token, status: "pending", scanId, action, requestedAt }`
- Audit log: `APPROVAL_REQUESTED` entry written after creating pending action

### D-08: No stdout pollution
- All debug in dashboard API routes uses `console.error` only
- MCP server rule carries forward

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Foundation
- `.planning/ROADMAP.md` — Phase 5 success criteria (lines 86–99)
- `.planning/REQUIREMENTS.md` — APPR-01..05, MCP-03, DASH-01..03, DASH-07

### Existing Code (read before writing)
- `src/scanner.ts` — `getScanResult(scanId)` — must validate scan exists
- `src/impact/report.ts` — `getImpactReport(reportId)` — for blast-radius detail in dashboard
- `src/audit/logger.ts` — `AuditLogger.appendLog()` — APPROVAL_REQUESTED event
- `src/audit/types.ts` — `AuditAction` union (APPROVAL_REQUESTED is already in ontology)
- `src/index.ts` — where `request_execution` MCP tool must be registered
- `src/adapters/types.ts` — `ScanResult` shape (for dashboard display)
- `src/impact/types.ts` — `ImpactReport`, `RiskLevel` (for blast-radius panel)

### Stack Decisions
- Next.js 15 App Router for dashboard (from STATE.md init decisions)
- TailwindCSS 4 for dashboard styling (from GEMINI.md stack spec)
- React Query (TanStack) for dashboard data fetching (from GEMINI.md stack spec)

</canonical_refs>

<specifics>
## Specific Implementation Notes

- Dashboard lives in `dashboard/` directory at project root — separate Next.js app
- MCP server (`src/`) and dashboard (`dashboard/`) share the approval store via HTTP API (dashboard polls MCP server's HTTP endpoint, or dashboard has its own express-less API routes that import the store)
- SIMPLEST approach: dashboard is its own Next.js app with API routes that import `src/approval/store.ts` directly — no HTTP between them
- All `.js` extensions required in MCP server imports (NodeNext)
- `console.log` is FORBIDDEN in MCP server — only `console.error`

</specifics>

<deferred>
## Deferred Ideas

- Token expiry / TTL (beyond demo scope)
- Email notifications for pending approvals
- Role-based access control (enterprise IdP integration)
- Multi-approver workflows

</deferred>

---

*Phase: 05-approval-gate-dashboard*
*Context gathered: 2026-07-19*
