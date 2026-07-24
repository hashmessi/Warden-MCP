# Phase 6 Plan: Execute, Snapshot & Rollback

**Phase Goal:** Build the execution engine with pre-mutation snapshots and full rollback capability. This is the demo's climax — delete data, then restore it with audit trail intact.

**Status: ✅ COMPLETE** — All implementation verified code-complete. E2E verification requires live Docker/Postgres environment.

## 1. Core Architecture
- [x] Implement `executeAction` and `rollbackAction` in `src/execution/engine.ts`
- [x] Integrate `AuditLogger` to log `EXECUTION_STARTED`, `SNAPSHOT_TAKEN`, `EXECUTION_COMPLETED`, `EXECUTION_FAILED`, `ROLLBACK_COMPLETED`.
- [x] Use a centralized Postgres `snapshots` table for snapshot storage.
- [x] Add `execution_steps` table for per-adapter step transaction logging (remediation).

## 2. Adapter Integrations
- [x] **PostgresAdapter:** Implement `snapshotRecords` to dump rows from `users`, `user_profiles`, `subscriptions`, and `user_activity` to JSON. Implement `deleteRecords` (cascade delete or anonymize fields). Implement `restoreRecords`.
- [x] **MongoDbAdapter:** Implement `snapshotRecords` for `sessions` and `activity_logs`. Implement `deleteRecords` and `restoreRecords`. Fix ObjectId restoration bug (remediation).
- [x] **PaymentLedgerAdapter:** Implement `snapshotRecords`, `deleteRecords`, and `restoreRecords` for the ledger. Add disk persistence to `src/db/ledger.json` (remediation).

## 3. MCP Tool Exposure
- [x] Expose `execute_approved_action` MCP tool in `src/index.ts`.
- [x] Expose `rollback_action` MCP tool in `src/index.ts`.

## 4. Dashboard UI
- [x] Add Rollback button to `DashboardPage` for completed executions.
- [x] Implement `/api/approvals/[token]/rollback` Next.js route.
- [x] Create `src/scripts/rollback.ts` to be invoked by the API route.

## Verification
- E2E flow requires live Postgres + MongoDB (Docker). See README.md → Demo Walkthrough.
- TypeScript typecheck: ✅ PASS
- Backend build (`npm run build`): ✅ PASS
- Dashboard build (`npm run build` in dashboard/): ✅ PASS

