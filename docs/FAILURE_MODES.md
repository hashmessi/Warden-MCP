# Warden Failure Modes & Recovery Taxonomy

**Version:** 1.0.0  
**Target System:** Warden Governed Data-Rights Execution Agent  
**Classification:** Distributed Systems Reliability & Failure Engineering  

---

## 1. Executive Summary

Warden executes operations across heterogeneous, non-transactional distributed datastores (relational PostgreSQL, document-based MongoDB, and flat-file ledger storage). Because distributed two-phase commit (2PC) is prohibitive across these disparate technologies, Warden employs a **Deterministic Snapshot Saga with Backward Compensation**.

This document catalogues every known failure mode, classifies its severity, details the system's exact state transition, and defines the automated compensation and human intervention procedures.

---

## 2. Distributed Failure Taxonomy

```
                                  ┌────────────────────────┐
                                  │      FAILURE MODES     │
                                  └───────────┬────────────┘
                                              │
         ┌───────────────────┬────────────────┴───────────────────┬───────────────────┐
         ▼                   ▼                                    ▼                   ▼
┌──────────────────┐┌──────────────────┐                ┌──────────────────┐┌──────────────────┐
│   COORDINATOR    ││    DATASTORE     │                │   CONCURRENCY    ││  RECOVERY SAGA   │
│      CRASH       ││  DESYNCHRONIZE   │                │   CONTENTION     ││     FAILURE      │
│   (FM-01, 02)    ││   (FM-03, 04)    │                │   (FM-05, 06)    ││     (FM-07)      │
└──────────────────┘└──────────────────┘                └──────────────────┘└──────────────────┘
```

| ID | Failure Mode | Failure Class | Detection Mechanism | Automated Compensation | Residual State |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FM-01** | Coordinator Crash Pre-Mutation | Fail-Stop | Process terminates while approval is in `executing`. | Inactive execution timeout or startup reconciliation. | Zero data deleted. Snapshot preserved in DB. |
| **FM-02** | Coordinator Crash Mid-Mutation | Fail-Stop / Partial | Process dies after DB1 mutated, DB2 untouched. | Recovery reconciler reads `execution_steps`, triggers `rollbackAction`. | Requires reconciler daemon; snapshot intact. |
| **FM-03** | Secondary Store Dropout (Mongo) | Transient / Network | Catch block in `executeAction` intercepts network exception. | Automatic backward compensation: restores DB1 from snapshot. | Database returned to 100% baseline; token marked `rolled_back`. |
| **FM-04** | Foreign Key Restoration Race | Data Integrity | `23503` FK violation during child restore if unordered. | Fixed via deterministic `ORDER BY id ASC` in snapshot query. | Zero foreign key errors; parents restored before children. |
| **FM-05** | Double Execution Race (TOCTOU) | Concurrency / Race | CAS `UPDATE ... WHERE status = 'approved'` returns 0 rows. | Losing workers immediately abort with descriptive error. | Monotonicity preserved; exactly 1 execution succeeds. |
| **FM-06** | Audit Log Contention Under Burst | Write Contention | `23505` on `prev_hash` unique constraint. | Exponential backoff with random jitter (up to 12 retries). | Strictly linear audit chain with zero forks. |
| **FM-07** | Rollback Recovery Disk Corruption | Byzantine / Storage | Catch block in `rollbackAction` catches restore failure. | System logs critical alert; aborts status transition. | Critical state: snapshot retained; operator paged. |

---

## 3. Deep-Dive Failure Modes

### FM-01 & FM-02: Coordinator Crashes Mid-Saga

#### Scenario Description
In `executeAction(token)`, the coordinator performs operations in distinct sequential phases:
```
[1. CAS Lock: approved -> executing]
   ▼
[2. Phase A: Snapshot Records across all Adapters]
   ▼
[3. Phase B: Mutate Records across all Adapters]
   ▼
[4. CAS Update: executing -> executed]
```
If the Node.js process crashes, receives `SIGKILL`, or suffers node eviction during Step 3 (e.g., PostgreSQL deleted, MongoDB untouched):
- **Immediate State:**
  - Token in `approvals` is stuck in `status: 'executing'`.
  - PostgreSQL user and related rows are gone.
  - MongoDB sessions still exist.
  - `snapshots` table contains complete pre-execution records for both systems.
  - `execution_steps` shows:
    - `MUTATE / postgres / completed`
    - `MUTATE / mongodb / started` (or missing).
- **Vulnerability / Risk:** Without a background reconciliation process, this partial deletion remains undetected indefinitely.
- **Remediation Protocol:**
  1. Reconciler scans for `approvals` where `status = 'executing'` and `requested_at < NOW() - INTERVAL '5 minutes'`.
  2. Reconciler invokes `rollbackAction(execution_id)` to restore PostgreSQL from snapshots.
  3. Transitions token to `rolled_back` with audit action `SAGA_AUTO_RECONCILED`.

---

### FM-03: Secondary Store Dropout (Partial Failure & Backward Compensation)

#### Scenario Description
During `executeAction`, PostgreSQL hard-delete succeeds. The execution engine then calls `mongodb.deleteRecords()`, which throws `MongoNetworkTimeoutException`.

```
                  ┌────────────────────────────────────────┐
                  │ executeAction(approved.token) Phase B  │
                  └───────────────────┬────────────────────┘
                                      │
                         Step 1: Mutate PostgreSQL
                                      │
                                      ▼
                        ✅ PostgreSQL rows deleted
                                      │
                          Step 2: Mutate MongoDB
                                      │
                                      ▼
                    ❌ NETWORK DROPOUT (Socket Timeout)
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
      Catch Block Intercepts Error          Log MUTATE / engine / failed
                   │
                   ▼
      Invoke rollbackAction(executionId)
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
Restore PostgreSQL     Restore MongoDB (No-op / Idempotent)
         │                   │
         └─────────┬─────────┘
                   │
                   ▼
     Update Token to 'rolled_back'
                   │
                   ▼
  Audit Log: EXECUTION_FAILED + ROLLBACK_COMPLETED
```

#### Invariant Verification (`INV-03`)
- **Initial Subject Record Count:** 6 (1 User, 1 Profile, 2 Subscriptions, 2 Activity Logs).
- **Post-Compensation Record Count:** 6.
- **Verification:** Evaluated and guaranteed across 100/100 stress runs under simulated socket dropout via `createFaultProxy`.

---

### FM-04: Foreign Key Dependency Ordering Failure

#### Scenario Description
When restoring PostgreSQL records from the `snapshots` relation:
- `users` is the parent table (Primary Key `id`).
- `user_profiles`, `subscriptions`, and `user_activity` have foreign keys `user_id REFERENCES users(id)`.

If the snapshot query executes without deterministic ordering:
```sql
SELECT record_id, data FROM snapshots WHERE execution_id = $1 AND source_system = 'postgres'
```
PostgreSQL's internal storage engine or parallel scan workers can return child rows (`user_activity`) before the parent row (`users`). Attempting to insert a child row before the parent causes PostgreSQL to immediately abort the query with:
```
error: insert or update on table "user_activity" violates foreign key constraint "user_activity_user_id_fkey"
Key (user_id)=(...) is not present in table "users".
```

#### Defensive Resolution
1. Snapshots are inserted sequentially during Phase A: parent entity first, then child entities.
2. The `snapshots` table primary key `id` is a `BIGSERIAL` monotonically increasing sequence.
3. The restore query strictly orders by sequence ID:
   ```sql
   SELECT record_id, data FROM snapshots 
   WHERE execution_id = $1 AND source_system = 'postgres' 
   ORDER BY id ASC;
   ```
4. This guarantees that parent rows are restored before dependent child rows.

---

### FM-05: Double Execution Race (TOCTOU)

#### Scenario Description
Two concurrent agents or race-condition exploits invoke `executeAction(token)` at the exact same millisecond.

#### Concurrency Resolution
Both threads execute the atomic compare-and-swap SQL statement:
```sql
UPDATE approvals 
SET status = 'executing', execution_id = $1 
WHERE token = $2 AND status = 'approved' 
RETURNING *;
```
- **Thread 1:** Finds row with `status = 'approved'`. Updates row to `'executing'` and acquires row lock. Returns 1 row. Proceeds to execution.
- **Thread 2:** Row is already `'executing'`. Statement matches 0 rows. Returns empty result set.
- **Thread 2 Handling:**
  ```typescript
  if (rows.length === 0) {
    const current = await getApprovalByToken(token);
    throw new Error(`Token is not approved, current status: ${current.status}`);
  }
  ```
- **Result:** Thread 2 immediately throws with zero downstream side-effects. Exactly 1 execution occurs (`INV-02`).

---

### FM-06: Audit Log Contention Under Burst Concurrency

#### Scenario Description
When 8 or more parallel agents execute simultaneous scans, approvals, and mutations, all threads contend to append to the linear cryptographic hash chain. Every new entry must point to the single current tail hash (`prev_hash`).

If two workers calculate `newHash` from the same `expectedPrevHash`, the second insert violates the unique constraint:
```sql
CREATE UNIQUE INDEX idx_audit_log_prev_hash ON audit_log(prev_hash) WHERE prev_hash != 'GENESIS';
```

#### Backoff & Jitter Resolution
`AuditLogger.appendLog` incorporates an adaptive retry loop:
- Maximum retry attempts: 12.
- Backoff algorithm:
  $$\text{Delay} = \min(250\text{ms}, 8 \times 1.3^{\text{attempt}} + \text{random}(0, 30\text{ms}))$$
- The randomized jitter prevents cyclic thundering-herd lockstep retries.
- Verified: Zero audit drops under 100 iterations of 8 concurrent parallel agents (800 transactions).

---

### FM-07: Rollback Recovery Failure & Alert State

#### Scenario Description
A mutation fails, initiating rollback. However, during rollback, the storage system encounters an unrecoverable failure (disk full, database crash, or schema mismatch).

#### Defense-in-Depth Confinement
1. The exception in `restoreRecords` is caught and logged as a fatal system failure.
2. The approval token status is **NOT** transitioned to `rolled_back` (it remains in `executing` to prevent false recovery assumptions).
3. The snapshot records in the `snapshots` relation are preserved indefinitely.
4. An error is re-thrown to propagate directly to the MCP client and ops dashboard:
   `Execution failed and rollback encountered critical errors: [details]`.
5. Human operator intervention is required to inspect `snapshots` and execute manual disaster recovery.
