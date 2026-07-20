# Phase 7: Integrity Verification & Polish — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-20
**Phase:** 07-integrity-verification-polish
**Areas discussed:** Verify Integrity UX, Demo Polish & Readiness, Edge Case Error Handling

---

## Verify Integrity UX

| Option | Description | Selected |
|--------|-------------|----------|
| Modal dialog | Click 'Verify Integrity', a modal slides up showing the chain walk progress and per-entry results. Closes when done. | ✓ |
| Inline side panel | Results appear in a dedicated panel/section within the dashboard, stays visible while you browse other requests. | |
| Replace the audit feed | Verification results temporarily replace the live audit log entries with pass/fail overlays, then revert. | |

**User's choice:** Modal dialog

---

| Option | Description | Selected |
|--------|-------------|----------|
| Animated progress sweep | Entries appear one-by-one (e.g., 200ms apart) with ✓ or ✗ icon. Demo-dramatic. | |
| Instant results | Modal opens, spinner briefly, then all results appear at once. Cleaner, less theatrical. | |
| Batch reveal (recommended) | Modal shows a fast counter '12/47 entries checked...' then reveals all results at once. Quick feedback + some drama. | ✓ |

**User's choice:** Batch reveal with counter

---

| Option | Description | Selected |
|--------|-------------|----------|
| Green banner only | 'All 47 entries verified ✓' with a summary count. Minimal, confident. | |
| Green banner + collapsible entry list (recommended) | Pass banner + user can expand to see each entry's hash snippet. | ✓ |
| Always show full list | Every entry rendered with action, hash snippet, and ✓/✗. Full audit transparency. | |

**User's choice:** Green banner + collapsible list

---

## Demo Polish & Readiness

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard tamper button | Dedicated UI button that mutates one audit entry's hash, then runs Verify Integrity to show failure. | |
| No tamper mechanism | Verification shows real data only. Tampering is out of scope. | |
| Tamper via script only (recommended) | A standalone Node script (`npm run demo:tamper`) that modifies an entry manually. No UI button. | ✓ |

**User's choice:** Tamper via script only (`src/scripts/tamper.ts`)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full demo script | Step-by-step written demo script in README.md covering every MCP command. | |
| No script | README is good enough as-is. | |
| Lightweight walkthrough (recommended) | Short 'Demo Walkthrough' section in README with key commands and expected outcomes. | |

**User's choice (free text):** Effective README with one-liner, problem statement, solution, industry need, project architecture, and novelty. Clean but not exhaustive. Include short demo walkthrough commands.

---

## Edge Case Error Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Toast notifications | Non-blocking banners that slide in for 3-4 seconds. Good for recoverable errors. | |
| Inline error states | Error message appears inside the relevant panel/section. Stays visible until dismissed. | |
| Toast for recoverable, inline for blocking (recommended) | 'Scan found nothing' = toast. 'Double-approve attempt' = inline error on request row. | ✓ |

**User's choice:** Mixed approach — toast for recoverable, inline for blocking

---

## Agent's Discretion

- Exact layout positioning of audit log feed panel within existing page.tsx
- Hash display format in feed (first 8 chars chosen by agent)
- Toast animation style — must match glassmorphism aesthetic

## Deferred Ideas

- Real-time WebSocket push for audit feed (already out of scope)
- Export audit log as PDF/CSV (v2 scope)
- "Seed fresh demo state" dashboard button (deferred — `npm run seed` handles this)
