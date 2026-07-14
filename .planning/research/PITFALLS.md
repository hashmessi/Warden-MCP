# Pitfalls Research: Data-Rights Governance Agents

## Critical Pitfalls

### 1. Building the Agent Before the Governance
- **Warning signs:** Starting with "cool AI agent that deletes stuff" instead of the audit trail + approval gate
- **Prevention:** Build the audit logger and approval gate FIRST. Everything else flows through them. If your governance layer is an afterthought, judges will smell it
- **Phase mapping:** Phase 1-2 (foundation + audit + scan before any mutation logic)

### 2. Console.log in MCP Server Corrupts JSON-RPC
- **Warning signs:** MCP client can't connect, mysterious parse errors, tools not discovered
- **Prevention:** NEVER use `console.log` in an MCP server. All debug output goes to `stderr`. The MCP protocol uses stdout for JSON-RPC — any stray log line breaks the stream
- **Phase mapping:** Phase 1 (MCP server setup)

### 3. The Rollback That Doesn't Actually Work
- **Warning signs:** Rollback "works" in happy path but fails with foreign key violations, partial restores, or stale snapshot data
- **Prevention:** Test rollback OBSESSIVELY. Snapshot must capture ALL affected rows across ALL tables (including junction/reference tables). Restore must be transactional — all or nothing
- **Phase mapping:** Phase 5 (execute + rollback)

### 4. Hash Chain Breaks on Data Serialization
- **Warning signs:** Hash verification fails randomly — same data produces different hashes
- **Prevention:** Canonicalize JSON before hashing (sorted keys, consistent encoding). Use `JSON.stringify(data, Object.keys(data).sort())` or a canonical JSON library. Never hash raw objects
- **Phase mapping:** Phase 2 (audit log)

### 5. Multi-Database Scan Returns Inconsistent Results
- **Warning signs:** Same email found in Postgres but missed in MongoDB because of different field names or case sensitivity
- **Prevention:** Normalize identifiers before query. Define a clear `IdentifierType` (email, user_id) and map it to the correct field per adapter. Case-insensitive matching everywhere
- **Phase mapping:** Phase 3 (scan tool)

### 6. Demo Fails Because Databases Aren't Seeded
- **Warning signs:** "Let me just set up the data real quick..." during a live demo
- **Prevention:** Seed script MUST be idempotent and run in < 5 seconds. Include "interesting" data — a user with data scattered across 4-5 tables, orphan-able billing records, sessions in MongoDB. Make the seed data tell a story
- **Phase mapping:** Phase 1 (scaffolding)

### 7. Dashboard is a CLI Pretending to be a UI
- **Warning signs:** Black terminal-like UI, no visual hierarchy, "approve" is a text input instead of a button
- **Prevention:** Ops console ≠ ugly. Look at Vercel/Railway dashboards for inspiration. Clear status colors, action buttons with confirmation, live-updating audit feed. Spend real design time here
- **Phase mapping:** Phase 4 (dashboard)

### 8. Approval Gate Has Race Conditions
- **Warning signs:** Two people approve the same request, or an approved request can be re-approved
- **Prevention:** Use optimistic locking or status-based guards. `UPDATE ... WHERE status = 'pending'` returns affected rows — if 0, someone already acted. Approval tokens should be single-use
- **Phase mapping:** Phase 4-5 (approval + execution)

### 9. Audit Log Stores PII That Must Be Deletable
- **Warning signs:** "Delete this user" but their email is all over the audit log — can't delete audit entries without breaking the hash chain
- **Prevention:** Store hashed identifiers or UUIDs in audit entries, not raw PII. The audit log references a user by ID; the user table has the PII. When user is deleted, audit trail remains intact with anonymized references
- **Phase mapping:** Phase 2 (audit log design)

### 10. Scope Creep into "Real" Compliance
- **Warning signs:** Building actual GDPR Article 17 compliance checks, retention policies, legal hold logic
- **Prevention:** This is a TECHNICAL DEMO of the pattern, not a legal compliance product. Say "this demonstrates the technical execution pattern" — don't claim legal compliance. Judges value honesty about scope
- **Phase mapping:** All phases (mindset)

---
*Researched: 2026-07-14*
