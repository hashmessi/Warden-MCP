import "dotenv/config";
import { initDb, closePool } from "../db/postgres.js";
import { closeMongoClient } from "../db/mongodb.js";
import { allScenarios } from "./scenarios/index.js";
import { computeMetrics, renderTerminalScorecard } from "./reporter.js";
import { exportReports } from "./exporter.js";
import type { EvalCaseResult } from "./types.js";

async function main(): Promise<void> {
  console.log("\n🚀 Starting Warden Evaluation Suite...");
  console.log(`Loaded ${allScenarios.length} evaluation scenarios.\n`);

  // Ensure DB schemas and tables exist
  await initDb();

  const scenarioFilter = process.argv.find((a) => a.startsWith("--scenario="))?.split("=")[1];
  const scenariosToRun = scenarioFilter
    ? allScenarios.filter((s) => s.id.includes(scenarioFilter) || s.name.toLowerCase().includes(scenarioFilter.toLowerCase()))
    : allScenarios;

  const allResults: EvalCaseResult[] = [];
  const suiteStartTime = Date.now();

  for (const scenario of scenariosToRun) {
    process.stdout.write(`  ▶ Running ${scenario.name}... `);
    const scenarioStart = Date.now();
    try {
      const caseResults = await scenario.run();
      allResults.push(...caseResults);

      const hasCritical = caseResults.some((c) => c.status === "CRITICAL_FAILURE");
      const hasFailed = caseResults.some((c) => c.status === "FAILED");
      const elapsed = Date.now() - scenarioStart;

      if (hasCritical) {
        console.log(`\x1b[31mCRITICAL FAILURE\x1b[0m (${elapsed}ms)`);
      } else if (hasFailed) {
        console.log(`\x1b[33mFAILED\x1b[0m (${elapsed}ms)`);
      } else {
        console.log(`\x1b[32mPASSED\x1b[0m (${elapsed}ms)`);
      }
    } catch (err: any) {
      const elapsed = Date.now() - scenarioStart;
      console.log(`\x1b[31mERROR\x1b[0m (${elapsed}ms) - ${err.message}`);
      allResults.push({
        id: `err-${scenario.id}`,
        name: scenario.name,
        scenario: scenario.id,
        status: "CRITICAL_FAILURE",
        durationMs: elapsed,
        invariantsChecked: [],
        invariantsViolated: [],
        error: err.message,
      });
    }
  }

  const suiteElapsed = Date.now() - suiteStartTime;

  // 1. Compute Metrics
  const metrics = computeMetrics(allResults);

  // 2. Render Scorecard to Console
  renderTerminalScorecard(metrics, allResults);

  // 3. Export Reports to .eval-results/
  const { jsonPath, mdPath } = await exportReports(metrics, allResults);
  console.log(`📄 Saved JSON report: ${jsonPath}`);
  console.log(`📄 Saved Markdown report: ${mdPath}`);
  console.log(`⏱ Total evaluation suite duration: ${suiteElapsed}ms\n`);

  // Close database connections gracefully
  try {
    await closePool();
    await closeMongoClient();
  } catch (closeErr) {
    // Ignore close errors
  }

  // 4. Exit Code Gate
  if (metrics.criticalFailures > 0 || metrics.unauthorizedExecutions > 0 || metrics.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(async (err) => {
  console.error("\n❌ Fatal error in evaluation harness runner:", err);
  try {
    await closePool();
    await closeMongoClient();
  } catch {}
  process.exit(1);
});
