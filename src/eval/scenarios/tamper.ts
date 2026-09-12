import { AuditLogger } from "../../audit/logger.js";
import { query } from "../../db/postgres.js";
import { checkTamperDetectionInvariant } from "../invariants.js";
import type { EvalCaseResult, EvalScenario } from "../types.js";

export const tamperScenario: EvalScenario = {
  id: "scenario-09-tamper",
  name: "Audit Hash Chain Tamper Detection",
  description: "Modifies an audit log entry in Postgres directly and asserts that cryptographic hash chain verification detects the corruption",
  async run(): Promise<EvalCaseResult[]> {
    const start = Date.now();
    let testEntryId: number | null = null;
    let originalHash = "";

    try {
      // 1. Append a dedicated test entry to the audit log
      const testEntry = await AuditLogger.appendLog({
        action: "SCAN",
        actor: "eval-tamper-harness",
        subject: "eval-tamper@warden.test",
        details: { scenario: "tamper_detection_test", nonce: Date.now() },
      });

      testEntryId = testEntry.id;
      originalHash = testEntry.hash;

      // 2. Corrupt the entry directly via SQL (simulating malicious DB admin or out-of-band edit)
      const corruptedHash = "TAMPERED" + originalHash.slice(8);
      await query(`UPDATE audit_log SET hash = $1 WHERE id = $2`, [corruptedHash, testEntryId]);

      // 3. Verify integrity
      const verifyResult = await AuditLogger.verifyIntegrity();

      // Check Invariant 4: Tamper MUST be detected
      const tamperCheck = checkTamperDetectionInvariant(true, verifyResult.valid);

      const passed = !verifyResult.valid && verifyResult.brokenAt === testEntryId;

      return [
        {
          id: "case-tamper-01",
          name: "Direct Audit Log Mutation Detection",
          scenario: "TAMPER",
          status: passed ? "PASSED" : "CRITICAL_FAILURE",
          durationMs: Date.now() - start,
          invariantsChecked: ["INV-04-TAMPER-EVIDENCE"],
          invariantsViolated: passed ? [] : ["INV-04-TAMPER-EVIDENCE"],
          details: {
            tamperedRowId: testEntryId,
            detectedBrokenAt: verifyResult.brokenAt,
            tamperDetected: !verifyResult.valid,
            details: verifyResult.details,
          },
        },
      ];
    } catch (err: any) {
      return [
        {
          id: "case-tamper-01",
          name: "Direct Audit Log Mutation Detection",
          scenario: "TAMPER",
          status: "CRITICAL_FAILURE",
          durationMs: Date.now() - start,
          invariantsChecked: ["INV-04-TAMPER-EVIDENCE"],
          invariantsViolated: ["INV-04-TAMPER-EVIDENCE"],
          error: err.message,
        },
      ];
    } finally {
      // Clean up the corrupted test entry so future tests have a valid chain
      if (testEntryId !== null) {
        try {
          await query(`DELETE FROM audit_log WHERE id = $1`, [testEntryId]);
        } catch (cleanupErr) {
          console.error(`[eval:tamper] Failed to clean up test row ${testEntryId}:`, cleanupErr);
        }
      }
    }
  },
};
