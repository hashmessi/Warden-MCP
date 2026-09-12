import { scanSubject } from "../../scanner.js";
import { generateImpactReport } from "../../impact/report.js";
import { createPendingAction, approveAction } from "../../approval/store.js";
import { generateTestSubject, seedTestSubject, cleanupTestSubject } from "../seeder.js";
import type { EvalCaseResult, EvalScenario } from "../types.js";

export const concurrentScenario: EvalScenario = {
  id: "scenario-10-concurrent",
  name: "Multi-Agent Concurrent Workload",
  description: "Executes 8 simultaneous agent pipelines (scan, impact, approve) to verify connection pooling, latency, and absence of deadlocks",
  async run(): Promise<EvalCaseResult[]> {
    const results: EvalCaseResult[] = [];
    const CONCURRENCY = 8;
    const subjects = Array.from({ length: CONCURRENCY }, (_, i) =>
      generateTestSubject(`concurrent-${i + 1}`)
    );

    const overallStart = Date.now();

    try {
      // 1. Seed all subjects in parallel
      await Promise.all(subjects.map((s) => seedTestSubject(s)));

      // 2. Concurrently execute scan -> impact -> request -> approve
      const agentPipelines = subjects.map(async (subject, index) => {
        const pipelineStart = Date.now();
        try {
          const scan = await scanSubject(subject.email);
          const impact = await generateImpactReport(scan);
          const pending = await createPendingAction(scan.scanId, "delete", impact);
          const approved = await approveAction(pending.token, `agent-${index + 1}`);

          return {
            index,
            success: approved.status === "approved",
            durationMs: Date.now() - pipelineStart,
          };
        } catch (err: any) {
          return {
            index,
            success: false,
            durationMs: Date.now() - pipelineStart,
            error: err.message,
          };
        }
      });

      const pipelineResults = await Promise.all(agentPipelines);
      const successfulPipelines = pipelineResults.filter((r) => r.success);
      const allPassed = successfulPipelines.length === CONCURRENCY;

      const totalDuration = Date.now() - overallStart;

      results.push({
        id: "case-concurrent-01",
        name: `${CONCURRENCY} Simultaneous Agent Governance Pipelines`,
        scenario: "CONCURRENT_REQUESTS",
        status: allPassed ? "PASSED" : "FAILED",
        durationMs: totalDuration,
        invariantsChecked: ["INV-01-AUTH-GATE", "INV-02-IDEMPOTENCY"],
        invariantsViolated: allPassed ? [] : ["INV-02-IDEMPOTENCY"],
        details: {
          concurrency: CONCURRENCY,
          successfulCount: successfulPipelines.length,
          avgDurationMs: Math.round(
            pipelineResults.reduce((acc, r) => acc + r.durationMs, 0) / CONCURRENCY
          ),
          totalWallClockMs: totalDuration,
        },
      });
    } catch (err: any) {
      results.push({
        id: "case-concurrent-01",
        name: `${CONCURRENCY} Simultaneous Agent Governance Pipelines`,
        scenario: "CONCURRENT_REQUESTS",
        status: "FAILED",
        durationMs: Date.now() - overallStart,
        invariantsChecked: ["INV-01-AUTH-GATE"],
        invariantsViolated: [],
        error: err.message,
      });
    } finally {
      await Promise.all(subjects.map((s) => cleanupTestSubject(s)));
    }

    return results;
  },
};
