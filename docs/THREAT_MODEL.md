# Warden Threat Model

**Version:** 1.0.0  
**Target System:** Warden — Governed Data-Rights Execution Agent (MCP Server & Governance Harness)  
**Classification:** Production Governance & Threat Architecture  

---

## 1. System Overview & Trust Assumptions

Warden is an execution agent and trust infrastructure designed to find, report, delete, and rollback personal data across distributed datastores (PostgreSQL, MongoDB, and an in-memory/disk financial ledger). Unlike autonomous deletion bots, Warden implements strict architectural separation between **data discovery/intent**, **human authorization**, and **physical execution**.

### Architectural Surface & Data Flow

```
┌─────────────────────────┐         Tool Calls (JSON-RPC)        ┌─────────────────────────┐
│ Autonomous AI Agent /   ├─────────────────────────────────────►│  Warden MCP Server     │
│ Host Client             │◄─────────────────────────────────────┤  (Local Stdio / SSE)    │
└─────────────────────────┘         Tool Results (Schemas)        └──┬───────────┬─────────┘
                                                                     │           │
                     Approval Hook (Out-of-band)                     │           │
         ┌───────────────────────────────────────────────────────────┘           │
         ▼                                                                       ▼
┌─────────────────────────┐                                       ┌─────────────────────────┐
│ Human Governance Ops    │                                       │ Distributed Datastores  │
│ (Dashboard / Admin)     │                                       │ - PostgreSQL (Primary)  │
└─────────────────────────┘                                       │ - MongoDB (Sessions)    │
                                                                  │ - Payment Ledger        │
                                                                  └─────────────────────────┘
```

### Core Trust Boundaries

| Entity | Trust Level | Description & Assumptions |
| :--- | :--- | :--- |
| **LLM Agent / MCP Host** | **UNTRUSTED** | May hallucinate, suffer from prompt injection, become goal-hijacked, or maliciously attempt mass deletion while strictly conforming to tool schemas. |
| **MCP Tool Interface** | **BOUNDARY** | Schema enforcement, parameter validation, rate limiting, and strict separation of Intent vs Authority. |
| **Human Approver / IdP** | **SEMI-TRUSTED** | Authorized to approve blast-radius impact reports. In production, bound to enterprise SSO/RBAC. In current profile, hardcoded single-admin role. |
| **Execution Engine** | **TRUSTED** | Internal coordinator enforcing atomic Compare-And-Swap (CAS), pre-execution snapshots, and backward saga compensation. |
| **Audit Log (Hash Chain)**| **TAMPER-EVIDENT** | SHA-256 linear hash chain verifying sequential ordering. Tamper-evident, *not* tamper-proof (cannot prevent root database admin rewrite without offsite replication). |
| **Datastores** | **DATA LAYER** | Assumed vulnerable to transient network drops, deadlocks, and connection exhaustion. |

---

## 2. Attacker Personas & Threat Capabilities

### Persona A: The Compromised or Rogue Autonomous AI Agent
- **Motivation:** Goal hijacking, prompt injection via ingested user data (e.g., prompt injection embedded in a user's address field), or misaligned recursive optimization.
- **Capabilities:** Can invoke any exposed MCP tool (`scan_subject`, `get_impact_report`, `request_execution`, `approve_execution`, `execute_action`, `rollback_action`).
- **Constraint:** Must formulate syntactically valid JSON payloads adhering to input schemas.

### Persona B: The Malicious MCP Client / Host
- **Motivation:** Exfiltrate data, bypass organizational compliance gates, or tamper with execution parameters.
- **Capabilities:** Controls the transport layer (stdio/SSE), can drop, intercept, delay, or replay tool invocations and responses.

### Persona C: The Rogue Internal Operator / DB Insider
- **Motivation:** Cover up unauthorized deletions, alter financial histories, or sabotage system integrity.
- **Capabilities:** Direct SQL/Mongo query access to the underlying storage engines outside of MCP or application code.

### Persona D: The Adversarial Data Subject
- **Motivation:** Privilege escalation, denial of service, or cross-tenant data corruption.
- **Capabilities:** Controls data supplied during onboarding (e.g., email address containing SQL injection payloads, wildcard patterns, or Unicode homoglyphs).

---

## 3. STRIDE Threat Analysis

| Threat Category | Target Subsystem | Attack Vector | Impact | Mitigation / Status |
| :--- | :--- | :--- | :--- | :--- |
| **Spoofing** | Approval Gate | Agent invokes `approve_execution` directly or passes fabricated approver ID. | Unauthorized deletion executed without human consent. | **VULNERABILITY IDENTIFIED:** Tool `approve_execution` exposed directly on MCP. Must be gated exclusively to out-of-band human dashboard. |
| **Tampering** | Audit Trail | Rogue DB admin or SQL injection alters historical log row. | Conceals compliance violations or unauthorized actions. | **MITIGATED:** SHA-256 hash chain links each entry to `prev_hash`. `verifyIntegrity()` detects alteration immediately (`INV-04`). |
| **Repudiation** | Execution Engine | Agent triggers deletion, then denies initiating it. | Auditing cannot prove provenance of destructive mutation. | **MITIGATED:** Every state change emits immutable audit log containing `actor`, `subject_hash`, `timestamp`, and transaction tokens. |
| **Information Disclosure**| Discovery Scanner | Agent scans arbitrary third-party identifiers to inspect PII hits. | Cross-tenant data exfiltration and profiling. | **PARTIALLY MITIGATED:** Scans return schema metadata and sample IDs. Production requirement: require data subject proof-of-ownership token. |
| **Denial of Service** | Snapshot Engine | Agent initiates hundreds of scans and execution requests on massive subjects. | DB disk exhaustion from snapshots; connection pool exhaustion. | **MITIGATED:** Bounded connection pools, automatic cleanup in test harness, transaction timeouts. |
| **Elevation of Privilege**| Execution Engine | Calling `execute_action` with `status: pending` or fabricated UUID. | Direct database mutation without prior approval gate. | **MITIGATED:** Atomic SQL CAS (`UPDATE approvals ... WHERE status = 'approved' RETURNING *`). Stale/unapproved tokens strictly reject (`INV-01`). |

---

## 4. In-Depth Attack Vectors (The 4 Threat Classes)

### Vector 1: Agent Attacks (Schema-Conforming Malicious Optimization)
An autonomous agent trying to cause maximum destruction does not need to break cryptography or SQL syntax; it uses the API against itself.
1. **Self-Approval Hijacking:** The agent calls `scan_subject`, gets `scan_id`, calls `request_execution`, receives `token`, and immediately calls `approve_execution(token, "admin")`, followed by `execute_action(token)`.
   - *Exploit:* Total bypass of human governance.
   - *Remediation:* Remove `approve_execution` from the agent's MCP tool definition. Approvals must only be admitted via authenticated webhook / UI.
2. **Identifier Flooding / Wildcard Scanning:** Passing `%`, `*`, or empty string to `scan_subject` in attempts to trigger bulk discovery across the entire database.
   - *Mitigation:* Explicit identifier validation (strict email regex / UUID parser) rejecting wildcard characters.
3. **Execution Oscillations (Yo-Yo Denial of Service):** Rapidly calling `execute_action` -> `rollback_action` -> `execute_action` on high-volume user data.
   - *Exploit:* Thrashing database write pipelines, blowing up WAL logs, polluting the audit log with millions of entries.
   - *Mitigation:* Terminal state enforcement. Once a token is `rolled_back`, it cannot be re-executed.

### Vector 2: MCP Protocol & Transport Attacks
1. **Tool Schema Poisoning:** A rogue intermediary alters the MCP tool definition to widen accepted types or drop security fields.
   - *Mitigation:* Server-side Zod validation on every input payload, rejecting unrecognized fields (`strip` or `strict`).
2. **Tool Result Manipulation:** The MCP client intercepts the output of `get_impact_report` and replaces `risk_level: "HIGH"` with `risk_level: "LOW"` before presenting it to an LLM evaluator.
   - *Mitigation:* Impact reports are persisted cryptographically by `report_id` and linked to the approval token in PostgreSQL; the agent cannot pass altered report objects to `execute_action`.

### Vector 3: Cross-System Data Attacks
1. **Cascading Foreign Key Traps:** Deleting a user in PostgreSQL cascades to `subscriptions` and `user_profiles`. If restoration does not strictly enforce topological order (`ORDER BY id ASC` or parent-first), restoration crashes on missing foreign keys (`23503`), leaving child records un-restorable.
   - *Observed & Fixed:* Resolved in Phase 8.1 with deterministic order enforcement in `PostgresAdapter.restoreRecords`.
2. **Multi-Store Asynchronous Desynchronization (Split-Brain):** PostgreSQL deletion succeeds, but MongoDB fails mid-operation. If rollback is not fully atomic across systems, data exists in Mongo with no matching Postgres identity (orphan records).
   - *Mitigation:* Backward saga compensation. Failure in secondary adapter triggers immediate snapshot restoration of previously committed stores (`INV-03`).

### Vector 4: Governance Layer Attacks
1. **TOCTOU Double Execution Race:** Spawning 10 concurrent HTTP/MCP worker threads calling `execute_action(token)` simultaneously on a single approved token.
   - *Mitigation:* Compare-And-Swap (CAS) row locking:
     ```sql
     UPDATE approvals 
     SET status = 'executing', execution_id = $1 
     WHERE token = $2 AND status = 'approved' 
     RETURNING *;
     ```
     Exactly one thread receives the row; all other threads receive 0 rows and abort immediately.
2. **Hash Chain Forking / Fork Bombing:** Emitting concurrent audit events to create branching chains.
   - *Mitigation:* Database-level unique constraint on `idx_audit_log_prev_hash` combined with retry backoff and jitter, ensuring strictly linear serialization.

---

## 5. DREAD Risk Assessment

| Vulnerability / Threat | Damage (1-10) | Reproducibility (1-10) | Exploitability (1-10) | Affected Users (1-10) | Discoverability (1-10) | DREAD Score | Risk Level |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Agent Self-Approval via MCP** | 10 | 10 | 10 | 10 | 10 | **10.0** | 🔴 CRITICAL |
| **Postgres Restore FK Order Race**| 8 | 7 | 6 | 8 | 7 | **7.2** | 🟠 HIGH (Fixed) |
| **Audit Contention Under Burst** | 5 | 8 | 7 | 5 | 8 | **6.6** | 🟡 MEDIUM (Fixed) |
| **Unbounded Identifier Wildcards** | 9 | 9 | 5 | 10 | 6 | **7.8** | 🟠 HIGH |
| **Snapshot Data Field Corruption** | 8 | 4 | 4 | 7 | 4 | **5.4** | 🟡 MEDIUM |

---

## 6. Defensive Imperatives & Required Controls

1. **Principle of Separation of Intent and Authority:** The agent must only be able to request an action (`request_execution`), never approve it (`approve_execution`).
2. **Deterministic Pre-Execution Snapshots:** Never mutate a single bit until the complete snapshot is written and verified in the recovery ledger.
3. **Lossless Snapshot Schema:** Snapshots must store complete JSON serialized entities, preserving column types, foreign keys, and sub-documents.
4. **Tamper-Evident Continuity:** Every state transition must publish a cryptographic receipt to the audit log.
