import { scanSubject } from "../../scanner.js";
import { createPendingAction, approveAction } from "../../approval/store.js";
import { executeAction, rollbackAction } from "../../execution/engine.js";
import { PostgresAdapter } from "../../adapters/postgres.adapter.js";
import { MongoDbAdapter } from "../../adapters/mongodb.adapter.js";
import { PaymentLedgerAdapter } from "../../adapters/payment.adapter.js";
import { createFaultProxy } from "../proxy.js";
import { generateTestSubject, seedTestSubject, cleanupTestSubject } from "../seeder.js";
import type { EvalCaseResult, EvalScenario } from "../types.js";

export const rollbackFailureScenario: EvalScenario = {
  id: "scenario-08-rollback-failure",
  name: "Rollback Recovery Failure Handling",
  description: "Simulates failure during snapshot restoration and verifies system handles critical recovery alert states",
  async run(): Promise<EvalCaseResult[]> {
    const start = Date.now();
    const subject = generateTestSubject("rollback-failure");

    try {
      await seedTestSubject(subject);
      const scan = await scanSubject(subject.email);
      const pending = await createPendingAction(scan.scanId, "delete");
      const approved = await approveAction(pending.token, "eval-user");

      // 1. Execute normal deletion
      const executionId = await executeAction(approved.token);

      // 2. Inject failure on Postgres adapter restoreRecords
      const pgAdapter = new PostgresAdapter();
      const pgProxy = createFaultProxy(pgAdapter);
      pgProxy.failOn("restoreRecords", new Error("Simulated disk write corruption during restore"));

      const customAdapters = [
        pgProxy,
        new MongoDbAdapter(),
        new PaymentLedgerAdapter(),
      ];

      let errorThrown = false;
      let caughtErrorMessage = "";

      try {
        await rollbackAction(executionId, customAdapters);
      } catch (err: any) {
        errorThrown = true;
        caughtErrorMessage = err.message;
      }

      // In this failure injection test, error MUST be thrown to alert operators
      const passed = errorThrown && caughtErrorMessage.includes("Simulated disk write corruption");

      return [
        {
          id: "case-rollback-fail-01",
          name: "Rollback Failure Detection & Alert",
          scenario: "ROLLBACK_FAILURE",
          status: passed ? "PASSED" : "CRITICAL_FAILURE",
          durationMs: Date.now() - start,
          invariantsChecked: ["INV-03-REVERSIBILITY"],
          invariantsViolated: passed ? [] : ["INV-03-REVERSIBILITY"],
          details: {
            executionId,
            errorThrown,
            errorMessage: caughtErrorMessage,
            handledSafely: passed,
          },
        },
      ];
    } catch (err: any) {
      return [
        {
          id: "case-rollback-fail-01",
          name: "Rollback Failure Detection & Alert",
          scenario: "ROLLBACK_FAILURE",
          status: "FAILED",
          durationMs: Date.now() - start,
          invariantsChecked: ["INV-03-REVERSIBILITY"],
          invariantsViolated: [],
          error: err.message,
        },
      ];
    } finally {
      await cleanupTestSubject(subject);
    }
  },
};
