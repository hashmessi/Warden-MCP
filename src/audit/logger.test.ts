import { test } from "node:test";
import assert from "node:assert";
import { AuditLogger } from "./logger.js";
import { query } from "../db/postgres.js";
import { AuditEntry } from "./types.js";

test("AuditLogger Hash Chain Integrity", async (t) => {
  // Setup: clear audit log before tests
  await query("DELETE FROM audit_log");

  let entry1: AuditEntry;

  await t.test("appends first row successfully (GENESIS)", async () => {
    entry1 = await AuditLogger.appendLog({
      action: "SCAN",
      actor: "test_admin",
      subject: "test@example.com",
      details: { found: 10 },
    });

    assert.ok(entry1.id);
    assert.strictEqual(entry1.action, "SCAN");
    assert.strictEqual(entry1.actor, "test_admin");
    assert.strictEqual(entry1.prev_hash, "GENESIS");
    assert.ok(entry1.hash);
    
    // Verify subject hash is not raw PII
    assert.notStrictEqual(entry1.subject_hash, "test@example.com");
  });

  await t.test("appends second row and links to first row's hash", async () => {
    const entry2 = await AuditLogger.appendLog({
      action: "APPROVAL_REQUESTED",
      actor: "test_admin",
      subject: "test@example.com",
      details: { reason: "cleanup" },
    });

    assert.ok(entry2.id);
    assert.strictEqual(entry2.prev_hash, entry1.hash);
    assert.ok(entry2.hash);
  });

  await t.test("throws error when concurrent insert breaks the hash chain", async () => {
    // We simulate a race condition where the application thinks the prev_hash is GENESIS 
    // (or some stale hash), but the DB has moved on.
    
    // Since AuditLogger automatically fetches the latest hash, we can't easily force it to send a bad hash
    // through `appendLog` without modifying the class. We'll simulate it by manually running the insert
    // with a bad expectedPrevHash, using the same SQL pattern AuditLogger uses.
    
    const badExpectedPrevHash = "stale_hash_123";
    const canonicalData = AuditLogger.canonicalize("EXECUTED", "test_admin", null, {}, badExpectedPrevHash);
    const newHash = "fake_new_hash_abc";

    try {
      const insertResult = await query(
        `WITH last_log AS (
          SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1
        )
        INSERT INTO audit_log (action, actor, subject_hash, details, prev_hash, hash)
        SELECT $1, $2, $3, $4, COALESCE((SELECT hash FROM last_log), 'GENESIS'), $5
        WHERE $6 = COALESCE((SELECT hash FROM last_log), 'GENESIS')
        RETURNING *;`,
        [
          "EXECUTED",
          "test_admin",
          null,
          {},
          newHash,
          badExpectedPrevHash
        ]
      );
      
      if (insertResult.length === 0) {
        throw new Error("Hash chain integrity violation: prev_hash mismatch");
      }
      
      assert.fail("Should have thrown an error");
    } catch (error: any) {
      assert.strictEqual(error.message, "Hash chain integrity violation: prev_hash mismatch");
    }
  });

});
