import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config();

async function tamperAuditLog() {
  const pool = new Pool({
    connectionString:
      process.env.POSTGRES_URL ??
      process.env.DATABASE_URL ??
      "postgresql://warden:warden_dev@localhost:5432/warden_db",
  });

  try {
    // Get total count
    const countResult = await pool.query(`SELECT COUNT(*) as total FROM audit_log`);
    const total = parseInt(countResult.rows[0].total, 10);

    if (total === 0) {
      console.error("No audit log entries found. Run some MCP operations first.");
      process.exit(1);
    }

    // Target the entry at ~50% of the chain (not first, not last — most dramatic break)
    const targetOffset = Math.max(0, Math.floor(total / 2) - 1);
    const entryResult = await pool.query(
      `SELECT id, hash, action, actor FROM audit_log ORDER BY id ASC LIMIT 1 OFFSET $1`,
      [targetOffset]
    );

    if (entryResult.rows.length === 0) {
      console.error("Could not find target entry.");
      process.exit(1);
    }

    const entry = entryResult.rows[0];
    const originalHash: string = entry.hash;
    // Replace first 8 chars with "TAMPERED" prefix
    const tamperedHash = "TAMPERED" + originalHash.slice(8);

    await pool.query(`UPDATE audit_log SET hash = $1 WHERE id = $2`, [tamperedHash, entry.id]);

    console.log("\n" + "═".repeat(60));
    console.log("  🔴  AUDIT LOG TAMPERED — DEMO MODE");
    console.log("═".repeat(60));
    console.log(`\n  Entry ID:      #${entry.id}`);
    console.log(`  Action:        ${entry.action}`);
    console.log(`  Actor:         ${entry.actor}`);
    console.log(`  Original hash: ${originalHash.slice(0, 16)}...`);
    console.log(`  Tampered hash: ${tamperedHash.slice(0, 16)}...`);
    console.log(`\n  Entries #${entry.id} through #${total} will now fail verification.`);
    console.log("\n  ➜  Go to the dashboard and click 'Verify Integrity'\n");
  } finally {
    await pool.end();
  }
}

tamperAuditLog().catch((err) => {
  console.error("Tamper script failed:", err);
  process.exit(1);
});
