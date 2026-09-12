import { randomUUID } from "crypto";
import { scanSubject } from "../../scanner.js";
import type { EvalCaseResult, EvalScenario } from "../types.js";

export const noMatchScenario: EvalScenario = {
  id: "scenario-02-no-match",
  name: "Non-Existent Subject Query",
  description: "Verifies scanner returns clean zero-hit response without error when subject is not in any system",
  async run(): Promise<EvalCaseResult[]> {
    const start = Date.now();
    const nonExistentEmail = `nonexistent-user-${randomUUID().slice(0, 8)}@nowhere.invalid`;

    try {
      const scan = await scanSubject(nonExistentEmail);
      const passed = scan.totalRecords === 0 && scan.hits.every((h) => h.rowCount === 0);

      return [
        {
          id: "case-nomatch-01",
          name: "Scan Subject Zero Hits",
          scenario: "NO_MATCH",
          status: passed ? "PASSED" : "FAILED",
          durationMs: Date.now() - start,
          invariantsChecked: ["INV-01-AUTH-GATE"],
          invariantsViolated: passed ? [] : ["INV-01-AUTH-GATE"],
          details: {
            scannedEmail: nonExistentEmail,
            totalRecordsFound: scan.totalRecords,
            systemsScanned: scan.systemsScanned,
          },
        },
      ];
    } catch (err: any) {
      return [
        {
          id: "case-nomatch-01",
          name: "Scan Subject Zero Hits",
          scenario: "NO_MATCH",
          status: "FAILED",
          durationMs: Date.now() - start,
          invariantsChecked: ["INV-01-AUTH-GATE"],
          invariantsViolated: [],
          error: `Zero-match scan threw an unexpected error: ${err.message}`,
        },
      ];
    }
  },
};
