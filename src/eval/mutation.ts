import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { query, initDb, closePool } from "../db/postgres.js";
import { closeMongoClient } from "../db/mongodb.js";

export interface MutationDefinition {
  id: string;
  name: string;
  targetInvariant: string;
  description: string;
  file: string;
  originalSnippet: string;
  mutatedSnippet: string;
  targetScenario: string;
  expectedDetection: string;
  customCheck?: () => Promise<boolean>;
}

export interface MutationResult {
  mutation: MutationDefinition;
  status: "KILLED" | "SURVIVED" | "ERROR";
  detectedBy?: string;
  invariantsViolated?: string[];
  outputSnippet?: string;
  durationMs: number;
}

const MUTATIONS: MutationDefinition[] = [
  // MUT-01: Remove CAS Condition in executeAction (INV-02)
  {
    id: "MUT-01",
    name: "Remove Atomic CAS Lock in executeAction",
    targetInvariant: "INV-02-IDEMPOTENCY",
    description: "Removes AND status = 'approved' from the executeAction SQL update, allowing concurrent executions",
    file: "src/execution/engine.ts",
    originalSnippet: "WHERE token = $2 AND status = 'approved'",
    mutatedSnippet: "WHERE token = $2",
    targetScenario: "race",
    expectedDetection: "Concurrent Multi-Execution Race Condition detects duplicate execution",
  },

  // MUT-02: Bypass Authorization Gate on Unapproved Token (INV-01)
  {
    id: "MUT-02",
    name: "Bypass Authorization Check in executeAction",
    targetInvariant: "INV-01-AUTH-GATE",
    description: "Forces execution to proceed even when the approval token is not approved or not found",
    file: "src/execution/engine.ts",
    originalSnippet: `  if (rows.length === 0) {
    const current = await getApprovalByToken(token);
    if (!current) throw new Error(\`Approval token not found: \${token}\`);
    throw new Error(\`Token is not approved, current status: \${current.status}\`);
  }`,
    mutatedSnippet: `  if (rows.length === 0) {
    // MUTATION: Silently bypass authorization check
    const current = await getApprovalByToken(token);
    rows.push(current || { scan_id: "bypass-scan", action: "delete" });
  }`,
    targetScenario: "stale-token",
    expectedDetection: "Non-Existent Token Execution Guard fails INV-01-AUTH-GATE",
  },

  // MUT-03: Permit Execution of Denied Actions (INV-01)
  {
    id: "MUT-03",
    name: "Allow Execution of Denied Actions",
    targetInvariant: "INV-01-AUTH-GATE",
    description: "Allows denied approval tokens to be updated to executing and processed",
    file: "src/execution/engine.ts",
    originalSnippet: "WHERE token = $2 AND status = 'approved'",
    mutatedSnippet: "WHERE token = $2 AND (status = 'approved' OR status = 'denied')",
    targetScenario: "denied",
    expectedDetection: "Denied Action Permanent Lockout fails INV-01-AUTH-GATE",
  },

  // MUT-04: Disable Backward Saga Compensation on Partial Failure (INV-03)
  {
    id: "MUT-04",
    name: "Disable Saga Rollback on Partial Failure",
    targetInvariant: "INV-03-REVERSIBILITY",
    description: "Comments out rollbackAction in executeAction catch block, leaving datastores desynchronized",
    file: "src/execution/engine.ts",
    originalSnippet: "await rollbackAction(executionId, adapters);",
    mutatedSnippet: "// MUTATION: await rollbackAction(executionId, adapters);",
    targetScenario: "partial-failure",
    expectedDetection: "Secondary Store Failure & Saga Compensation fails INV-03-REVERSIBILITY",
  },

  // MUT-05: Corrupt Snapshot Restoration by Omitting a Table (INV-03)
  {
    id: "MUT-05",
    name: "Omit Table During Snapshot Restoration",
    targetInvariant: "INV-03-REVERSIBILITY",
    description: "Skips restoring user_activity records in PostgresAdapter.restoreRecords",
    file: "src/adapters/postgres.adapter.ts",
    originalSnippet: "for (const snap of snapshots) {",
    mutatedSnippet: `for (const snap of snapshots) {
      // MUTATION: Corrupt restore by dropping user_activity
      if (snap.record_id === 'user_activity') continue;`,
    targetScenario: "normal",
    expectedDetection: "Full E2E Normal Lifecycle fails INV-03-REVERSIBILITY due to count mismatch",
  },

  // MUT-06: Blind Audit Integrity Verification (INV-04)
  {
    id: "MUT-06",
    name: "Unconditionally Validate Tampered Audit Log",
    targetInvariant: "INV-04-TAMPER-EVIDENCE",
    description: "Forces AuditLogger.verifyIntegrity() to always return valid: true",
    file: "src/audit/logger.ts",
    originalSnippet: "public static async verifyIntegrity(): Promise<{",
    mutatedSnippet: `public static async verifyIntegrity(): Promise<{
    valid: boolean;
    total: number;
    brokenAt?: number;
    details?: string;
  }> {
    // MUTATION: Blind verification
    return { valid: true, total: 999 };
    // eslint-disable-next-line no-unreachable
    `,
    targetScenario: "tamper",
    expectedDetection: "Direct Audit Log Mutation Detection fails INV-04-TAMPER-EVIDENCE",
  },

  // MUT-07: Remove Multi-Approver Concurrency Guard (INV-01)
  {
    id: "MUT-07",
    name: "Permit Multi-Approver Double Approval",
    targetInvariant: "INV-01-AUTH-GATE",
    description: "Removes status = 'pending' check from approveAction, allowing multiple concurrent approvals",
    file: "src/approval/store.ts",
    originalSnippet: "WHERE token = $2 AND status = 'pending'",
    mutatedSnippet: "WHERE token = $2",
    targetScenario: "race",
    expectedDetection: "Concurrent Multi-Approver Race Condition fails strict single-approver assertion",
  },

  // MUT-08: Invert Snapshot Restore Order (FK Dependency Hazard) (INV-03)
  {
    id: "MUT-08",
    name: "Invert Snapshot Restore Ordering (ORDER BY id DESC)",
    targetInvariant: "INV-03-REVERSIBILITY",
    description: "Restores child tables before parent users table, triggering foreign key violation 23503",
    file: "src/adapters/postgres.adapter.ts",
    originalSnippet: "ORDER BY id ASC",
    mutatedSnippet: "ORDER BY id DESC",
    targetScenario: "normal",
    expectedDetection: "Full E2E Normal Lifecycle fails due to FK violation during restore",
  },

  // MUT-09: Allow Re-Execution of Already Consumed Tokens (INV-02)
  {
    id: "MUT-09",
    name: "Allow Re-Execution of Executed Token",
    targetInvariant: "INV-02-IDEMPOTENCY",
    description: "Permits tokens in status 'executed' to pass Compare-And-Swap lock",
    file: "src/execution/engine.ts",
    originalSnippet: "WHERE token = $2 AND status = 'approved'",
    mutatedSnippet: "WHERE token = $2 AND (status = 'approved' OR status = 'executed')",
    targetScenario: "stale-token",
    expectedDetection: "Consumed Token Re-Execution Guard fails INV-02-IDEMPOTENCY",
  },

  // MUT-10: Bypass Hash-Chain Linkage Validation (INV-04)
  {
    id: "MUT-10",
    name: "Bypass Audit Hash-Chain Link Verification",
    targetInvariant: "INV-04-TAMPER-EVIDENCE",
    description: "Validates individual row hashes but ignores prev_hash chain link mismatches",
    file: "src/audit/logger.ts",
    originalSnippet: `      if (row.prev_hash !== expectedPrevHash) {
        return {
          valid: false,
          total: rows.length,
          brokenAt: row.id,
          details: \`Prev hash mismatch at row \${row.id}: expected \${expectedPrevHash.slice(0, 8)}, got \${row.prev_hash?.slice(0, 8)}\`,
        };
      }`,
    mutatedSnippet: `      // MUTATION: Ignore prev_hash linkage
      /* if (row.prev_hash !== expectedPrevHash) { ... } */`,
    targetScenario: "tamper",
    expectedDetection: "Direct Audit Log Mutation Detection fails INV-04-TAMPER-EVIDENCE",
  },

  // MUT-11: Zero-Out Pre-Execution Snapshots (INV-03)
  {
    id: "MUT-11",
    name: "Skip Taking Pre-Execution Snapshots",
    targetInvariant: "INV-03-REVERSIBILITY",
    description: "Sets snapshot count to 0 without recording rows, breaking restoration reversibility",
    file: "src/execution/engine.ts",
    originalSnippet: "const count = await adapter.snapshotRecords(actualIdentifier, executionId);",
    mutatedSnippet: "// MUTATION: const count = await adapter.snapshotRecords(actualIdentifier, executionId);\n      const count = 0;",
    targetScenario: "normal",
    expectedDetection: "Full E2E Normal Lifecycle fails INV-03-REVERSIBILITY with 0 restored records",
  },

  // MUT-12: Suppress Seeder Cleanup (Leak / Hygiene Detection)
  {
    id: "MUT-12",
    name: "Disable Test Subject Database Cleanup",
    targetInvariant: "HYGIENE",
    description: "Makes cleanupTestSubject a no-op to verify post-test artifact leak detection",
    file: "src/eval/seeder.ts",
    originalSnippet: "export async function cleanupTestSubject(subject: ScenarioSubject): Promise<void> {",
    mutatedSnippet: `export async function cleanupTestSubject(subject: ScenarioSubject): Promise<void> {
    // MUTATION: Intentionally leak test artifacts
    return;`,
    targetScenario: "normal",
    expectedDetection: "Post-evaluation leak audit detects residual test records in database",
    customCheck: async () => {
      const [leaks] = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM users WHERE email LIKE '%@warden.test%'`
      );
      const count = parseInt(leaks.count, 10);
      // Clean up the leaked test users after detection
      await query(`DELETE FROM users WHERE email LIKE '%@warden.test%'`);
      return count > 0; // True if leak was detected (KILLED)
    },
  },
];

async function runMutationSuite(): Promise<void> {
  console.log("\n🧬 [MUTATION TESTING] Starting Warden Mutation Verification Suite...");
  console.log(`Evaluating ${MUTATIONS.length} deliberate defect mutations across 4 core invariants.\n`);

  await initDb();

  // 1. Take in-memory backups of all target files
  const fileBackups = new Map<string, string>();
  for (const m of MUTATIONS) {
    const fullPath = path.resolve(process.cwd(), m.file);
    if (!fileBackups.has(fullPath)) {
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Target file not found: ${fullPath}`);
      }
      fileBackups.set(fullPath, fs.readFileSync(fullPath, "utf-8"));
    }
  }

  const results: MutationResult[] = [];
  const suiteStart = Date.now();

  try {
    for (let i = 0; i < MUTATIONS.length; i++) {
      const m = MUTATIONS[i];
      const fullPath = path.resolve(process.cwd(), m.file);
      const originalContent = fileBackups.get(fullPath)!;

      if (!originalContent.includes(m.originalSnippet)) {
        console.error(`❌ [${m.id}] Failed to locate original snippet in ${m.file}!`);
        results.push({
          mutation: m,
          status: "ERROR",
          durationMs: 0,
          outputSnippet: "Snippet match failed in target file",
        });
        continue;
      }

      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🧪 [${i + 1}/${MUTATIONS.length}] Injecting Mutation ${m.id}: ${m.name}`);
      console.log(`   Target: ${m.file} | Invariant: ${m.targetInvariant}`);
      console.log(`   Expected: ${m.expectedDetection}`);

      // Inject mutation
      const mutatedContent = originalContent.replace(m.originalSnippet, m.mutatedSnippet);
      fs.writeFileSync(fullPath, mutatedContent, "utf-8");

      const runStart = Date.now();
      let killed = false;
      let outputSnippet = "";
      let violated: string[] = [];

      try {
        // Run targeted scenario in a clean sub-process
        const cmd = `npx tsx src/eval/index.ts --scenario=${m.targetScenario}`;
        const output = execSync(cmd, {
          cwd: process.cwd(),
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 15000,
        });

        // If custom check exists (e.g. leak detection for MUT-12)
        if (m.customCheck) {
          const leakDetected = await m.customCheck();
          if (leakDetected) {
            killed = true;
            outputSnippet = "Residual artifact audit caught leaked database records";
          }
        } else {
          // Process exited with 0 — check latest.json to see if any invariant failed
          const latestJsonPath = path.resolve(process.cwd(), ".eval-results", "latest.json");
          if (fs.existsSync(latestJsonPath)) {
            const report = JSON.parse(fs.readFileSync(latestJsonPath, "utf-8"));
            if (report.summary.failed > 0 || report.summary.criticalFailures > 0) {
              killed = true;
              outputSnippet = "Evaluator caught defect (reported failure)";
            }
          }
        }

        if (!killed) {
          outputSnippet = output.slice(0, 150).replace(/\n/g, " ");
        }
      } catch (execErr: any) {
        // Non-zero exit code means evaluator successfully caught defect!
        killed = true;
        const errOutput = (execErr.stdout || "") + (execErr.stderr || "") + (execErr.message || "");
        
        // Extract invariant violation
        if (errOutput.includes("INV-01")) violated.push("INV-01-AUTH-GATE");
        if (errOutput.includes("INV-02")) violated.push("INV-02-IDEMPOTENCY");
        if (errOutput.includes("INV-03")) violated.push("INV-03-REVERSIBILITY");
        if (errOutput.includes("INV-04")) violated.push("INV-04-TAMPER-EVIDENCE");

        outputSnippet = errOutput.slice(0, 180).replace(/\n/g, " ");
      } finally {
        // Immediately restore original file content
        fs.writeFileSync(fullPath, originalContent, "utf-8");
      }

      const durationMs = Date.now() - runStart;

      if (killed) {
        console.log(`   ↳ \x1b[32mKILLED\x1b[0m in ${durationMs}ms — Evaluator successfully detected mutation`);
        results.push({
          mutation: m,
          status: "KILLED",
          detectedBy: m.targetScenario,
          invariantsViolated: violated,
          outputSnippet,
          durationMs,
        });
      } else {
        console.log(`   ↳ \x1b[31mSURVIVED\x1b[0m in ${durationMs}ms — Evaluator was BLIND to this mutation!`);
        results.push({
          mutation: m,
          status: "SURVIVED",
          outputSnippet,
          durationMs,
        });
      }
    }
  } finally {
    // Failsafe: Ensure all files are restored to pristine state
    for (const [filePath, content] of fileBackups.entries()) {
      fs.writeFileSync(filePath, content, "utf-8");
    }
    await closePool();
    await closeMongoClient();
  }

  // Generate Scorecard
  const killedCount = results.filter((r) => r.status === "KILLED").length;
  const survivedCount = results.filter((r) => r.status === "SURVIVED").length;
  const errorCount = results.filter((r) => r.status === "ERROR").length;
  const mutationScore = ((killedCount / results.length) * 100).toFixed(1);

  console.log(`\n╔═════════════════════════════════════════════════════════════════════╗`);
  console.log(`║                   WARDEN MUTATION SCORECARD                         ║`);
  console.log(`╠═════════════════════════════════════════════════════════════════════╣`);
  console.log(`║  Total Mutations Injected:   ${results.length.toString().padEnd(38)} ║`);
  console.log(`║  Mutations Killed (Caught):  ${killedCount.toString().padEnd(38)} ║`);
  console.log(`║  Mutations Survived (Escaped): ${survivedCount.toString().padEnd(36)} ║`);
  console.log(`║  Execution Errors:           ${errorCount.toString().padEnd(38)} ║`);
  console.log(`║  Mutation Score:             ${(`${mutationScore}%`).padEnd(38)} ║`);
  console.log(`╚═════════════════════════════════════════════════════════════════════╝`);

  console.log(`\nMUTATION BREAKDOWN`);
  console.log(`───────────────────────────────────────────────────────────────────────────────────────────`);
  console.log(`Status    ID      Target Invariant       Mutation Name                                `);
  console.log(`───────────────────────────────────────────────────────────────────────────────────────────`);
  for (const r of results) {
    const statusCol = r.status === "KILLED" ? "\x1b[32mKILLED\x1b[0m  " : "\x1b[31mSURVIVED\x1b[0m";
    console.log(`${statusCol}  ${r.mutation.id.padEnd(6)}  ${r.mutation.targetInvariant.padEnd(21)}  ${r.mutation.name.slice(0, 42)}`);
  }
  console.log(`───────────────────────────────────────────────────────────────────────────────────────────`);
  console.log(`⏱ Total Mutation Run Time: ${Date.now() - suiteStart}ms\n`);

  // Save report to .eval-results/mutation-report.json
  const reportPath = path.resolve(process.cwd(), ".eval-results", "mutation-report.json");
  const reportData = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      killed: killedCount,
      survived: survivedCount,
      errors: errorCount,
      mutationScore: `${mutationScore}%`,
    },
    results: results.map((r) => ({
      id: r.mutation.id,
      name: r.mutation.name,
      invariant: r.mutation.targetInvariant,
      file: r.mutation.file,
      status: r.status,
      durationMs: r.durationMs,
      expectedDetection: r.mutation.expectedDetection,
      output: r.outputSnippet?.slice(0, 200),
    })),
  };
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), "utf-8");
  console.log(`📄 Saved Mutation Report: ${reportPath}\n`);

  if (survivedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMutationSuite().catch((err) => {
  console.error("Mutation harness fatal error:", err);
  process.exit(1);
});
