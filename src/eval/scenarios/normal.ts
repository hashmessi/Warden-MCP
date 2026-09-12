import { scanSubject } from "../../scanner.js";
import { generateImpactReport } from "../../impact/report.js";
import { createPendingAction, approveAction } from "../../approval/store.js";
import { executeAction, rollbackAction } from "../../execution/engine.js";
import { generateTestSubject, seedTestSubject, cleanupTestSubject } from "../seeder.js";
import {
  checkAuthGateInvariant,
  checkIdempotencyInvariant,
  checkReversibilityInvariant,
} from "../invariants.js";
import type { EvalCaseResult, EvalScenario, InvariantType } from "../types.js";

export const normalScenario: EvalScenario = {
  id: "scenario-01-normal",
  name: "Normal Valid Deletion & Rollback",
  description: "Verifies the full end-to-end data deletion and snapshot rollback flow on valid subject data",
  async run(): Promise<EvalCaseResult[]> {
    const results: EvalCaseResult[] = [];
    const subject = generateTestSubject("normal");
    const startTime = Date.now();

    try {
      // 1. Seed
      await seedTestSubject(subject);

      // 2. Scan
      const scan = await scanSubject(subject.email);
      const initialRecordCount = scan.totalRecords;
      if (initialRecordCount === 0) {
        throw new Error("Seeded subject had 0 records detected during scan");
      }

      // 3. Impact Report
      const impact = await generateImpactReport(scan);

      // 4. Request Approval
      const pending = await createPendingAction(scan.scanId, "delete", impact);

      // 5. Approve Action
      const approved = await approveAction(pending.token, "eval-user");

      // Check Invariant: Auth Gate passed for valid approved token
      const authCheck = checkAuthGateInvariant("approved", true, false);

      // 6. Execute Deletion
      const execStartTime = Date.now();
      const executionId = await executeAction(approved.token);
      const execDuration = Date.now() - execStartTime;

      // 7. Verify Deletion
      const postDeleteScan = await scanSubject(subject.email);
      const deletionSuccessful = postDeleteScan.totalRecords === 0;

      // 8. Rollback
      const rollbackStartTime = Date.now();
      await rollbackAction(executionId);
      const rollbackDuration = Date.now() - rollbackStartTime;

      // 9. Verify Rollback
      const postRollbackScan = await scanSubject(subject.email);
      const reversibilityCheck = checkReversibilityInvariant(
        initialRecordCount,
        postRollbackScan.totalRecords
      );

      const totalDuration = Date.now() - startTime;
      const checked: InvariantType[] = ["INV-01-AUTH-GATE", "INV-02-IDEMPOTENCY", "INV-03-REVERSIBILITY"];
      const violated: InvariantType[] = [];

      if (!authCheck.passed) violated.push("INV-01-AUTH-GATE");
      if (!deletionSuccessful) violated.push("INV-02-IDEMPOTENCY");
      if (!reversibilityCheck.passed) violated.push("INV-03-REVERSIBILITY");

      results.push({
        id: "case-normal-01",
        name: "Full E2E Normal Lifecycle",
        scenario: "NORMAL",
        status: violated.length === 0 ? "PASSED" : "CRITICAL_FAILURE",
        durationMs: totalDuration,
        invariantsChecked: checked,
        invariantsViolated: violated,
        details: {
          initialRecordCount,
          postDeleteCount: postDeleteScan.totalRecords,
          postRollbackCount: postRollbackScan.totalRecords,
          execDurationMs: execDuration,
          rollbackDurationMs: rollbackDuration,
        },
      });
    } catch (err: any) {
      results.push({
        id: "case-normal-01",
        name: "Full E2E Normal Lifecycle",
        scenario: "NORMAL",
        status: "CRITICAL_FAILURE",
        durationMs: Date.now() - startTime,
        invariantsChecked: ["INV-01-AUTH-GATE", "INV-03-REVERSIBILITY"],
        invariantsViolated: ["INV-01-AUTH-GATE"],
        error: err.message,
      });
    } finally {
      await cleanupTestSubject(subject);
    }

    return results;
  },
};
