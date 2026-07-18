# Phase 4: Impact Report Engine — Plan 01 Summary

**Completed:** 2026-07-19
**Plan:** 04-01-PLAN.md

## What Was Done

Created three files that together form the impact report engine:

### `src/impact/types.ts`
Defines the full `ImpactReport` shape: `DataFoundSection`, `DependencySection`, `DependencyItem`, `RiskLevel`, and `ImpactReport`. Imports `SensitivityTag` from the existing adapter types for consistency.

### `src/impact/llm.ts`
Optional enrichment wrapper using native `fetch` (no extra dependencies):
- Skips silently if `LLM_ENABLED` is not `true` or no API key is set
- Calls OpenAI `gpt-4o-mini` with a focused 3-sentence narrative prompt
- Any failure (network, API error, bad response) is caught and logged to stderr — report returned unchanged

### `src/impact/report.ts`
Deterministic template engine:
- **riskLevel** computed from `hasOrphanRisk`, total records, sensitivity tags, and PII spread across systems
- **dependencies** section populated from hits with `hasOrphanRisk: true` — includes `orphanDetails` text
- **recommendedAction** is a deterministic, human-readable string based on riskLevel
- In-memory `reportStore` Map with `getImpactReport(reportId)` exported for Phase 5

## Must-Haves Satisfied

- [x] generateImpactReport(scanResult) returns structured ImpactReport
- [x] riskLevel is CRITICAL when hasOrphanRisk is true (jane.doe has 2 active subscriptions → CRITICAL)
- [x] dependencies section lists orphanDetails for all risky hits
- [x] Report works without LLM key — narrative field simply absent
- [x] getImpactReport(reportId) retrieves stored report
