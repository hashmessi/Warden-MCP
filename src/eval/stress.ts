import { initDb, closePool, query } from "../db/postgres.js";
import { getMongoDb, closeMongoClient } from "../db/mongodb.js";
import { raceConditionsScenario } from "./scenarios/race-conditions.js";
import { partialFailureScenario } from "./scenarios/partial-failure.js";
import { rollbackFailureScenario } from "./scenarios/rollback-failure.js";
import { concurrentScenario } from "./scenarios/concurrent.js";
import { AuditLogger } from "../audit/logger.js";
import type { EvalCaseResult, EvalScenario } from "./types.js";

interface StressRunStats {
  scenario: string;
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  criticalFailures: number;
  latenciesMs: number[];
  errors: Record<string, number>;
}

const TARGET_SCENARIOS: { name: string; scenario: EvalScenario }[] = [
  { name: "DOUBLE_APPROVAL & DOUBLE_EXECUTION", scenario: raceConditionsScenario },
  { name: "PARTIAL_FAILURE", scenario: partialFailureScenario },
  { name: "ROLLBACK_FAILURE", scenario: rollbackFailureScenario },
  { name: "CONCURRENT_REQUESTS", scenario: concurrentScenario },
];

async function runStressSuite(runsPerScenario: number, specificScenario?: string): Promise<void> {
  console.log(`\n🔥 [STRESS HARNESS] Attacking Warden Evaluator with ${runsPerScenario} repeated runs...`);
  console.log(`Targeting High-Risk Distributed Scenarios:\n- DOUBLE_EXECUTION\n- DOUBLE_APPROVAL\n- PARTIAL_FAILURE\n- ROLLBACK_FAILURE\n- CONCURRENT_REQUESTS\n`);

  await initDb();
  await getMongoDb();

  // Baseline cleanup of any legacy evaluation artifacts from earlier runs
  await query(`DELETE FROM execution_steps WHERE execution_id NOT IN (SELECT execution_id FROM approvals WHERE execution_id IS NOT NULL)`);
  await query(`DELETE FROM snapshots WHERE execution_id NOT IN (SELECT execution_id FROM approvals WHERE execution_id IS NOT NULL)`);
  await query(`DELETE FROM approvals WHERE scan_id NOT IN (SELECT scan_id::text FROM scans)`);

  const scenariosToRun = specificScenario
    ? TARGET_SCENARIOS.filter((s) => s.name.toLowerCase().includes(specificScenario.toLowerCase()) || s.scenario.id.includes(specificScenario.toLowerCase()))
    : TARGET_SCENARIOS;

  if (scenariosToRun.length === 0) {
    console.error(`No scenarios matched filter: "${specificScenario}"`);
    return;
  }

  const overallStart = Date.now();
  const summaryStats: Record<string, StressRunStats> = {};

  for (const item of scenariosToRun) {
    const stats: StressRunStats = {
      scenario: item.name,
      totalRuns: 0,
      passedRuns: 0,
      failedRuns: 0,
      criticalFailures: 0,
      latenciesMs: [],
      errors: {},
    };
    summaryStats[item.name] = stats;

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`⚡ Testing Scenario: ${item.name} (${runsPerScenario} iterations)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const batchStart = Date.now();
    let lastProgressTime = Date.now();

    for (let i = 1; i <= runsPerScenario; i++) {
      const runStart = Date.now();
      try {
        const results: EvalCaseResult[] = await item.scenario.run();
        const duration = Date.now() - runStart;
        stats.totalRuns++;
        stats.latenciesMs.push(duration);

        let anyFailed = false;
        let anyCritical = false;

        for (const res of results) {
          if (res.status === "FAILED") anyFailed = true;
          if (res.status === "CRITICAL_FAILURE") anyCritical = true;
        }

        if (anyCritical) {
          stats.criticalFailures++;
          const errKey = results.map(r => r.error || r.invariantsViolated.join(",")).filter(Boolean).join("; ") || "Critical Invariant Violation";
          stats.errors[errKey] = (stats.errors[errKey] || 0) + 1;
        } else if (anyFailed) {
          stats.failedRuns++;
          const errKey = results.map(r => r.error).filter(Boolean).join("; ") || "Assertion Failure";
          stats.errors[errKey] = (stats.errors[errKey] || 0) + 1;
        } else {
          stats.passedRuns++;
        }
      } catch (err: any) {
        const duration = Date.now() - runStart;
        stats.totalRuns++;
        stats.latenciesMs.push(duration);
        stats.criticalFailures++;
        const errMsg = err.message || "Unhandled exception";
        stats.errors[errMsg] = (stats.errors[errMsg] || 0) + 1;
      }

      // Progress reporting every 25 runs or 2.5 seconds
      if (i % 25 === 0 || i === runsPerScenario || Date.now() - lastProgressTime > 2500) {
        const pct = Math.round((i / runsPerScenario) * 100);
        const passPct = Math.round((stats.passedRuns / stats.totalRuns) * 100);
        process.stdout.write(`\r  Progress: [${i}/${runsPerScenario}] (${pct}%) — Passed: ${stats.passedRuns}, Failed: ${stats.failedRuns}, Critical: ${stats.criticalFailures} (${passPct}% pass rate)`);
        lastProgressTime = Date.now();
      }
    }
    console.log(`\n  Completed in ${Date.now() - batchStart}ms`);
  }

  // Check for residual leaked evaluation artifacts in database
  console.log(`\n🔍 [POST-STRESS SANITY] Inspecting Database for Leaked Artifacts...`);
  const [leakedUsers] = await query<{ count: string }>(`SELECT COUNT(*) as count FROM users WHERE email LIKE '%@warden.test%'`);
  const [leakedSteps] = await query<{ count: string }>(`SELECT COUNT(*) as count FROM execution_steps WHERE execution_id NOT IN (SELECT execution_id FROM approvals WHERE execution_id IS NOT NULL)`);
  const [leakedSnapshots] = await query<{ count: string }>(`SELECT COUNT(*) as count FROM snapshots WHERE execution_id NOT IN (SELECT execution_id FROM approvals WHERE execution_id IS NOT NULL)`);
  const [leakedApprovals] = await query<{ count: string }>(`SELECT COUNT(*) as count FROM approvals WHERE scan_id NOT IN (SELECT scan_id::text FROM scans)`);
  
  const mongoDb = await getMongoDb();
  const leakedSessions = await mongoDb.collection("sessions").countDocuments({ email: { $regex: "@warden.test$" } });

  const auditIntegrity = await AuditLogger.verifyIntegrity();

  console.log(`\n╔═════════════════════════════════════════════════════════════════════╗`);
  console.log(`║                  WARDEN STRESS TEST FINAL REPORT                    ║`);
  console.log(`╠═════════════════════════════════════════════════════════════════════╣`);
  for (const [name, s] of Object.entries(summaryStats)) {
    s.latenciesMs.sort((a, b) => a - b);
    const p50 = s.latenciesMs[Math.floor(s.latenciesMs.length * 0.5)] || 0;
    const p95 = s.latenciesMs[Math.floor(s.latenciesMs.length * 0.95)] || 0;
    const max = s.latenciesMs[s.latenciesMs.length - 1] || 0;
    const passPct = ((s.passedRuns / s.totalRuns) * 100).toFixed(1);

    console.log(`║ ${name.padEnd(67)} ║`);
    console.log(`║   Runs: ${s.totalRuns.toString().padEnd(6)} | Pass: ${s.passedRuns.toString().padEnd(5)} | Fail: ${s.failedRuns.toString().padEnd(4)} | Crit: ${s.criticalFailures.toString().padEnd(4)} | Rate: ${passPct}%`.padEnd(69) + "║");
    console.log(`║   Latency p50: ${p50}ms | p95: ${p95}ms | max: ${max}ms`.padEnd(69) + "║");
    if (Object.keys(s.errors).length > 0) {
      console.log(`║   Anomalies Detected:`.padEnd(69) + "║");
      for (const [err, count] of Object.entries(s.errors)) {
        console.log(`║     - (${count}x) ${err.slice(0, 58)}`.padEnd(69) + "║");
      }
    }
  }
  console.log(`╠═════════════════════════════════════════════════════════════════════╣`);
  console.log(`║ RESIDUAL ARTIFACT AUDIT:                                            ║`);
  console.log(`║   - Leaked Test Users in Postgres:       ${leakedUsers.count.padEnd(26)} ║`);
  console.log(`║   - Leaked Execution Steps:              ${leakedSteps.count.padEnd(26)} ║`);
  console.log(`║   - Leaked Orphan Snapshots:             ${leakedSnapshots.count.padEnd(26)} ║`);
  console.log(`║   - Leaked Orphan Approvals:             ${leakedApprovals.count.padEnd(26)} ║`);
  console.log(`║   - Leaked MongoDB Sessions:             ${leakedSessions.toString().padEnd(26)} ║`);
  console.log(`║   - Audit Hash Chain Tamper Check:       ${auditIntegrity.valid ? "VALID (No Corruption)".padEnd(26) : "CORRUPTED!".padEnd(26)} ║`);
  console.log(`╚═════════════════════════════════════════════════════════════════════╝`);
  console.log(`⏱ Total Stress Run Wall-Clock Time: ${Date.now() - overallStart}ms\n`);

  await closePool();
  await closeMongoClient();
}

const runsArg = process.argv.find((a) => a.startsWith("--runs="));
const runs = runsArg ? parseInt(runsArg.split("=")[1], 10) : 100;
const scenarioArg = process.argv.find((a) => a.startsWith("--scenario="));
const scenario = scenarioArg ? scenarioArg.split("=")[1] : undefined;

runStressSuite(runs, scenario).catch((err) => {
  console.error("Stress harness error:", err);
  process.exit(1);
});
