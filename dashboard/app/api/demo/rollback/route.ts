import { NextResponse } from "next/server";
import { pool } from "../../../lib/store";
import { getMongoDb } from "../../../lib/mongodb";
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { ObjectId } from "mongodb";

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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { executionId, identifier, token } = body;
    if (!executionId || !identifier) return NextResponse.json({ error: "executionId and identifier required" }, { status: 400 });

    await appendAuditLog("ROLLBACK_STARTED", "execution-engine", identifier, { executionId });

    let restoredCount = 0;

    // Restore Postgres
    const pgSnaps = await pool.query(
      `SELECT record_id, data FROM snapshots WHERE execution_id = $1 AND source_system = 'postgres'`,
      [executionId]
    );
    for (const snap of pgSnaps.rows) {
      const table = snap.record_id;
      const row = snap.data;
      const columns = Object.keys(row).join(", ");
      const values = Object.values(row);
      const placeholders = values.map((_: any, i: number) => `$${i + 1}`).join(", ");
      try {
        await pool.query(`INSERT INTO ${table} (${columns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, values);
        restoredCount++;
      } catch (err) {
        console.error(`[rollback] Failed to restore ${table}:`, err);
      }
    }

    // Restore MongoDB
    const db = await getMongoDb();
    const mongoSnaps = await pool.query(
      `SELECT source_system, record_id, data FROM snapshots WHERE execution_id = $1 AND source_system LIKE 'mongodb:%'`,
      [executionId]
    );
    for (const snap of mongoSnaps.rows) {
      const collName = snap.source_system.replace("mongodb:", "");
      const data = snap.data;
      // Restore ObjectId
      if (data._id && typeof data._id === "string") {
        try { data._id = new ObjectId(data._id); } catch {}
      }
      try {
        await db.collection(collName).insertOne(data);
        restoredCount++;
      } catch (err) {
        console.error(`[rollback] Failed to restore mongodb ${collName}:`, err);
      }
    }

    // Restore Payment Ledger
    const ledgerPath = path.resolve(process.cwd(), "..", "src", "db", "ledger.json");
    const paySnaps = await pool.query(
      `SELECT data FROM snapshots WHERE execution_id = $1 AND source_system = 'payment_ledger'`,
      [executionId]
    );
    if (paySnaps.rows.length > 0) {
      try {
        const ledger: any[] = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, "utf-8")) : [];
        for (const snap of paySnaps.rows) {
          const existing = ledger.find((r: any) => r.id === snap.data.id);
          if (!existing) {
            ledger.push(snap.data);
            restoredCount++;
          }
        }
        fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), "utf-8");
      } catch {}
    }

    // Update approval status
    if (token) {
      await pool.query(`UPDATE approvals SET status = 'rolled_back' WHERE token = $1`, [token]);
    }

    // Clean up snapshots
    await pool.query(`DELETE FROM snapshots WHERE execution_id = $1`, [executionId]);

    await appendAuditLog("ROLLBACK_COMPLETED", "execution-engine", identifier, { executionId, restoredCount });

    return NextResponse.json({ restoredCount, executionId });
  } catch (err: any) {
    console.error("[demo/rollback] Failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
