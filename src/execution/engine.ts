import { randomUUID } from "crypto";
import { createAdapterRegistry } from "../adapters/index.js";
import type { DataAdapter } from "../adapters/types.js";
import { getApprovalByToken, updateActionStatus } from "../approval/store.js";
import { AuditLogger } from "../audit/logger.js";
import { getScanResult } from "../scanner.js";
import { query } from "../db/postgres.js";

async function logStep(
  executionId: string,
  stepName: string,
  system: string,
  status: "started" | "completed" | "failed",
  details?: any
): Promise<void> {
  await query(
    `INSERT INTO execution_steps (execution_id, step_name, system, status, details) VALUES ($1, $2, $3, $4, $5)`,
    [executionId, stepName, system, status, details ? JSON.stringify(details) : null]
  );
}

export async function executeAction(token: string, customAdapters?: DataAdapter[]): Promise<string> {
  const executionId = randomUUID();

  // Atomic CAS transition: approved -> executing
  const rows = await query<any>(
    `UPDATE approvals 
     SET status = 'executing', execution_id = $1 
     WHERE token = $2 AND status = 'approved' 
     RETURNING *`,
    [executionId, token]
  );

  if (rows.length === 0) {
    const current = await getApprovalByToken(token);
    if (!current) throw new Error(`Approval token not found: ${token}`);
    throw new Error(`Token is not approved, current status: ${current.status}`);
  }

  const approval = rows[0];
  const scanResult = await getScanResult(approval.scan_id);
  if (!scanResult) {
    throw new Error(`Scan result not found (memory or DB): ${approval.scan_id}`);
  }

  const actualIdentifier = scanResult.identifier;
  const adapters = customAdapters ?? createAdapterRegistry();

  await AuditLogger.appendLog({
    action: "EXECUTION_STARTED",
    actor: "execution_engine",
    subject: actualIdentifier,
    details: { executionId, token, action: approval.action },
  });

  // Phase A: Snapshot
  try {
    for (const adapter of adapters) {
      await logStep(executionId, "SNAPSHOT", adapter.systemName, "started");
      const count = await adapter.snapshotRecords(actualIdentifier, executionId);
      await logStep(executionId, "SNAPSHOT", adapter.systemName, "completed", { count });
    }
    await AuditLogger.appendLog({
      action: "SNAPSHOT_TAKEN",
      actor: "execution_engine",
      subject: actualIdentifier,
      details: { executionId },
    });
  } catch (err: any) {
    await logStep(executionId, "SNAPSHOT", "engine", "failed", { error: err.message });
    throw new Error(`Snapshot failed: ${err.message}`);
  }

  // Phase B: Mutate
  try {
    for (const adapter of adapters) {
      await logStep(executionId, "MUTATE", adapter.systemName, "started", { action: approval.action });
      await adapter.deleteRecords(actualIdentifier, approval.action);
      await logStep(executionId, "MUTATE", adapter.systemName, "completed");
    }

    await updateActionStatus(token, "executed", executionId);

    await AuditLogger.appendLog({
      action: "EXECUTION_COMPLETED",
      actor: "execution_engine",
      subject: actualIdentifier,
      details: { executionId, token },
    });

    return executionId;
  } catch (err: any) {
    // Phase C: Rollback (if partial failure)
    console.error("[execution] Mutation failed, initiating rollback...", err);
    await logStep(executionId, "MUTATE", "engine", "failed", { error: err.message });
    await rollbackAction(executionId, adapters);
    
    await AuditLogger.appendLog({
      action: "EXECUTION_FAILED",
      actor: "execution_engine",
      subject: actualIdentifier,
      details: { executionId, token, error: err.message },
    });

    throw new Error(`Execution failed and rolled back: ${err.message}`);
  }
}

export async function rollbackAction(executionId: string, customAdapters?: DataAdapter[]): Promise<void> {
  // Guard: check if this execution has already been rolled back
  const existing = await query<{ status: string }>(
    `SELECT status FROM approvals WHERE execution_id = $1`,
    [executionId]
  );

  if (existing.length > 0 && existing[0].status === "rolled_back") {
    throw new Error(`Execution ${executionId} has already been rolled back`);
  }

  // Execute rollback on all adapters
  const adapters = customAdapters ?? createAdapterRegistry();
  for (const adapter of adapters) {
    await logStep(executionId, "ROLLBACK", adapter.systemName, "started");
    await adapter.restoreRecords(executionId);
    await logStep(executionId, "ROLLBACK", adapter.systemName, "completed");
  }

  // Update approval status to rolled_back (covers both MCP tool path and dashboard path)
  if (existing.length > 0) {
    await query(
      `UPDATE approvals SET status = 'rolled_back' WHERE execution_id = $1`,
      [executionId]
    );
  }

  await AuditLogger.appendLog({
    action: "ROLLBACK_COMPLETED",
    actor: "execution_engine",
    subject: executionId,
    details: { executionId },
  });
}

