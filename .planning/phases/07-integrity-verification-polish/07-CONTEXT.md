# Phase 7: Integrity Verification & Polish — Context

**Gathered:** 2026-07-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 7 delivers the final layer of the Warden system:

1. **Audit chain integrity verification** — `verify_integrity` backend function + "Verify Integrity" button in dashboard (AUDT-04, AUDT-05, DASH-06)
2. **Live audit log feed** — Scrollable, polled feed of audit entries in the dashboard (DASH-05)
3. **Edge case error handling** — Graceful UI treatment for: scan finds nothing, double-approve attempt, rollback of non-existent execution
4. **Demo polish** — A well-crafted README (project overview, problem/solution, architecture, novelty) + `npm run demo:tamper` script for the tamper-then-verify demo story

**Does NOT deliver:**
- New MCP tools (all 5 are complete from Phases 3–6)
- Rollback or execution logic (Phase 6)
- Auth or multi-tenancy (out of scope)

</domain>

<decisions>
## Implementation Decisions

### Verify Integrity UX
- **D-01:** Results appear in a **modal dialog** triggered by the "Verify Integrity" button. Modal is focused and contained — no ambient clutter from the main dashboard during chain-walk.
- **D-02:** **Batch reveal with counter** — modal shows a fast `12/47 entries checked...` counter while the backend walks the chain, then reveals all results simultaneously. Provides drama and feedback without entry-by-entry animation lag.
- **D-03:** **Pass state** = green banner ("All 47 entries verified ✓") + collapsible entry list. User can expand to see each entry's action, timestamp, and hash snippet. Shows depth without overwhelming.
- **D-04:** **Fail state** = red banner with the specific failed entry highlighted (entry ID, expected hash vs. actual hash). All subsequent entries that fail cascade-fail visually (tamper-evident chain break visualization).

### Live Audit Log Feed (DASH-05)
- **D-05:** New panel/section in the dashboard (below or beside the approvals list) showing the audit log entries with: action type, timestamp, actor, and first 8 chars of hash. Uses React Query polling at the same 5-second interval already established.
- **D-06:** Most-recent entries shown first (DESC order). Fixed max height with scroll — not infinite, cap at last 50 entries for demo.

### Edge Case Error Handling
- **D-07:** **Toast for recoverable errors** — "Scan found nothing" → amber toast that auto-dismisses after 4 seconds.
- **D-08:** **Inline for blocking errors** — "Double-approve attempt" → inline error on the request row itself. "Rollback of non-existent execution" → inline error in the rollback button area.
- **D-09:** Toast component needs to be built (no existing toast in the dashboard) — simple fixed-position notification, consistent with glassmorphism aesthetic.

### Demo Tamper Script
- **D-10:** `npm run demo:tamper` — a standalone Node/tsx script (`src/scripts/tamper.ts`) that updates one audit entry's hash in Postgres to a random value. Presenter runs this before clicking Verify to demonstrate tamper detection. No UI button.
- **D-11:** Script must print which entry it tampered and what the original hash was (for demo narration).

### README
- **D-12:** A comprehensive, clean README at project root with: one-liner, problem statement, solution description, industry need/market context, project architecture diagram (ASCII or Mermaid), and novelty/differentiators. NOT a step-by-step setup guide — focused on the "why" and "what". Demo walkthrough commands included as a short section.

### Agent's Discretion
- Exact layout positioning of the audit log feed within the existing `page.tsx` — pick what flows best given the current split-panel layout
- Hash display format in feed (first 8 chars is sufficient for identity without overwhelming)
- Toast animation style (slide-in, fade, etc.) — must match glassmorphism aesthetic

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Foundation
- `.planning/ROADMAP.md` — Phase 7 success criteria (lines 118–131)
- `.planning/REQUIREMENTS.md` — AUDT-04, AUDT-05, DASH-05, DASH-06

### Existing Code (read before writing)
- `src/audit/logger.ts` — `AuditLogger.appendLog()` + `canonicalize()` + `hashIdentifier()` — understand the chain construction before writing verify logic
- `src/audit/types.ts` — `AuditEntry` shape (id, timestamp, action, actor, subject_hash, details, prev_hash, hash)
- `src/db/postgres.ts` — `query()` helper — verification function queries `audit_log` table directly
- `dashboard/app/page.tsx` — full existing dashboard component — add feed panel and integrity modal here
- `dashboard/app/api/approvals/route.ts` — pattern for new API routes in dashboard
- `dashboard/app/globals.css` — existing style system (glassmorphism tokens, badge classes)

### Stack Decisions (carry-forward)
- React Query with 5-second polling (Phase 5, D-06) — audit log feed uses same pattern
- Dark glassmorphism aesthetic (Phase 5, D-04) — all new UI must match: deep navy bg, glass cards, status colors
- `console.log` forbidden in MCP server and dashboard API routes — only `console.error`
- All `.js` extensions required in MCP server imports (NodeNext module resolution)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AuditLogger.hashIdentifier()` and `canonicalize()` — reuse these exact functions in the verify logic to reproduce hashes deterministically
- `query<T>()` from `src/db/postgres.ts` — direct Postgres query helper, no ORM overhead
- Existing badge/status color system in `globals.css` — extend with `verify-pass` (emerald) and `verify-fail` (rose) tokens
- React Query setup in `dashboard/app/providers.tsx` — new `useQuery` hooks just work

### Established Patterns
- API routes in `dashboard/app/api/approvals/route.ts` — GET returns JSON from in-memory store; new `/api/audit-log` route follows same pattern but reads from Postgres
- Status badges use inline class names matching CSS variables — follow same pattern for verify result badges
- Error handling in MCP tool handlers: try/catch returning `{ isError: true }` — consistent pattern already established

### Integration Points
- New API route: `dashboard/app/api/audit-log/route.ts` — GET returns last 50 audit entries from Postgres
- New API route: `dashboard/app/api/verify-integrity/route.ts` — GET walks the hash chain and returns per-entry results
- New script: `src/scripts/tamper.ts` — direct Postgres UPDATE; add to `package.json` scripts as `demo:tamper`
- Toast component: self-contained, rendered at root of `page.tsx` (or layout)

</code_context>

<specifics>
## Specific Implementation Notes

- The verify logic: read ALL audit entries ORDER BY id ASC, then walk them: for each entry reconstruct the canonical string using `AuditLogger.canonicalize(action, actor, subject_hash, details, prev_hash)`, hash it with SHA-256, compare with stored hash. If mismatch → mark as failed and stop walking (subsequent entries are untrusted).
- GENESIS as the first prev_hash — the first entry's prev_hash is the literal string `"GENESIS"` (see logger.ts:36).
- The counter animation (`12/47 entries checked...`) requires knowing total count before walking. Do a `SELECT COUNT(*)` first, then walk.
- Audit log feed: a new endpoint, not reading from the existing in-memory stores — must query Postgres directly.
- README novelty angle: "The governance layer IS the product" — not just another data tool; hash chain + approval gate + rollback is the trust primitive that AI agent ecosystems need.

</specifics>

<deferred>
## Deferred Ideas

- Audit log feed did not need discussion (straightforward from requirements) — agent handles layout
- Real-time WebSocket push for audit feed (already out of scope — polling is sufficient)
- Export audit log as PDF/CSV for compliance reports (v2 scope)
- "Seed fresh demo state" button in dashboard (deferred — `npm run seed` already handles this)

</deferred>

---

*Phase: 07-integrity-verification-polish*
*Context gathered: 2026-07-20*
