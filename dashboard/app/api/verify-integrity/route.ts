import { NextResponse } from "next/server";
import { pool } from "../../lib/store";
import { createHash } from "crypto";

interface VerifyResult {
  id: number;
  action: string;
  actor: string;
  timestamp: string;
  hashSnippet: string;
  prevHashSnippet: string;
  status: "pass" | "fail" | "untrusted";
  computedHash?: string;
}

export async function GET() {
  try {
    const countResult = await pool.query(`SELECT COUNT(*) as total FROM audit_log`);
    const total = parseInt(countResult.rows[0].total, 10);

    const { rows } = await pool.query(
      `SELECT id, timestamp, action, actor, subject_hash, details, prev_hash, hash
       FROM audit_log ORDER BY id ASC`
    );

    const results: VerifyResult[] = [];
    let chainBroken = false;

    for (const row of rows) {
      if (chainBroken) {
        results.push({
          id: row.id,
          action: row.action,
          actor: row.actor,
          timestamp: new Date(row.timestamp).toISOString(),
          hashSnippet: String(row.hash).slice(0, 8),
          prevHashSnippet: String(row.prev_hash).slice(0, 8),
          status: "untrusted",
        });
        continue;
      }

      // Reproduce the canonical string exactly as AuditLogger.canonicalize()
      // JSON.stringify({ action, actor, subjectHash, details, prevHash })
      const canonical = JSON.stringify({
        action: row.action,
        actor: row.actor,
        subjectHash: row.subject_hash,
        details: row.details,
        prevHash: row.prev_hash,
      });
      const computedHash = createHash("sha256").update(canonical).digest("hex");

      if (computedHash === row.hash) {
        results.push({
          id: row.id,
          action: row.action,
          actor: row.actor,
          timestamp: new Date(row.timestamp).toISOString(),
          hashSnippet: String(row.hash).slice(0, 8),
          prevHashSnippet: String(row.prev_hash).slice(0, 8),
          status: "pass",
        });
      } else {
        chainBroken = true;
        results.push({
          id: row.id,
          action: row.action,
          actor: row.actor,
          timestamp: new Date(row.timestamp).toISOString(),
          hashSnippet: String(row.hash).slice(0, 8),
          prevHashSnippet: String(row.prev_hash).slice(0, 8),
          status: "fail",
          computedHash: computedHash.slice(0, 8),
        });
      }
    }

    const passed = results.filter((r) => r.status === "pass").length;
    const failed = results.filter((r) => r.status !== "pass").length;

    return NextResponse.json({
      total,
      passed,
      failed,
      chainIntact: failed === 0,
      results,
    });
  } catch (err) {
    console.error("[verify-integrity] Failed:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
