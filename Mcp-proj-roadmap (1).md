# Project: "Warden" — A Governed Data-Rights Execution Agent
### (Formerly "GDPR Nuke." We killed that name. Judges fund trust, not violence.)

---

## 1. The one-liner (memorize this, say it first in the demo)

> "Warden is an MCP agent that finds, proves, and executes a user's data-deletion or data-access rights across every system in your company — but it never acts without showing you the blast radius first, and every action it takes can be undone and independently audited."

That sentence hits three judging criteria at once: **real-world applicability, security/governance, and technical depth.** Nothing about "AI" in the pitch — it's about trust infrastructure. That's deliberate.

---

## 2. Why this specific framing wins (not just "is a good idea")

| Pattern from the research | How Warden hits it |
|---|---|
| SIH/gov hackathons reward *compliance-shaped*, narrow, auditable problems (see: EMR standards, traceability, compliance checkers) | GDPR/DPDP-style "right to erasure" is a literal legal mandate — not invented pain |
| MCP hackathon winners in 2026 were governance/identity tools (MCP.STORE, K8s MCP governance scorer, Frugalia) — not new agent tricks | Warden's core IP *is* the approval-gate + audit trail, not the deletion logic |
| 35% of executives can't "pull the plug" on a rogue agent; 67% report a breach from unapproved AI tools | Warden's headline demo moment is showing you CAN pull the plug, mid-execution |
| 46% cite integration with existing systems as the #1 blocker, not model intelligence | You're explicitly building a multi-system MCP integration layer — the theme practically writes your architecture slide for you |

**The judges have seen 40 "agent that automates X" demos this year.** They have not seen many that open with "here's the kill switch" as the feature. That's your wedge.

---

## 3. What you are NOT building (say no to scope creep now)

- ❌ Real Stripe/production integration — use a seeded mock Postgres + mock Mongo + a fake "Stripe-like" REST stub. Judges do not care if it's real Stripe; they care that the *pattern* is real.
- ❌ A generic chatbot UI. This is an ops console, not a chat toy.
- ❌ Auto-approval "if confidence > 90%" logic. This is the trap the original idea fell into. Every irreversible action requires a human click. Full stop. This is your entire differentiator — don't undercut it for a "wow it's fully autonomous" moment. Judges in 2026 punish that, they don't reward it.
- ❌ Building your own auth/identity system. Fake it with a hardcoded admin role and say "production version integrates with Okta/Descope" — mention it, don't build it.

---

## 4. Architecture (buildable in 48 hours)

```
                    ┌─────────────────────────┐
                    │   Warden Control Plane    │
                    │  (NitroStack MCP Server)  │
                    └────────────┬─────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                         │
 ┌──────▼──────┐         ┌───────▼────────┐        ┌───────▼───────┐
 │  Scan Tool   │         │  Impact Report  │        │  Execute Tool  │
 │ (read-only)  │         │  Tool (compute  │        │ (gated, logged,│
 │              │         │  blast radius)  │        │  reversible)   │
 └──────┬──────┘         └───────┬────────┘        └───────┬───────┘
        │                        │                         │
   ┌────▼────┐             ┌─────▼─────┐              ┌────▼────┐
   │ Postgres │             │  MongoDB   │              │ Mock Pay │
   │ (users)  │             │ (sessions/ │              │ Ledger   │
   │          │             │  logs)     │              │ (Stripe- │
   └──────────┘             └────────────┘              │  like)   │
                                                          └──────────┘
                                 │
                        ┌────────▼─────────┐
                        │ Immutable Audit   │
                        │ Log (append-only  │
                        │ table + hash chain)│
                        └───────────────────┘
```

**Four MCP tools, exposed via NitroStack SDK decorators:**

1. `scan_subject(email)` — read-only. Searches all connected data stores for the identifier. Returns structured hits: table, row count, field sensitivity tags.
2. `generate_impact_report(scan_id)` — turns raw hits into a human-readable "blast radius" doc: what breaks downstream if this is deleted (e.g., "3 active subscriptions reference this user — deleting will orphan billing records").
3. `request_execution(scan_id, action)` — this is the gate. It does NOT delete anything. It creates a pending action with a unique approval token and posts it to the dashboard.
4. `execute_approved_action(approval_token)` — only callable after a human clicks "Approve" in the UI. Performs the actual delete/anonymize, and — critically — snapshots a reversible backup before executing. Writes a hash-chained entry to the audit log.
5. `rollback_action(execution_id)` — restores from the pre-execution snapshot. **This tool is your demo's mic-drop moment.**

**Audit log = your secret weapon.** Hash-chain it (`hash_n = SHA256(hash_n-1 + entry_n)`) so you can say in the demo: "this log is tamper-evident — if anyone edits row 47, every hash after it breaks." That's a 10-minute feature that sounds like a compliance product.

---

## 5. 48-Hour Build Plan

**Hours 0–4 (Day 1 morning): Scaffolding**
- Spin up NitroStack SDK project, deploy skeleton to NitroCloud immediately (get a live URL on day 1 — judges reward "it's actually deployed" per the checklist you already have)
- Seed Postgres + MongoDB with fake user data (~500 synthetic rows, a few "high profile" users with data scattered across 4-5 tables each)
- Stub the mock payment ledger

**Hours 4–10: Core read path**
- Build `scan_subject` — this is pure read/query fan-out. Get this rock solid first; it's your safest, most demoable feature if everything else breaks.
- Build the Impact Report generator — this is where you can use an LLM call meaningfully: summarize scattered technical hits into a plain-English risk narrative. This is your one "AI reasoning" moment — don't dilute it with more.

**Hours 10–18: The gate + dashboard**
- Build the approval-gate flow end-to-end: request → pending state → dashboard shows it → human clicks approve/deny
- Minimal dashboard (Next.js or even a single HTML page) showing: pending requests, blast radius, approve/deny buttons, live audit log feed
- This is your most judge-facing surface. Spend real design time here — a scrappy CLI kills your score on "usability."

**Hours 18–28: Execute + snapshot + rollback**
- Build the actual delete/anonymize execution
- Build pre-execution snapshotting (just copy affected rows to a `_snapshots` table with a timestamp)
- Build `rollback_action` — test this obsessively, it's your demo's climax

**Hours 28–34: Hash-chained audit log**
- Wire every action (scan, request, approve, execute, rollback) into the append-only hashed log
- Build a simple "verify log integrity" button that walks the chain and shows green/red

**Hours 34–42: Polish + failure-mode handling**
- Handle the "what if scan finds nothing" case gracefully
- Handle "what if two people approve the same request" (idempotency — shows technical maturity)
- Record your demo video NOW, before you're exhausted at hour 47

**Hours 42–48: Buffer + submission**
- This buffer is not optional. Something will break at hour 40. Budget for it.
- Push final commit, verify live NitroCloud deployment works from a cold link, submit

---

## 6. The 3-Minute Demo Script

1. **(20 sec)** One-liner from Section 1. Then: "Every AI agent hackathon project this year can take actions. The problem enterprises actually have — 35% can't pull the plug on a rogue agent — is that they can't trust, verify, or undo those actions. Warden fixes that, not the deletion part."
2. **(40 sec)** Live: type a request "Purge user jane.doe@email.com." Show the scan hitting 3 systems. Show the Impact Report: "Found in 3 tables, 2 active subscriptions will be orphaned."
3. **(40 sec)** Show the approval gate — click Approve as the "compliance officer" persona. Show execution happening, snapshot created, audit log entry appended live.
4. **(40 sec)** THE MOMENT: "But what if we made a mistake?" Click Rollback. Show the data restored. Show the audit log recording the rollback too, hash chain intact.
5. **(20 sec)** Close: "This is deployed live on NitroCloud right now — link in the README. Built as a real MCP server, not a wrapper, per the brief."

---

## 7. Scoring alignment cheat-sheet

| Typical judging criterion | Your answer |
|---|---|
| Real-world applicability | GDPR/DPDP right-to-erasure is a literal legal requirement, not invented |
| Technical depth | Multi-system MCP fan-out + hash-chained audit log + snapshot/rollback engine |
| Security/governance | The entire project IS the governance layer — this is your strongest card |
| Innovation | Nobody else will demo a rollback. That's rare and memorable |
| Presentation | Approval-gate UI + live rollback demo is inherently visual and tense — better than a static dashboard |

---

## 8. Two backup cuts if you're behind schedule

- **If dashboard is behind at hour 30:** cut it to a single page — pending list + one big Approve/Deny/Rollback button set. Function over polish.
- **If time is really tight:** cut MongoDB, keep only Postgres + the payment ledger stub. Two systems is still "multi-system," and a working two-system demo beats a broken three-system one every time.

---

## 9. The line to say if a judge pushes back on "why not full autonomy"

> "Full autonomy on irreversible actions is exactly what's causing the trust crisis in enterprise AI right now — that's not a limitation we're working around, it's the feature we designed around."

Say it exactly like that. It preempts the single most common judge objection and turns it into your strongest applause line.
