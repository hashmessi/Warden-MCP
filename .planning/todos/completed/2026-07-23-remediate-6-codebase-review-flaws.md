---
created: 2026-07-23T14:43:29.456Z
title: Remediate 6 Codebase Review Flaws
area: architecture
files:
  - src/audit/logger.ts:55
  - src/adapters/mongodb.adapter.ts:92
  - src/adapters/payment.adapter.ts:23
  - src/execution/engine.ts:47
  - dashboard/app/api/verify-integrity/route.ts:43
  - dashboard/app/api/verify-integrity/route.ts:21
---

## Problem

The Senior Developer Codebase Review identified 6 critical issues across concurrency, MongoDB restoration, state persistence, multi-system transactions, code duplication, and memory usage:

1. **Hash Chain Forking**: `src/audit/logger.ts` lacks a UNIQUE constraint on `prev_hash`/`hash`, allowing concurrent requests to create audit log forks.
2. **MongoDB Restoration Type Mismatch**: `src/adapters/mongodb.adapter.ts` stores `_id` as string in snapshots and fails to convert back to `ObjectId` upon replacement, causing schema pollution/duplicates.
3. **In-Memory Payment Ledger Data Loss**: `src/adapters/payment.adapter.ts` loses state across process restarts.
4. **Un-transactional Deletion Engine**: `src/execution/engine.ts` lacks atomic multi-adapter execution logging for partial crash recovery.
5. **Duplicated Stringification Logic**: `dashboard/app/api/verify-integrity/route.ts` duplicates `stableStringify` from `src/audit/logger.ts`.
6. **Full-Table Memory Walk**: `dashboard/app/api/verify-integrity/route.ts` loads all `audit_log` rows into memory at once.

## Solution

1. Add UNIQUE constraint/index on `audit_log(prev_hash)` and `audit_log(hash)`.
2. Convert string `_id` to `ObjectId` using `ObjectId.isValid(data._id) ? new ObjectId(data._id) : data._id` in `MongoDbAdapter.restoreRecords`.
3. Persist `PaymentLedgerAdapter` mock state to a disk JSON file (`src/db/ledger.json`).
4. Add an `execution_steps` transaction log table to track adapter deletion states.
5. Extract `stableStringify` to a shared helper module.
6. Paginate or batch integrity verification queries in `/api/verify-integrity`.
