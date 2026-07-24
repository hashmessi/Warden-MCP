import { randomUUID } from "crypto";
import type { PendingAction, ExecutionAction, ApprovalStatus } from "./types.js";
import { AuditLogger } from "../audit/logger.js";
import { query } from "../db/postgres.js";

function mapRowToPendingAction(row: any): PendingAction {
  return {
    token: row.token,
    scanId: row.scan_id,
    action: row.action as ExecutionAction,
    status: row.status as ApprovalStatus,
    executionId: row.execution_id || undefined,
    impactReport: row.impact_report || undefined,
    requestedAt: new Date(row.requested_at).toISOString(),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : undefined,
    resolvedBy: row.resolved_by || undefined,
  };
}

/**
 * Creates a pending action with a unique approval token.
 * Writes APPROVAL_REQUESTED to the audit log.
 */
export async function createPendingAction(
  scanId: string,
  action: ExecutionAction,
  impactReport?: Record<string, any>
): Promise<PendingAction> {
  const token = randomUUID();
  const rows = await query(
    `INSERT INTO approvals (token, scan_id, action, impact_report) 
     VALUES ($1, $2, $3, $4) 
     RETURNING *`,
    [token, scanId, action, impactReport ? JSON.stringify(impactReport) : null]
  );
  
  const pending = mapRowToPendingAction(rows[0]);

  // Audit log — non-blocking
  try {
    await AuditLogger.appendLog({
      action: "APPROVAL_REQUESTED",
      actor: "mcp-client",
      subject: scanId,
      details: { token, action },
    });
  } catch (err) {
    console.error("[approval] Failed to write audit log:", err);
  }

  return pending;
}

/**
 * Transitions a pending action to "approved".
 */
export async function approveAction(token: string, actor = "dashboard-user"): Promise<PendingAction> {
  const pending = await getApprovalByToken(token);
  if (!pending) throw new Error(`Approval token not found: ${token}`);
  if (pending.status !== "pending") {
    throw new Error(`Already processed: token is ${pending.status}`);
  }

  const rows = await query(
    `UPDATE approvals 
     SET status = 'approved', resolved_at = NOW(), resolved_by = $1
     WHERE token = $2 AND status = 'pending'
     RETURNING *`,
    [actor, token]
  );

  if (rows.length === 0) {
    throw new Error(`Failed to approve: token may have been processed concurrently`);
  }

  return mapRowToPendingAction(rows[0]);
}

/**
 * Transitions a pending action to "denied".
 */
export async function denyAction(token: string, actor = "dashboard-user"): Promise<PendingAction> {
  const pending = await getApprovalByToken(token);
  if (!pending) throw new Error(`Approval token not found: ${token}`);
  if (pending.status !== "pending") {
    throw new Error(`Already processed: token is ${pending.status}`);
  }

  const rows = await query(
    `UPDATE approvals 
     SET status = 'denied', resolved_at = NOW(), resolved_by = $1
     WHERE token = $2 AND status = 'pending'
     RETURNING *`,
    [actor, token]
  );

  if (rows.length === 0) {
    throw new Error(`Failed to deny: token may have been processed concurrently`);
  }

  return mapRowToPendingAction(rows[0]);
}

/**
 * Transitions a pending action to "executed" or "rolled_back".
 */
export async function updateActionStatus(token: string, status: "executed" | "rolled_back", executionId?: string): Promise<PendingAction> {
  const params: any[] = [status, token];
  let queryStr = `UPDATE approvals SET status = $1 WHERE token = $2 RETURNING *`;
  
  if (executionId) {
    queryStr = `UPDATE approvals SET status = $1, execution_id = $3 WHERE token = $2 RETURNING *`;
    params.push(executionId);
  }

  const rows = await query(queryStr, params);
  if (rows.length === 0) throw new Error(`Token not found: ${token}`);
  return mapRowToPendingAction(rows[0]);
}


/**
 * Look up a pending action by its approval token.
 */
export async function getApprovalByToken(token: string): Promise<PendingAction | undefined> {
  const rows = await query(`SELECT * FROM approvals WHERE token = $1`, [token]);
  return rows.length > 0 ? mapRowToPendingAction(rows[0]) : undefined;
}

/**
 * Returns all actions in the store.
 */
export async function listPendingActions(): Promise<PendingAction[]> {
  const rows = await query(`SELECT * FROM approvals ORDER BY requested_at DESC`);
  return rows.map(mapRowToPendingAction);
}
