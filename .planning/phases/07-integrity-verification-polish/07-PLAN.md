---
phase: 7
wave: 1
requirements_addressed: [AUDT-04, AUDT-05, DASH-05, DASH-06]
files_modified:
  - dashboard/app/api/audit-log/route.ts
  - dashboard/app/api/verify-integrity/route.ts
  - dashboard/app/page.tsx
  - dashboard/app/globals.css
  - src/scripts/tamper.ts
  - package.json
  - README.md
autonomous: true
---

# Phase 7 Plan: Integrity Verification & Polish

**Phase Goal:** Add audit chain verification, live audit log feed in dashboard, edge case error handling, demo tamper script, and a comprehensive README.

## must_haves
- "Verify Integrity" button in dashboard header triggers modal that walks hash chain and shows per-entry pass/fail
- Live audit log feed visible in dashboard, polling every 5 seconds
- `npm run demo:tamper` script corrupts one audit entry hash for demo purposes
- Graceful toast errors for recoverable cases; inline errors for blocking cases
- Comprehensive README with project architecture and demo walkthrough
