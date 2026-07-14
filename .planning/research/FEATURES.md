# Features Research: Data-Rights Governance Agents

## Table Stakes (must-have or users/judges dismiss it)

### 1. Multi-System Data Discovery
- **What:** Scan across multiple data stores (Postgres, MongoDB, mock payment ledger) to find all records associated with an identifier (email, user ID)
- **Why table stakes:** This is the fundamental capability. Without it, you have nothing to govern
- **Complexity:** Medium — query fan-out pattern, result aggregation
- **Dependencies:** Database connectors, identifier normalization

### 2. Human-in-the-Loop Approval Gate
- **What:** No irreversible action executes without explicit human click in the dashboard
- **Why table stakes:** This is Warden's entire differentiator. 35% of executives can't pull the plug on rogue agents — this IS the fix
- **Complexity:** Medium — requires pending state management, approval tokens, dashboard UI
- **Dependencies:** Dashboard, state management

### 3. Immutable Audit Trail
- **What:** Every action logged with SHA-256 hash chaining — append-only, tamper-evident
- **Why table stakes:** Governance without proof is theater. The audit log IS the compliance artifact
- **Complexity:** Low-Medium — straightforward hash chain, integrity verification
- **Dependencies:** None (foundational)

### 4. Execute + Delete/Anonymize
- **What:** Actually perform the approved data deletion or anonymization
- **Why table stakes:** Without execution, this is just a data scanner
- **Complexity:** Medium — transaction management, multi-system coordination
- **Dependencies:** Approval gate, snapshot system

## Differentiators (competitive advantage — what makes judges remember you)

### 5. Pre-Execution Snapshots + Rollback
- **What:** Snapshot all affected rows before mutation, full restore on demand
- **Why differentiator:** "Nobody else will demo a rollback. That's rare and memorable."
- **Complexity:** Medium — copy-to-snapshot-table pattern, restore logic
- **Dependencies:** Execution system
- **Demo impact:** 🔴 Critical — this is the mic-drop moment

### 6. Impact Report / Blast Radius Analysis
- **What:** Human-readable document showing what breaks downstream if data is deleted
- **Why differentiator:** Transforms raw query hits into actionable risk narrative
- **Complexity:** Medium — template engine + optional LLM enrichment
- **Dependencies:** Scan results, schema awareness
- **Demo impact:** 🟡 High — shows the system "thinks" before acting

### 7. Audit Log Integrity Verification
- **What:** One-click button that walks the hash chain and shows green/red per entry
- **Why differentiator:** Visual proof of tamper-evidence — "if anyone edits row 47, every hash after it breaks"
- **Complexity:** Low — iterate and verify
- **Dependencies:** Audit log
- **Demo impact:** 🟡 High — 10-minute feature that sounds like a compliance product

## Anti-Features (things to deliberately NOT build)

| Anti-Feature | Why NOT |
|-------------|---------|
| Auto-approval logic | Undermines the entire governance story — judges in 2026 punish full autonomy on irreversible actions |
| Chatbot/conversational UI | This is an ops console, not a chat toy. Different UX paradigm |
| Real payment integration | Mock demonstrates the pattern. Real Stripe adds auth complexity without demo value |
| Production IAM | Hardcode admin role. Mention "production integrates with Okta" — don't build it |
| GDPR legal compliance engine | Demonstrate technical pattern, not legal certification |

## Feature Dependencies (build order implications)

```
Audit Log (foundation) → Scan → Impact Report → Approval Gate → Execute → Snapshot/Rollback
                                                                              ↓
                                                                    Integrity Verification
```

---
*Researched: 2026-07-14*
