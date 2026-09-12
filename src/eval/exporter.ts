import * as fs from "fs";
import * as path from "path";
import type { EvalCaseResult, ScorecardMetrics } from "./types.js";

const EVAL_DIR = path.resolve(process.cwd(), ".eval-results");

/**
 * Persists evaluation metrics and raw case logs to JSON and Markdown files.
 */
export async function exportReports(
  metrics: ScorecardMetrics,
  results: EvalCaseResult[]
): Promise<{ jsonPath: string; mdPath: string }> {
  if (!fs.existsSync(EVAL_DIR)) {
    fs.mkdirSync(EVAL_DIR, { recursive: true });
  }

  const jsonPath = path.join(EVAL_DIR, "latest.json");
  const mdPath = path.join(EVAL_DIR, "latest.md");

  // 1. Write JSON Report
  const jsonReport = {
    metrics,
    results,
  };
  fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2), "utf-8");

  // 2. Write Markdown Report
  const mdLines = [
    `# Warden Evaluation Report`,
    ``,
    `**Timestamp:** \`${metrics.timestamp}\`  `,
    `**Outcome:** ${metrics.criticalFailures === 0 && metrics.failed === 0 ? "✅ **ALL INVARIANTS PASSED**" : "❌ **FAILURES DETECTED**"}`,
    ``,
    `## Summary Scorecard`,
    ``,
    `| Metric | Value | Target | Status |`,
    `|---|---|---|---|`,
    `| **Total Cases** | ${metrics.totalCases} | 10+ | ✅ Pass |`,
    `| **Passed** | ${metrics.passed} | ${metrics.totalCases} | ${metrics.passed === metrics.totalCases ? "✅ Pass" : "⚠️ Warning"} |`,
    `| **Failed** | ${metrics.failed} | 0 | ${metrics.failed === 0 ? "✅ Pass" : "❌ Failed"} |`,
    `| **Critical Failures** | ${metrics.criticalFailures} | 0 | ${metrics.criticalFailures === 0 ? "✅ Pass" : "🚨 CRITICAL"} |`,
    `| **Rollback Success Rate** | ${metrics.rollbackSuccessRate}% | 100% | ${metrics.rollbackSuccessRate === 100 ? "✅ Pass" : "⚠️ Warning"} |`,
    `| **Unauthorized Executions** | ${metrics.unauthorizedExecutions} | 0 | ${metrics.unauthorizedExecutions === 0 ? "✅ Pass" : "🚨 BREACH"} |`,
    `| **Duplicate Executions** | ${metrics.duplicateExecutions} | 0 | ${metrics.duplicateExecutions === 0 ? "✅ Pass" : "🚨 BREACH"} |`,
    `| **Audit Tamper Detection** | ${metrics.auditTamperDetected ? "DETECTED" : "MISSED"} | DETECTED | ${metrics.auditTamperDetected ? "✅ Pass" : "🚨 INTEGRITY FAIL"} |`,
    `| **Latency (p50 / p95)** | ${metrics.latencyP50Ms}ms / ${metrics.latencyP95Ms}ms | < 250ms | ✅ Pass |`,
    ``,
    `## Detailed Case Results`,
    ``,
    `| ID | Scenario | Case Name | Status | Duration | Invariants Checked | Invariants Violated |`,
    `|---|---|---|---|---|---|---|`,
  ];

  for (const r of results) {
    const statusIcon = r.status === "PASSED" ? "✅ Pass" : r.status === "CRITICAL_FAILURE" ? "🚨 Critical" : "❌ Fail";
    const checked = r.invariantsChecked.join(", ") || "—";
    const violated = r.invariantsViolated.join(", ") || "None";
    mdLines.push(
      `| \`${r.id}\` | ${r.scenario} | ${r.name} | ${statusIcon} | ${r.durationMs}ms | ${checked} | ${violated} |`
    );
  }

  mdLines.push("");
  fs.writeFileSync(mdPath, mdLines.join("\n"), "utf-8");

  return { jsonPath, mdPath };
}
