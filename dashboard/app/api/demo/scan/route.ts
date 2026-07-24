import { NextResponse } from "next/server";
import { pool } from "../../../lib/store";
import { getMongoDb } from "../../../lib/mongodb";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { createHash } from "crypto";

// --- Shared audit helper ---
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

// --- POST /api/demo/scan ---
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const identifier: string = body.identifier;
    if (!identifier) {
      return NextResponse.json({ error: "identifier required" }, { status: 400 });
    }

    const scanId = randomUUID();
    const hits: any[] = [];

    // 1. Postgres scan
    const users = await pool.query(
      `SELECT id, email, name FROM users WHERE email = $1 AND is_deleted = FALSE`, [identifier]
    );
    if (users.rows.length > 0) {
      hits.push({
        sourceSystem: "postgres", table: "users", rowCount: users.rows.length,
        fields: [{ fieldName: "email", sensitivityTag: "pii" }, { fieldName: "name", sensitivityTag: "pii" }],
        sampleIds: users.rows.map((u: any) => u.id),
      });
    }

    const profiles = await pool.query(
      `SELECT up.id FROM user_profiles up INNER JOIN users u ON u.id = up.user_id WHERE u.email = $1`, [identifier]
    );
    if (profiles.rows.length > 0) {
      hits.push({
        sourceSystem: "postgres", table: "user_profiles", rowCount: profiles.rows.length,
        fields: [{ fieldName: "date_of_birth", sensitivityTag: "pii" }, { fieldName: "phone", sensitivityTag: "pii" }, { fieldName: "address", sensitivityTag: "pii" }],
        sampleIds: profiles.rows.map((p: any) => p.id),
      });
    }

    const subs = await pool.query(
      `SELECT s.id, s.status, s.plan FROM subscriptions s INNER JOIN users u ON u.id = s.user_id WHERE u.email = $1 AND s.status = 'active'`, [identifier]
    );
    if (subs.rows.length > 0) {
      hits.push({
        sourceSystem: "postgres", table: "subscriptions", rowCount: subs.rows.length,
        fields: [{ fieldName: "plan", sensitivityTag: "financial" }, { fieldName: "status", sensitivityTag: "system" }],
        sampleIds: subs.rows.map((s: any) => s.id),
        hasOrphanRisk: true,
        orphanDetails: `${subs.rows.length} active subscription(s) will be orphaned`,
      });
    }

    const activity = await pool.query(
      `SELECT ua.id FROM user_activity ua INNER JOIN users u ON u.id = ua.user_id WHERE u.email = $1`, [identifier]
    );
    if (activity.rows.length > 0) {
      hits.push({
        sourceSystem: "postgres", table: "user_activity", rowCount: activity.rows.length,
        fields: [{ fieldName: "action", sensitivityTag: "behavioral" }, { fieldName: "metadata", sensitivityTag: "behavioral" }],
        sampleIds: activity.rows.map((a: any) => a.id),
      });
    }

    // 2. MongoDB scan
    const db = await getMongoDb();
    const sessions = await db.collection("sessions")
      .find({ $or: [{ email: identifier }, { userId: identifier }] })
      .project({ _id: 1 }).toArray();
    if (sessions.length > 0) {
      hits.push({
        sourceSystem: "mongodb", table: "sessions", rowCount: sessions.length,
        fields: [{ fieldName: "email", sensitivityTag: "pii" }, { fieldName: "sessionToken", sensitivityTag: "system" }, { fieldName: "ipAddress", sensitivityTag: "behavioral" }],
        sampleIds: sessions.map((s) => s._id.toString()),
      });
    }

    const activityLogs = await db.collection("activity_logs")
      .find({ $or: [{ email: identifier }, { userId: identifier }] })
      .project({ _id: 1 }).toArray();
    if (activityLogs.length > 0) {
      hits.push({
        sourceSystem: "mongodb", table: "activity_logs", rowCount: activityLogs.length,
        fields: [{ fieldName: "event", sensitivityTag: "behavioral" }, { fieldName: "payload", sensitivityTag: "behavioral" }],
        sampleIds: activityLogs.map((l) => l._id.toString()),
      });
    }

    // 3. Payment ledger scan
    const ledgerPath = path.resolve(process.cwd(), "..", "src", "db", "ledger.json");
    let ledgerHits: any[] = [];
    try {
      if (fs.existsSync(ledgerPath)) {
        const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf-8"));
        const matches = ledger.filter((r: any) => r.email === identifier || r.userId === identifier);
        if (matches.length > 0) {
          const hasActive = matches.some((r: any) => r.status === "paid" && r.subscriptionId);
          hits.push({
            sourceSystem: "payment_ledger", table: "payment_records", rowCount: matches.length,
            fields: [{ fieldName: "email", sensitivityTag: "pii" }, { fieldName: "amount", sensitivityTag: "financial" }, { fieldName: "status", sensitivityTag: "financial" }],
            sampleIds: matches.map((r: any) => r.id),
            hasOrphanRisk: hasActive,
            orphanDetails: hasActive ? `${matches.filter((r: any) => r.subscriptionId).length} payment record(s) linked to active subscriptions` : undefined,
          });
        }
      }
    } catch {}

    const totalRecords = hits.reduce((s: number, h: any) => s + h.rowCount, 0);
    const systemsScanned = [...new Set(hits.map((h: any) => h.sourceSystem))];

    // Impact report
    const reportId = randomUUID();
    const riskyHits = hits.filter((h: any) => h.hasOrphanRisk);
    const hasFinancial = hits.some((h: any) => h.fields?.some((f: any) => f.sensitivityTag === "financial"));
    let riskLevel = "LOW";
    if (riskyHits.length > 0) riskLevel = "CRITICAL";
    else if (totalRecords > 50 || hasFinancial) riskLevel = "HIGH";
    else if (systemsScanned.length >= 2) riskLevel = "MEDIUM";

    const impactReport = {
      reportId, scanId, subject: identifier,
      sections: {
        dataFound: { systems: systemsScanned, tables: hits.map((h: any) => ({ system: h.sourceSystem, table: h.table, rowCount: h.rowCount, sensitivityTags: [...new Set(h.fields?.map((f: any) => f.sensitivityTag) || [])] })), totalRecords },
        dependencies: { hasRisks: riskyHits.length > 0, items: riskyHits.map((h: any) => ({ system: h.sourceSystem, table: h.table, rowCount: h.rowCount, description: h.orphanDetails || `Records in ${h.table} reference this subject` })) },
        riskLevel,
        recommendedAction: riskLevel === "CRITICAL" ? "Review downstream dependencies. Active subscriptions may be orphaned." : riskLevel === "HIGH" ? "Proceed with caution. Financial data detected." : "Safe to proceed.",
      },
    };

    // Audit log
    await appendAuditLog("SCAN", "dashboard-demo", identifier, { scanId, totalRecords, systemsScanned });

    return NextResponse.json({ scanId, identifier, totalRecords, systemsScanned, hits, impactReport });
  } catch (err: any) {
    console.error("[demo/scan] Failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
