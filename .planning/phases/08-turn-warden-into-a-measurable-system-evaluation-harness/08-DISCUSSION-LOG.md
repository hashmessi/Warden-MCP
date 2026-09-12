# Phase 8 Discussion Log

**Date:** 2026-09-13  
**Phase:** 8 — Week 1: Turn Warden into a Measurable System (Evaluation Harness)  
**Auditor / Reviewer Context:** GSD Phase Alignment & Design Audit  

---

## Gray Areas & Decisions

### Area 1: Eval Harness Runner Architecture
- **Question:** How should the Evaluation Harness runner be architected?
- **Options Presented:**
  1. Lightweight native TypeScript runner (`tsx src/eval/index.ts`) — zero added dev dependencies, full programmatic control over concurrency & scorecard formatting *(Selected)*
  2. Introduce Vitest with a custom reporter — standard assertion syntax and test suites, but requires new dependencies and reporter config
  3. Hybrid approach: Native CLI runner for 'npm run eval' scorecard + unit tests via existing setup
- **Outcome:** Selected Option 1. Build a zero-dependency, native TypeScript runner under `src/eval/index.ts` executed via `npm run eval`.

---

### Area 2: State Isolation & Test Seeding
- **Question:** How should test data and database state be isolated during evaluations?
- **Options Presented:**
  1. Isolated Per-Scenario Dynamic Subjects (`eval-<scenario>-<uuid>@warden.test`) — clean isolated records across PG, Mongo, and Ledger with auto-cleanup, preserving main demo data *(Selected)*
  2. Global DB Re-seed: Wipe and re-seed the entire database before and after the eval run
  3. Dedicated Static Test Users: Hardcode 11 static test accounts in the seed script
- **Outcome:** Selected Option 1. Dynamic identities prevent data pollution and ensure `jane.doe@email.com` demo data remains intact.

---

### Area 3: Fault Injection Strategy
- **Question:** How should the evaluation harness inject partial failures and rollback failures?
- **Options Presented:**
  1. Transparent Fault Injection Proxy: Composable adapter wrapper that declaratively injects failures/delays without polluting production adapter code *(Selected)*
  2. Targeted Monkey-patching: Temporarily overwrite adapter methods in test scenarios and restore in finally blocks
  3. Mock Test Adapters: Build entirely separate mock adapters specifically for failure scenarios
- **Outcome:** Selected Option 1. Implement a composable proxy wrapper around `DataAdapter` to inject system-specific dropouts, delays, and recovery failures.

---

### Area 4: Scorecard, Metrics & Telemetry Output
- **Question:** How should the scorecard and metrics be reported?
- **Options Presented:**
  1. Rich ANSI Terminal Scorecard + Persisted JSON/Markdown Summary (`.eval-results/latest.json`) — instant developer feedback and CI-ready report artifacts *(Selected)*
  2. Terminal Only: Print the ASCII scorecard directly to stdout with exit codes for CI without writing files
  3. Verbose Detailed Log: Output per-case logs to console along with the final scorecard
- **Outcome:** Selected Option 1. Scorecard prints directly to stdout with ANSI color tables and exports persistent reports for automated CI/CD gating.
