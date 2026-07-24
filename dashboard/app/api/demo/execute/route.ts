import { NextResponse } from "next/server";
import { pool, createAction } from "../../../lib/store";
import { getMongoDb } from "../../../lib/mongodb";
import { createHash, randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";

function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(",")}]`;
  const keys = Object.keys(obj).sort();
  const result = keys.map(k => `"${k}":${stableStringify(obj[k])}`).join(",");
  return `{${result}}`;
}

async function appendAuditLog(action: string, actor: string, subject: string, details: any) {
  const subjectHash = createHash("sha256").update(subject).digest("hex");
  const lastResult = await pool.query(`SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1`);
  const prevHash = lastResult.rows.length > 0 ? lastResult.rows[0].hash : "GENESIS";
  const canonical = stableStringify({ action, actor, subjectHash, details, prevHash });
  const hash = createHash("sha256").update(canonical).digest("hex");
  await pool.query(
    `WITH last_log AS (SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1)
     INSERT INTO audit_log (action, actor, subject_hash, details, prev_hash, hash)
     SELECT $1, $2, $3, $4, COALESCE((SELECT hash FROM last_log), 'GENESIS'), $5
     WHERE $6 = COALESCE((SELECT hash FROM last_log), 'GENESIS')
     RETURNING *`,
    [action, actor, subjectHash, details, hash, prevHash]
  );
}

async function logStep(executionId: string, stepName: string, system: string, status: string, details?: any) {
  await pool.query(
    `INSERT INTO execution_steps (execution_id, step_name, system, status, details) VALUES ($1, $2, $3, $4, $5)`,
    [executionId, stepName, system, status, details ? JSON.stringify(details) : null]
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { scanId, identifier, actionType } = body;
    if (!scanId || !identifier) return NextResponse.json({ error: "scanId and identifier required" }, { status: 400 });

    const mode = actionType || "delete";
    const executionId = randomUUID();

    // Create approval record and auto-approve
    const approval = await createAction(scanId, mode);
    await pool.query(
      `UPDATE approvals SET status = 'approved', resolved_at = NOW(), resolved_by = 'compliance-officer', impact_report = $1 WHERE token = $2`,
      [body.impactReport || null, approval.token]
    );

    await appendAuditLog("APPROVAL_REQUESTED", "dashboard-demo", identifier, { scanId, token: approval.token, action: mode });
    await appendAuditLog("APPROVED", "compliance-officer", identifier, { token: approval.token });
    await appendAuditLog("EXECUTION_STARTED", "execution-engine", identifier, { executionId, token: approval.token, action: mode });

    // Phase A: Snapshot all systems
    let snapshotCount = 0;

    // Snapshot Postgres
    await logStep(executionId, "SNAPSHOT", "postgres", "started");
    const users = await pool.query(`SELECT id FROM users WHERE email = $1`, [identifier]);
    if (users.rows.length > 0) {
      const userId = users.rows[0].id;
      const tables = ["users", "user_profiles", "subscriptions", "user_activity"];
      const queries: Record<string, string> = {
        users: `SELECT * FROM users WHERE id = $1`,
        user_profiles: `SELECT * FROM user_profiles WHERE user_id = $1`,
        subscriptions: `SELECT * FROM subscriptions WHERE user_id = $1`,
        user_activity: `SELECT * FROM user_activity WHERE user_id = $1`,
      };
      for (const table of tables) {
        const rows = await pool.query(queries[table], [userId]);
        for (const row of rows.rows) {
          await pool.query(
            `INSERT INTO snapshots (execution_id, source_system, record_id, data) VALUES ($1, $2, $3, $4)`,
            [executionId, "postgres", table, JSON.stringify(row)]
          );
          snapshotCount++;
        }
      }
    }
    await logStep(executionId, "SNAPSHOT", "postgres", "completed", { count: snapshotCount });

    // Snapshot MongoDB
    await logStep(executionId, "SNAPSHOT", "mongodb", "started");
    let mongoSnap = 0;
    const db = await getMongoDb();
    const filter = { $or: [{ email: identifier }, { userId: identifier }] };
    const sessions = await db.collection("sessions").find(filter).toArray();
    for (const s of sessions) {
      await pool.query(
        `INSERT INTO snapshots (execution_id, source_system, record_id, data) VALUES ($1, $2, $3, $4)`,
        [executionId, "mongodb:sessions", s._id.toString(), JSON.stringify(s)]
      );
      mongoSnap++;
    }
    const actLogs = await db.collection("activity_logs").find(filter).toArray();
    for (const l of actLogs) {
      await pool.query(
        `INSERT INTO snapshots (execution_id, source_system, record_id, data) VALUES ($1, $2, $3, $4)`,
        [executionId, "mongodb:activity_logs", l._id.toString(), JSON.stringify(l)]
      );
      mongoSnap++;
    }
    await logStep(executionId, "SNAPSHOT", "mongodb", "completed", { count: mongoSnap });

    // Snapshot Payment Ledger
    await logStep(executionId, "SNAPSHOT", "payment_ledger", "started");
    let paySnap = 0;
    const ledgerPath = path.resolve(process.cwd(), "..", "src", "db", "ledger.json");
    try {
      if (fs.existsSync(ledgerPath)) {
        const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf-8"));
        const matches = ledger.filter((r: any) => r.email === identifier || r.userId === identifier);
        for (const r of matches) {
          await pool.query(
            `INSERT INTO snapshots (execution_id, source_system, record_id, data) VALUES ($1, $2, $3, $4)`,
            [executionId, "payment_ledger", r.id, JSON.stringify(r)]
          );
          paySnap++;
        }
      }
    } catch {}
    await logStep(executionId, "SNAPSHOT", "payment_ledger", "completed", { count: paySnap });

    await appendAuditLog("SNAPSHOT_TAKEN", "execution-engine", identifier, { executionId, totalSnapshots: snapshotCount + mongoSnap + paySnap });

    // Phase B: Delete
    await logStep(executionId, "MUTATE", "postgres", "started");
    if (mode === "delete") {
      await pool.query(`DELETE FROM users WHERE email = $1`, [identifier]);
    } else {
      const ur = await pool.query(`UPDATE users SET email = 'anonymized-' || id || '@deleted.invalid', name = 'Anonymized User' WHERE email = $1 RETURNING id`, [identifier]);
      if (ur.rows.length > 0) {
        await pool.query(`UPDATE user_profiles SET phone = 'REDACTED', address = 'REDACTED', date_of_birth = NULL WHERE user_id = $1`, [ur.rows[0].id]);
      }
    }
    await logStep(executionId, "MUTATE", "postgres", "completed");

    await logStep(executionId, "MUTATE", "mongodb", "started");
    await db.collection("sessions").deleteMany(filter);
    await db.collection("activity_logs").deleteMany(filter);
    await logStep(executionId, "MUTATE", "mongodb", "completed");

    await logStep(executionId, "MUTATE", "payment_ledger", "started");
    try {
      if (fs.existsSync(ledgerPath)) {
        const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf-8"));
        const remaining = ledger.filter((r: any) => r.email !== identifier && r.userId !== identifier);
        fs.writeFileSync(ledgerPath, JSON.stringify(remaining, null, 2), "utf-8");
      }
    } catch {}
    await logStep(executionId, "MUTATE", "payment_ledger", "completed");

    await pool.query(`UPDATE approvals SET status = 'executed', execution_id = $1 WHERE token = $2`, [executionId, approval.token]);
    await appendAuditLog("EXECUTION_COMPLETED", "execution-engine", identifier, { executionId, token: approval.token });

    return NextResponse.json({
      executionId,
      token: approval.token,
      snapshotCount: snapshotCount + mongoSnap + paySnap,
      mode,
    });
  } catch (err: any) {
    console.error("[demo/execute] Failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
