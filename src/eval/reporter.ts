import type { EvalCaseResult, ScorecardMetrics } from "./types.js";

/**
 * Computes aggregate scorecard metrics and latency percentiles.
 */
export function computeMetrics(results: EvalCaseResult[]): ScorecardMetrics {
  const totalCases = results.length;
  const passed = results.filter((r) => r.status === "PASSED").length;
  const failed = results.filter((r) => r.status === "FAILED").length;
  const criticalFailures = results.filter((r) => r.status === "CRITICAL_FAILURE").length;

  // Unauthorized executions: any case where INV-01 was violated
  const unauthorizedExecutions = results.filter((r) =>
    r.invariantsViolated.includes("INV-01-AUTH-GATE")
  ).length;

  // Duplicate executions: any case where INV-02 was violated
  const duplicateExecutions = results.filter((r) =>
    r.invariantsViolated.includes("INV-02-IDEMPOTENCY")
  ).length;

  // Audit tamper detected: tamper scenario passed its detection invariant
  const tamperCase = results.find((r) => r.scenario === "TAMPER");
  const auditTamperDetected =
    tamperCase !== undefined &&
    tamperCase.status === "PASSED" &&
    !tamperCase.invariantsViolated.includes("INV-04-TAMPER-EVIDENCE");

  // Rollback success rate: percentage of tests evaluating INV-03 that passed
  const reversibilityCases = results.filter((r) =>
    r.invariantsChecked.includes("INV-03-REVERSIBILITY")
  );
  const reversibilityPassed = reversibilityCases.filter(
    (r) => !r.invariantsViolated.includes("INV-03-REVERSIBILITY")
  ).length;
  const rollbackSuccessRate =
    reversibilityCases.length > 0
      ? Math.round((reversibilityPassed / reversibilityCases.length) * 1000) / 10
      : 100.0;

  // Latencies
  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const p50Index = Math.floor(durations.length * 0.5);
  const p95Index = Math.min(Math.floor(durations.length * 0.95), durations.length - 1);
  const latencyP50Ms = durations[p50Index] || 0;
  const latencyP95Ms = durations[p95Index] || 0;

  return {
    totalCases,
    passed,
    failed,
    criticalFailures,
    rollbackSuccessRate,
    unauthorizedExecutions,
    duplicateExecutions,
    auditTamperDetected,
    latencyP50Ms,
    latencyP95Ms,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Renders an ANSI formatted scorecard box to stdout.
 */
export function renderTerminalScorecard(
  metrics: ScorecardMetrics,
  results: EvalCaseResult[]
): void {
  const c = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
    gray: "\x1b[90m",
    white: "\x1b[37m",
  };

  const pad = (str: string | number, len: number) => String(str).padEnd(len);
  const padNum = (num: number, len: number) => String(num).padStart(len);

  console.log("");
  console.log(`${c.bold}${c.cyan}╔═════════════════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.bold}${c.cyan}║                     WARDEN EVALUATION SCORECARD                     ║${c.reset}`);
  console.log(`${c.bold}${c.cyan}╠═════════════════════════════════════════════════════════════════════╣${c.reset}`);
  
  const statusColor = metrics.criticalFailures === 0 && metrics.failed === 0 ? c.green : c.red;
  console.log(`║  Total Cases:         ${pad(metrics.totalCases, 44)}  ║`);
  console.log(`║  Passed:              ${c.green}${pad(metrics.passed, 44)}${c.reset}  ║`);
  console.log(`║  Failed:              ${metrics.failed > 0 ? c.yellow : c.gray}${pad(metrics.failed, 44)}${c.reset}  ║`);
  console.log(`║  Critical Failures:   ${metrics.criticalFailures > 0 ? c.red : c.gray}${pad(metrics.criticalFailures, 44)}${c.reset}  ║`);
  console.log(`║  Rollback Success:    ${c.green}${pad(`${metrics.rollbackSuccessRate}%`, 44)}${c.reset}  ║`);
  console.log(`║  Unauthorized Exec:   ${metrics.unauthorizedExecutions === 0 ? c.green : c.red}${pad(metrics.unauthorizedExecutions, 44)}${c.reset}  ║`);
  console.log(`║  Duplicate Exec:      ${metrics.duplicateExecutions === 0 ? c.green : c.red}${pad(metrics.duplicateExecutions, 44)}${c.reset}  ║`);
  console.log(`║  Audit Tamper:        ${metrics.auditTamperDetected ? c.green : c.red}${pad(metrics.auditTamperDetected ? "DETECTED" : "UNDETECTED", 44)}${c.reset}  ║`);
  console.log(`║  Latency (p50 / p95): ${c.white}${pad(`${metrics.latencyP50Ms}ms / ${metrics.latencyP95Ms}ms`, 44)}${c.reset}  ║`);
  console.log(`${c.bold}${c.cyan}╚═════════════════════════════════════════════════════════════════════╝${c.reset}`);
  console.log("");

  // Detailed breakdown table
  console.log(`${c.bold}SCENARIO BREAKDOWN${c.reset}`);
  console.log(`${c.gray}───────────────────────────────────────────────────────────────────────${c.reset}`);
  console.log(
    `${c.bold}${pad("Status", 10)} ${pad("Scenario", 24)} ${pad("Case Name", 28)} ${pad("Duration", 10)}${c.reset}`
  );
  console.log(`${c.gray}───────────────────────────────────────────────────────────────────────${c.reset}`);

  for (const r of results) {
    const badge =
      r.status === "PASSED"
        ? `${c.green}PASS${c.reset}`
        : r.status === "CRITICAL_FAILURE"
        ? `${c.red}CRIT${c.reset}`
        : `${c.yellow}FAIL${c.reset}`;

    const scenarioText = r.scenario.slice(0, 22);
    const caseText = r.name.slice(0, 26);
    const dur = `${r.durationMs}ms`;

    console.log(`${pad(badge, 19)} ${pad(scenarioText, 24)} ${pad(caseText, 28)} ${pad(dur, 10)}`);
    if (r.error) {
      console.log(`   ${c.red}↳ Error: ${r.error}${c.reset}`);
    }
    if (r.invariantsViolated.length > 0) {
      console.log(`   ${c.red}↳ Violated: ${r.invariantsViolated.join(", ")}${c.reset}`);
    }
  }
  console.log(`${c.gray}───────────────────────────────────────────────────────────────────────${c.reset}`);
  console.log("");
}
