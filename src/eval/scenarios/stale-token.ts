import { randomUUID } from "crypto";
import { scanSubject } from "../../scanner.js";
import { createPendingAction, approveAction } from "../../approval/store.js";
import { executeAction } from "../../execution/engine.js";
import { generateTestSubject, seedTestSubject, cleanupTestSubject } from "../seeder.js";
import { checkAuthGateInvariant } from "../invariants.js";
import type { EvalCaseResult, EvalScenario } from "../types.js";

export const staleTokenScenario: EvalScenario = {
  id: "scenario-04-stale-token",
  name: "Stale & Consumed Token Rejection",
  description: "Verifies that consumed tokens or fabricated UUIDs are strictly rejected by the execution engine",
  async run(): Promise<EvalCaseResult[]> {
    const results: EvalCaseResult[] = [];
    const subject = generateTestSubject("stale-token");
    const start = Date.now();

    try {
      await seedTestSubject(subject);
      const scan = await scanSubject(subject.email);
      const pending = await createPendingAction(scan.scanId, "delete");
      const approved = await approveAction(pending.token, "eval-user");

      // 1. First execution consumes the token
      await executeAction(approved.token);

      // 2. Second execution attempt with same (now consumed/executed) token
      let reExecutionErrorThrown = false;
      let reExecutionErrorMessage = "";
      try {
        await executeAction(approved.token);
      } catch (err: any) {
        reExecutionErrorThrown = true;
        reExecutionErrorMessage = err.message;
      }

      const checkReExecution = checkAuthGateInvariant("executed", false, reExecutionErrorThrown);

      results.push({
        id: "case-stale-01",
        name: "Consumed Token Re-Execution Guard",
        scenario: "STALE_TOKEN",
        status: checkReExecution.passed ? "PASSED" : "CRITICAL_FAILURE",
        durationMs: Date.now() - start,
        invariantsChecked: ["INV-01-AUTH-GATE", "INV-02-IDEMPOTENCY"],
        invariantsViolated: checkReExecution.passed ? [] : ["INV-01-AUTH-GATE"],
        details: {
          token: approved.token,
          reExecutionErrorThrown,
          errorMessage: reExecutionErrorMessage,
        },
      });

      // 3. Attempt execution with a fabricated non-existent token
      const fakeToken = randomUUID();
      let fakeTokenErrorThrown = false;
      try {
        await executeAction(fakeToken);
      } catch (err: any) {
        fakeTokenErrorThrown = true;
      }

      const checkFakeToken = checkAuthGateInvariant("non_existent", false, fakeTokenErrorThrown);

      results.push({
        id: "case-stale-02",
        name: "Non-Existent Token Execution Guard",
        scenario: "STALE_TOKEN",
        status: checkFakeToken.passed ? "PASSED" : "CRITICAL_FAILURE",
        durationMs: Date.now() - start,
        invariantsChecked: ["INV-01-AUTH-GATE"],
        invariantsViolated: checkFakeToken.passed ? [] : ["INV-01-AUTH-GATE"],
        details: {
          fakeToken,
          fakeTokenErrorThrown,
        },
      });
    } catch (err: any) {
      results.push({
        id: "case-stale-01",
        name: "Consumed Token Re-Execution Guard",
        scenario: "STALE_TOKEN",
        status: "CRITICAL_FAILURE",
        durationMs: Date.now() - start,
        invariantsChecked: ["INV-01-AUTH-GATE"],
        invariantsViolated: ["INV-01-AUTH-GATE"],
        error: err.message,
      });
    } finally {
      await cleanupTestSubject(subject);
    }

    return results;
  },
};
