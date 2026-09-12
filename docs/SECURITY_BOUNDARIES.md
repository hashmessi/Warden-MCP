# Warden Security Boundaries & Invariant Contracts

**Version:** 1.0.0  
**Target System:** Warden Governed Data-Rights Execution Agent  
**Classification:** Security Architecture & Invariant Guarantees  

---

## 1. The Core Governance Axiom: Separation of Intent vs. Authority

In conventional AI agent architectures, an LLM is given access to tools and autonomously decides when, how, and what to mutate. In high-stakes enterprise data operations (such as GDPR/CCPA data deletion, tenant offboarding, or ledger modifications), **granting an agent both Intent and Authority is an existential security vulnerability.**

```
┌────────────────────────────────────────────────────────────────────────┐
│                              INTENT LAYER                              │
│  Actor: Autonomous AI Agent / MCP Client (Untrusted)                  │
│                                                                        │
│  - Finds records across systems (`scan_subject`)                       │
│  - Synthesizes risk reports (`get_impact_report`)                      │
│  - Proposes a data-rights action (`request_execution`)                 │
│                                                                        │
│  CANNOT: Approve actions, bypass blast-radius review, or mutate data.  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         PROPOSAL TOKEN (UUIDv4)
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           AUTHORITY BOUNDARY                           │
│  Actor: Human Governance Operator / Enterprise IdP (Trusted)          │
│                                                                        │
│  - Reviews deterministic blast-radius calculations                     │
│  - Evaluates orphan risk and financial impact                          │
│  - Signs / grants approval token (`approveAction`) via out-of-band UI  │
│                                                                        │
│  MANDATE: Only humans possess the authority to authorize destruction.  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                          APPROVED TOKEN (CAS Locked)
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            EXECUTION LAYER                             │
│  Actor: Warden Execution Engine & Data Adapters (Trusted Core)         │
│                                                                        │
│  - Pre-execution complete snapshotting (`snapshotRecords`)             │
│  - Atomic multi-system mutation (`deleteRecords`)                      │
│  - Automated saga compensation on failure (`restoreRecords`)           │
│  - Append-only cryptographically linked audit receipts                 │
└────────────────────────────────────────────────────────────────────────┘
```

### The Boundary Rule
> **An agent may express intent; only a human authority may confer execution capability.**  
> If an agent possesses both `request_execution` and `approve_execution` within its accessible MCP tool palette, the security boundary collapses into a no-op.

---

## 2. System Boundaries & Trust Domains

### Boundary 1: The Agent / MCP Client Boundary
- **Inside the Boundary:** Prompt context, tool call formatting, reasoning loops, conversation state.
- **Outside the Boundary:** Database credentials, direct SQL/NoSQL drivers, raw storage endpoints.
- **Enforcement:** The agent interacts with Warden exclusively via JSON-RPC over stdio or SSE. All incoming parameters are validated by strict Zod schemas. Any unrecognized or malicious properties are stripped or rejected.

### Boundary 2: The Approval Token Boundary
- **Structure:** Cryptographically strong UUIDv4 tokens bound to a single immutable `scan_id` and action intent.
- **State Machine:**
  ```
  [PENDING] ────(Human Approves)────► [APPROVED] ────(executeAction CAS)────► [EXECUTING]
      │                                                                           │
      ├─────(Human Denies)──────► [DENIED]                                        ├──(Success)──► [EXECUTED]
      │                                                                           │
      └─────(Timeout / Stale)───► [EXPIRED]                                       └──(Failure)──► [ROLLED_BACK]
  ```
- **Guarantees:**
  - `APPROVED` state can only be entered once.
  - `EXECUTING` state can only be acquired by exactly one thread via SQL atomic Compare-And-Swap (`UPDATE ... WHERE status = 'approved' RETURNING *`).
  - Stale, denied, or already consumed tokens immediately reject with zero storage side-effects.

### Boundary 3: The Data Layer & Snapshot Boundary
- **Snapshots are Immutable Artifacts:** Before a single row or document is deleted or anonymized, complete entity state is serialized into the `snapshots` relation with `execution_id`.
- **Topological Integrity:** Snapshots preserve entity relationships. Restoration executes in strict insertion order (`ORDER BY id ASC`), ensuring foreign key dependencies are satisfied (parents before children).

### Boundary 4: The Audit Trail Boundary (Tamper-Evident vs. Tamper-Proof)
It is critical to distinguish between **tamper-evident** and **tamper-proof** systems:
- **Warden is Tamper-Evident:** Every entry in `audit_log` contains a SHA-256 hash computed from:
  $$\text{Hash}_n = \text{SHA-256}(\text{Action} \parallel \text{Actor} \parallel \text{SubjectHash} \parallel \text{Details} \parallel \text{Hash}_{n-1})$$
  Any out-of-band modification to a previous entry invalidates all downstream hashes and is immediately surfaced by `verifyIntegrity()`.
- **Warden is NOT Tamper-Proof:** A root database administrator possessing raw `postgres` credentials could recalculate and overwrite the entire hash chain from the point of edit forward. True tamper-proofing requires external write-once-read-many (WORM) storage, witness anchoring (e.g., public blockchain or AWS QLDB), or hardware security modules (HSM).

---

## 3. Mathematical Invariant Contracts

Warden enforces four non-negotiable system invariants. A failure of any single invariant constitutes a critical system failure.

```
                  ┌─────────────────────────────────────┐
                  │          WARDEN INVARIANTS          │
                  └──────────────────┬──────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│      INV-01      │        │      INV-02      │        │      INV-03      │
│  AUTHORIZATION   │        │   IDEMPOTENCY    │        │  REVERSIBILITY   │
│       GATE       │        │  & MONOTONICITY  │        │   (LOSSLESS)     │
└──────────────────┘        └──────────────────┘        └──────────────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │      INV-04      │
                            │  TAMPER-EVIDENCE │
                            └──────────────────┘
```

### Invariant 1: The Authorization Gate (INV-01)
$$\forall \text{ mutation } M, \quad M \text{ occurs} \iff \exists T \text{ such that } \text{Status}(T) = \text{APPROVED} \land \text{Valid}(T)$$
No mutation may occur if the token is in state `PENDING`, `DENIED`, `EXECUTED`, `ROLLED_BACK`, or does not exist.

### Invariant 2: Execution Monotonicity & Idempotency (INV-02)
$$\forall T, \quad \sum \text{SuccessfulExecutions}(T) \le 1$$
$$\forall \text{ concurrent attempts } A_1, A_2, \dots, A_n \text{ on token } T, \quad \text{Count}(\text{Success}) \le 1 \land \text{AffectedRecords} = \text{TargetRecords}$$
A token cannot be consumed twice. Concurrent or replayed calls return errors and do not cause duplicate deletions or state corruption.

### Invariant 3: Lossless Reversibility (INV-03)
$$\forall \text{ execution } E \text{ with initial records } R_0, \quad \text{Rollback}(E) \implies R_{\text{restored}} = R_0 \land \text{DataFidelity}(R_{\text{restored}}, R_0) = 100\%$$
Snapshots must capture complete data. Backward compensation must restore exactly 100% of affected records across all connected datastores.

### Invariant 4: Cryptographic Tamper-Evidence (INV-04)
$$\forall \text{ entry } i \in [1, N], \quad \text{Hash}_i = H(\text{Payload}_i, \text{Hash}_{i-1})$$
$$\text{Tamper}(i) \implies \text{VerifyIntegrity}() = \text{FALSE} \land \text{BrokenAt} = i$$
Any unauthorized update or deletion of an audit record must be unequivocally detected by verification.

---

## 4. Operational Boundaries & Failure Confinement

| Failure Scenario | Boundary Containment Strategy | State Outcome |
| :--- | :--- | :--- |
| **Scanner times out on secondary store** | Scanner logs error to stderr, aggregates hits from surviving stores, flags report with partial-scan warning. | Non-fatal; report indicates incomplete coverage. |
| **Concurrent approvers click simultaneously** | Atomic SQL update with `WHERE status = 'pending'`. | Winner succeeds; all losers receive error `Failed to approve: token already processed`. |
| **Secondary store fails mid-mutation** | Mutation coordinator catches error, initiates immediate backward saga rollback on all stores from pre-mutation snapshots. | Transaction aborted; database state returned to 100% baseline; token transitioned to `rolled_back`. |
| **Restoration crashes during rollback** | Critical recovery alert logged; failed step recorded in `execution_steps`. | System enters alert state; records preserved in `snapshots` table for manual recovery. |
