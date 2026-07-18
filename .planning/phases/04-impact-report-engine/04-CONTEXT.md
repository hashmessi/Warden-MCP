# Phase 4: Impact Report Engine — Context

**Gathered:** 2026-07-19
**Status:** Ready for planning
**Mode:** Agent discretion (user requested efficient execution)

<domain>
## Phase Boundary

Phase 4 transforms a raw `ScanResult` (produced by Phase 3's `scanSubject`) into a human-readable blast-radius impact report. It exposes `generate_impact_report` as a second MCP tool. Two output modes: deterministic template (no API key needed) and optional LLM-enriched narrative.

**Delivers:**
- `src/impact/report.ts` — deterministic template engine that builds a structured `ImpactReport`
- `src/impact/llm.ts` — optional LLM enrichment wrapper (OpenAI-compatible, graceful fallback)
- `generate_impact_report` MCP tool registered in `src/index.ts`
- Report result stored in-memory for Phase 5 (approval gate)

**Does NOT deliver:**
- Any UI rendering (Phase 5 dashboard)
- Approval gate or execution logic

</domain>

<decisions>
## Implementation Decisions

### Report Structure (D-01)
The `ImpactReport` type has these sections:
```typescript
interface ImpactReport {
  reportId: string;          // UUID
  scanId: string;            // links to ScanResult
  generatedAt: string;       // ISO8601
  subject: string;           // identifier from scan
  sections: {
    dataFound: DataFoundSection;
    dependencies: DependencySection;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    recommendedAction: string;
  };
  narrative?: string;        // populated by LLM enrichment only
}
```

### Deterministic Template (D-02)
Template engine reads `ScanResult.hits` and:
- **dataFound**: lists all systems, tables, row counts, sensitivity tags
- **dependencies**: filters hits where `hasOrphanRisk === true` → lists `orphanDetails`
- **riskLevel**: computed from rules:
  - `CRITICAL` if any hit has `hasOrphanRisk: true` with active subscriptions
  - `HIGH` if total records > 50 or financial data present
  - `MEDIUM` if PII present across multiple systems
  - `LOW` otherwise
- **recommendedAction**: deterministic string based on riskLevel

### LLM Enrichment (D-03)
- Check `config.llm.enabled` (env: `LLM_ENABLED=true`)
- If enabled, call OpenAI Chat Completions with a system prompt that asks for a 3-sentence plain-English narrative summarizing the report
- If disabled OR API call fails → `narrative` field is omitted (graceful fallback, never throws)
- Model: `gpt-4o-mini` (cheapest capable model)

### MCP Tool Registration (D-04)
- Tool name: `generate_impact_report`
- Input: `{ scan_id: string }` — zod validated
- Fetches ScanResult via `getScanResult(scanId)` from scanner.ts
- Stores ImpactReport in its own in-memory Map keyed by `reportId`
- Exports `getImpactReport(reportId)` for Phase 5

### Audit Integration (D-05)
- `APPROVAL_REQUESTED` audit event is NOT logged here (that's Phase 5)
- No audit write in Phase 4 — the scan was already logged in Phase 3

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Foundation
- `.planning/ROADMAP.md` — Phase 4 success criteria (lines 71–83)
- `.planning/REQUIREMENTS.md` — IMPT-01..04, MCP-02

### Existing Code (read before writing)
- `src/adapters/types.ts` — `ScanResult`, `DataHit`, `FieldHit` interfaces
- `src/scanner.ts` — `getScanResult(scanId)` export
- `src/config.ts` — `config.llm.enabled`, `config.llm.openaiApiKey`
- `src/index.ts` — where `generate_impact_report` tool must be registered

</canonical_refs>

<specifics>
## Specific Implementation Notes

- All imports use `.js` extension (NodeNext resolution)
- Never `console.log()` — only `console.error()` for debug
- LLM failure must never propagate — wrap in try/catch, return report without narrative
- Phase 5 (approval gate) will call `getImpactReport(reportId)` — export it from `src/impact/report.ts`
- `openai` npm package is NOT installed — call the API with native `fetch` to avoid adding dependencies

</specifics>

---

*Phase: 04-impact-report-engine*
*Context gathered: 2026-07-19*
