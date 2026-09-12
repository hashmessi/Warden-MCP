import { scanSubject } from "../../scanner.js";
import { createPendingAction, approveAction, getApprovalByToken } from "../../approval/store.js";
import { executeAction } from "../../execution/engine.js";
import { generateTestSubject, seedTestSubject, cleanupTestSubject } from "../seeder.js";
import { checkIdempotencyInvariant } from "../invariants.js";
import type { EvalCaseResult, EvalScenario } from "../types.js";

export const raceConditionsScenario: EvalScenario = {
  id: "scenario-06-race-conditions",
  name: "Double Approval & Execution Race Conditions",
  description: "Verifies that concurrent approval requests and concurrent execution attempts are serialized without duplicate mutations",
  async run(): Promise<EvalCaseResult[]> {
    const results: EvalCaseResult[] = [];
    const subject = generateTestSubject("race");
    const start = Date.now();

    try {
      await seedTestSubject(subject);
      const scan = await scanSubject(subject.email);
      const initialCount = scan.totalRecords;

      // 1. Race Condition A: 5 Concurrent Approvals
      const pending = await createPendingAction(scan.scanId, "delete");
      const approvalAttempts = 5;

      const approvalPromises = Array.from({ length: approvalAttempts }, (_, i) =>
        approveAction(pending.token, `approver-${i}`)
      );

      const approvalSettled = await Promise.allSettled(approvalPromises);
      const approvalSuccesses = approvalSettled.filter((s) => s.status === "fulfilled");
      const approvalFailures = approvalSettled.filter((s) => s.status === "rejected");

      // Verify token in store is validly approved and exactly ONE approver succeeded
      const finalApproval = await getApprovalByToken(pending.token);
      const approvalRacePassed =
        finalApproval?.status === "approved" &&
        approvalSuccesses.length === 1 &&
        approvalFailures.length === approvalAttempts - 1;

      results.push({
        id: "case-race-01",
        name: "Concurrent Multi-Approver Race Condition",
        scenario: "DOUBLE_APPROVAL",
        status: approvalRacePassed ? "PASSED" : "CRITICAL_FAILURE",
        durationMs: Date.now() - start,
        invariantsChecked: ["INV-01-AUTH-GATE", "INV-02-IDEMPOTENCY"],
        invariantsViolated: approvalRacePassed ? [] : ["INV-02-IDEMPOTENCY"],
        details: {
          attempts: approvalAttempts,
          successes: approvalSuccesses.length,
          failures: approvalFailures.length,
          finalStatus: finalApproval?.status,
        },
      });

      // 2. Race Condition B: 2 Concurrent Execution Invocations
      const execStart = Date.now();
      const execAttempts = 2;
      const execPromises = Array.from({ length: execAttempts }, () =>
        executeAction(pending.token)
      );

      const execSettled = await Promise.allSettled(execPromises);
      const execSuccesses = execSettled.filter((s) => s.status === "fulfilled");
      const execFailures = execSettled.filter((s) => s.status === "rejected");

      // Verify deletion occurred only once
      const postScan = await scanSubject(subject.email);
      const deletedCount = initialCount - postScan.totalRecords;

      const idempotencyCheck = checkIdempotencyInvariant(
        execAttempts,
        execSuccesses.length,
        initialCount,
        deletedCount
      );

      results.push({
        id: "case-race-02",
        name: "Concurrent Multi-Execution Race Condition",
        scenario: "DOUBLE_EXECUTION",
        status: idempotencyCheck.passed ? "PASSED" : "CRITICAL_FAILURE",
        durationMs: Date.now() - execStart,
        invariantsChecked: ["INV-02-IDEMPOTENCY"],
        invariantsViolated: idempotencyCheck.passed ? [] : ["INV-02-IDEMPOTENCY"],
        details: {
          attempts: execAttempts,
          successes: execSuccesses.length,
          failures: execFailures.length,
          deletedRecords: deletedCount,
        },
      });
    } catch (err: any) {
      results.push({
        id: "case-race-01",
        name: "Concurrent Multi-Approver Race Condition",
        scenario: "DOUBLE_APPROVAL",
        status: "CRITICAL_FAILURE",
        durationMs: Date.now() - start,
        invariantsChecked: ["INV-02-IDEMPOTENCY"],
        invariantsViolated: ["INV-02-IDEMPOTENCY"],
        error: err.message,
      });
    } finally {
      await cleanupTestSubject(subject);
    }

    return results;
  },
};
