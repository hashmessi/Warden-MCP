# Requirements: Warden

**Defined:** 2026-07-14
**Core Value:** Every irreversible action requires a human decision, and every action is independently auditable with cryptographic proof

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Data Discovery

- [ ] **DISC-01**: System can scan Postgres database for all records matching a user identifier (email or user ID)
- [ ] **DISC-02**: System can scan MongoDB database for all records matching a user identifier
- [ ] **DISC-03**: System can scan mock payment ledger for all records matching a user identifier
- [ ] **DISC-04**: Scan results include table/collection name, row count, and field sensitivity tags per data source
- [ ] **DISC-05**: Scan results are aggregated into a single structured response across all connected systems

### Impact Analysis

- [ ] **IMPT-01**: System can generate a human-readable blast-radius report from scan results
- [ ] **IMPT-02**: Report identifies downstream dependencies that would break if data is deleted (e.g., "3 active subscriptions will be orphaned")
- [ ] **IMPT-03**: Report uses deterministic template structure for reliable, consistent output
- [ ] **IMPT-04**: Report supports optional LLM enrichment for plain-English narrative enhancement

### Approval Gate

- [ ] **APPR-01**: System creates a pending action with a unique approval token when execution is requested
- [ ] **APPR-02**: Pending actions are visible in the ops dashboard with full blast-radius context
- [ ] **APPR-03**: Human can approve or deny a pending action via the dashboard
- [ ] **APPR-04**: Approved actions cannot be re-approved (idempotent — single-use tokens)
- [ ] **APPR-05**: Denied actions are logged and cannot be re-submitted without a new scan

### Execution

- [ ] **EXEC-01**: System creates a pre-execution snapshot of all affected rows before any mutation
- [ ] **EXEC-02**: System can delete user data across all connected systems after approval
- [ ] **EXEC-03**: System can anonymize user data as an alternative to deletion
- [ ] **EXEC-04**: Execution is transactional — all systems succeed or all roll back
- [ ] **EXEC-05**: System can restore data from a pre-execution snapshot (rollback)
- [ ] **EXEC-06**: Rollback restores data across all affected systems from the snapshot

### Audit Trail

- [ ] **AUDT-01**: Every action (scan, request, approve, deny, execute, rollback) is logged as an append-only entry
- [ ] **AUDT-02**: Each audit entry includes a SHA-256 hash linking to the previous entry (hash chain)
- [ ] **AUDT-03**: Audit log stores hashed/anonymized identifiers, not raw PII
- [ ] **AUDT-04**: System can verify audit log integrity by walking the hash chain
- [ ] **AUDT-05**: Integrity verification reports pass/fail per entry with visual green/red indicator

### MCP Server

- [ ] **MCP-01**: `scan_subject` tool is exposed as a valid MCP endpoint with zod-validated input schema
- [ ] **MCP-02**: `generate_impact_report` tool is exposed as a valid MCP endpoint
- [ ] **MCP-03**: `request_execution` tool is exposed as a valid MCP endpoint
- [ ] **MCP-04**: `execute_approved_action` tool is exposed as a valid MCP endpoint
- [ ] **MCP-05**: `rollback_action` tool is exposed as a valid MCP endpoint
- [ ] **MCP-06**: Server uses stdio transport and never writes to stdout except JSON-RPC messages

### Dashboard

- [ ] **DASH-01**: Dashboard displays list of pending approval requests with status indicators
- [ ] **DASH-02**: Dashboard shows blast-radius report for each pending request
- [ ] **DASH-03**: Dashboard provides Approve/Deny action buttons with confirmation dialogs
- [ ] **DASH-04**: Dashboard shows Rollback button for completed executions
- [ ] **DASH-05**: Dashboard displays live audit log feed with hash chain entries
- [ ] **DASH-06**: Dashboard provides one-click "Verify Integrity" button for audit log
- [ ] **DASH-07**: Dashboard has professional ops-console design (not a CLI pretending to be a UI)

### Infrastructure

- [x] **INFR-01**: Postgres database is seeded with synthetic user data (~500 rows across 4-5 tables)
- [x] **INFR-02**: MongoDB is seeded with synthetic session/log data
- [x] **INFR-03**: Mock payment ledger is seeded with synthetic billing/subscription data
- [x] **INFR-04**: Seed script is idempotent and runs in under 5 seconds
- [x] **INFR-05**: Project includes Docker Compose for local development with all databases

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Multi-Tenancy

- **MTNT-01**: System supports multiple organizations with isolated data
- **MTNT-02**: Each organization has its own admin users and approval policies

### Advanced Compliance

- **CMPL-01**: System supports configurable retention policies per data type
- **CMPL-02**: System supports legal hold flags that prevent deletion of specific records
- **CMPL-03**: System generates compliance reports for regulators

### Integration

- **INTG-01**: System integrates with enterprise IdP (Okta, Descope) for authentication
- **INTG-02**: System supports webhook notifications for approval events
- **INTG-03**: System supports additional data adapters (MySQL, Redis, S3)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real Stripe/payment integration | Mock demonstrates the pattern without API auth complexity |
| Production auth/IAM | Hardcoded admin role — mention production IdP integration path |
| Chatbot/conversational UI | Ops console, not a chat toy — different UX paradigm |
| Auto-approval logic | Undermines entire governance differentiator |
| GDPR/DPDP legal compliance | Technical demo of pattern, not legal certification |
| Mobile app | Ops console doesn't need native mobile |
| Real-time WebSockets | React Query polling sufficient for dashboard refresh |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFR-01 | Phase 1 | Complete |
| INFR-02 | Phase 1 | Complete |
| INFR-03 | Phase 1 | Complete |
| INFR-04 | Phase 1 | Complete |
| INFR-05 | Phase 1 | Complete |
| AUDT-01 | Phase 2 | Complete |
| AUDT-02 | Phase 2 | Complete |
| AUDT-03 | Phase 2 | Complete |
| MCP-01 | Phase 3 | Complete |
| MCP-06 | Phase 3 | Complete |
| DISC-01 | Phase 3 | Complete |
| DISC-02 | Phase 3 | Complete |
| DISC-03 | Phase 3 | Complete |
| DISC-04 | Phase 3 | Complete |
| DISC-05 | Phase 3 | Complete |
| IMPT-01 | Phase 4 | Complete |
| IMPT-02 | Phase 4 | Complete |
| IMPT-03 | Phase 4 | Complete |
| IMPT-04 | Phase 4 | Complete |
| MCP-02 | Phase 4 | Complete |
| APPR-01 | Phase 5 | Pending |
| APPR-02 | Phase 5 | Pending |
| APPR-03 | Phase 5 | Pending |
| APPR-04 | Phase 5 | Pending |
| APPR-05 | Phase 5 | Pending |
| MCP-03 | Phase 5 | Pending |
| DASH-01 | Phase 5 | Pending |
| DASH-02 | Phase 5 | Pending |
| DASH-03 | Phase 5 | Pending |
| DASH-07 | Phase 5 | Pending |
| EXEC-01 | Phase 6 | Pending |
| EXEC-02 | Phase 6 | Pending |
| EXEC-03 | Phase 6 | Pending |
| EXEC-04 | Phase 6 | Pending |
| EXEC-05 | Phase 6 | Pending |
| EXEC-06 | Phase 6 | Pending |
| MCP-04 | Phase 6 | Pending |
| MCP-05 | Phase 6 | Pending |
| DASH-04 | Phase 6 | Pending |
| AUDT-04 | Phase 7 | Pending |
| AUDT-05 | Phase 7 | Pending |
| DASH-05 | Phase 7 | Pending |
| DASH-06 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 42 total
- Mapped to phases: 42
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-14*
*Last updated: 2026-07-14 after initial definition*
