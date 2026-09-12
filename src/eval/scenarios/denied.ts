import { scanSubject } from "../../scanner.js";
import { createPendingAction, denyAction } from "../../approval/store.js";
import { executeAction } from "../../execution/engine.js";
import { generateTestSubject, seedTestSubject, cleanupTestSubject } from "../seeder.js";
import { checkAuthGateInvariant } from "../invariants.js";
import type { EvalCaseResult, EvalScenario } from "../types.js";

export const deniedScenario: EvalScenario = {
  id: "scenario-05-denied",
  name: "Denied Request Execution Lockout",
  description: "Verifies that an action explicitly marked as denied cannot be executed and causes zero data mutation",
  async run(): Promise<EvalCaseResult[]> {
    const start = Date.now();
    const subject = generateTestSubject("denied");

    try {
      await seedTestSubject(subject);
      const scan = await scanSubject(subject.email);
      const initialCount = scan.totalRecords;

      // Request and explicitly Deny
      const pending = await createPendingAction(scan.scanId, "delete");
      const denied = await denyAction(pending.token, "compliance-officer");

      // Attempt to execute denied action
      let errorThrown = false;
      let errorMessage = "";
      try {
        await executeAction(denied.token);
      } catch (err: any) {
        errorThrown = true;
        errorMessage = err.message;
      }

      // Check if data was mutated
      const postAttemptScan = await scanSubject(subject.email);
      const dataUnmutated = postAttemptScan.totalRecords === initialCount;

      const authCheck = checkAuthGateInvariant("denied", !dataUnmutated, errorThrown);

      const passed = authCheck.passed && dataUnmutated && errorThrown;

      return [
        {
          id: "case-denied-01",
          name: "Denied Action Permanent Lockout",
          scenario: "DENIED",
          status: passed ? "PASSED" : "CRITICAL_FAILURE",
          durationMs: Date.now() - start,
          invariantsChecked: ["INV-01-AUTH-GATE"],
          invariantsViolated: passed ? [] : ["INV-01-AUTH-GATE"],
          details: {
            token: denied.token,
            status: denied.status,
            errorThrown,
            errorMessage,
            recordsPreserved: dataUnmutated,
          },
        },
      ];
    } catch (err: any) {
      return [
        {
          id: "case-denied-01",
          name: "Denied Action Permanent Lockout",
          scenario: "DENIED",
          status: "CRITICAL_FAILURE",
          durationMs: Date.now() - start,
          invariantsChecked: ["INV-01-AUTH-GATE"],
          invariantsViolated: ["INV-01-AUTH-GATE"],
          error: err.message,
        },
      ];
    } finally {
      await cleanupTestSubject(subject);
    }
  },
};
