import { scanSubject } from "../../scanner.js";
import { createPendingAction, approveAction } from "../../approval/store.js";
import { executeAction } from "../../execution/engine.js";
import { PostgresAdapter } from "../../adapters/postgres.adapter.js";
import { MongoDbAdapter } from "../../adapters/mongodb.adapter.js";
import { PaymentLedgerAdapter } from "../../adapters/payment.adapter.js";
import { createFaultProxy } from "../proxy.js";
import { generateTestSubject, seedTestSubject, cleanupTestSubject } from "../seeder.js";
import type { EvalCaseResult, EvalScenario } from "../types.js";

export const partialFailureScenario: EvalScenario = {
  id: "scenario-07-partial-failure",
  name: "Distributed Partial Failure & Compensation",
  description: "Simulates failure in secondary datastore (MongoDB) during mutation and verifies automatic backward compensation rollback",
  async run(): Promise<EvalCaseResult[]> {
    const start = Date.now();
    const subject = generateTestSubject("partial-failure");

    try {
      await seedTestSubject(subject);
      const initialScan = await scanSubject(subject.email);
      const initialCount = initialScan.totalRecords;

      const pending = await createPendingAction(initialScan.scanId, "delete");
      const approved = await approveAction(pending.token, "eval-user");

      // Wrap MongoDB adapter with Fault Proxy configured to fail during deletion
      const realMongo = new MongoDbAdapter();
      const mongoProxy = createFaultProxy(realMongo);
      mongoProxy.failOn("deleteRecords", new Error("Simulated MongoDB network dropout"));

      const customAdapters = [
        new PostgresAdapter(),
        mongoProxy,
        new PaymentLedgerAdapter(),
      ];

      let errorThrown = false;
      let caughtErrorMessage = "";

      try {
        await executeAction(approved.token, customAdapters);
      } catch (err: any) {
        errorThrown = true;
        caughtErrorMessage = err.message;
      }

      // Check that backward compensation restored Postgres records
      const postFailureScan = await scanSubject(subject.email);
      // Because compensation rollback ran, the record count should equal initialCount
      const compensated = postFailureScan.totalRecords === initialCount;

      const passed = errorThrown && compensated;

      return [
        {
          id: "case-partial-01",
          name: "Secondary Store Failure & Saga Compensation",
          scenario: "PARTIAL_FAILURE",
          status: passed ? "PASSED" : "CRITICAL_FAILURE",
          durationMs: Date.now() - start,
          invariantsChecked: ["INV-03-REVERSIBILITY"],
          invariantsViolated: passed ? [] : ["INV-03-REVERSIBILITY"],
          details: {
            initialRecords: initialCount,
            postCompensationRecords: postFailureScan.totalRecords,
            errorThrown,
            errorMessage: caughtErrorMessage,
          },
        },
      ];
    } catch (err: any) {
      return [
        {
          id: "case-partial-01",
          name: "Secondary Store Failure & Saga Compensation",
          scenario: "PARTIAL_FAILURE",
          status: "CRITICAL_FAILURE",
          durationMs: Date.now() - start,
          invariantsChecked: ["INV-03-REVERSIBILITY"],
          invariantsViolated: ["INV-03-REVERSIBILITY"],
          error: err.message,
        },
      ];
    } finally {
      await cleanupTestSubject(subject);
    }
  },
};
