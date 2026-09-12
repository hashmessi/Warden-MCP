import { scanSubject } from "../../scanner.js";
import { createPendingAction, getApprovalByToken } from "../../approval/store.js";
import { generateTestSubject, seedTestSubject, cleanupTestSubject } from "../seeder.js";
import type { EvalCaseResult, EvalScenario } from "../types.js";

export const duplicateScenario: EvalScenario = {
  id: "scenario-03-duplicate",
  name: "Duplicate Request Idempotency",
  description: "Verifies submitting multiple approval requests for the same scan produces traceable, valid tokens without deadlocks",
  async run(): Promise<EvalCaseResult[]> {
    const start = Date.now();
    const subject = generateTestSubject("duplicate");

    try {
      await seedTestSubject(subject);
      const scan = await scanSubject(subject.email);

      // Create first pending action
      const firstAction = await createPendingAction(scan.scanId, "delete");
      // Create duplicate pending action for identical scan
      const secondAction = await createPendingAction(scan.scanId, "delete");

      // Verify both tokens exist and have valid initial state
      const token1 = await getApprovalByToken(firstAction.token);
      const token2 = await getApprovalByToken(secondAction.token);

      const tokensDistinct = firstAction.token !== secondAction.token;
      const bothPending = token1?.status === "pending" && token2?.status === "pending";

      const passed = tokensDistinct && bothPending;

      return [
        {
          id: "case-duplicate-01",
          name: "Duplicate Execution Request Handling",
          scenario: "DUPLICATE",
          status: passed ? "PASSED" : "FAILED",
          durationMs: Date.now() - start,
          invariantsChecked: ["INV-02-IDEMPOTENCY"],
          invariantsViolated: passed ? [] : ["INV-02-IDEMPOTENCY"],
          details: {
            scanId: scan.scanId,
            token1: firstAction.token,
            token2: secondAction.token,
            bothPending,
          },
        },
      ];
    } catch (err: any) {
      return [
        {
          id: "case-duplicate-01",
          name: "Duplicate Execution Request Handling",
          scenario: "DUPLICATE",
          status: "FAILED",
          durationMs: Date.now() - start,
          invariantsChecked: ["INV-02-IDEMPOTENCY"],
          invariantsViolated: ["INV-02-IDEMPOTENCY"],
          error: err.message,
        },
      ];
    } finally {
      await cleanupTestSubject(subject);
    }
  },
};
