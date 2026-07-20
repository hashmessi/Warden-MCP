import { NextResponse } from "next/server";
import { pool } from "../../lib/store";

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT id, timestamp, action, actor, subject_hash, details, prev_hash, hash
       FROM audit_log
       ORDER BY id DESC
       LIMIT 50`
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("[audit-log] Failed to fetch audit log:", err);
    return NextResponse.json({ error: "Failed to fetch audit log" }, { status: 500 });
  }
}
