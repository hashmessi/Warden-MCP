import { Pool } from "pg";
import type { PendingAction, ApprovalStatus, ExecutionAction } from "../types";
import { randomUUID } from "crypto";

// We instantiate a pool here for Next.js API routes.
// Note: In development, Next.js clears the module cache often, which can lead to connection leaks.
// We handle this with a global singleton check.
const globalForPg = global as unknown as { pgPool: Pool };

export const pool =
  globalForPg.pgPool ||
  new Pool({
    connectionString: process.env.POSTGRES_URL || "postgresql://warden:warden_dev@localhost:5432/warden_db",
    max: 10,
  });

if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;

function mapRowToPendingAction(row: any): PendingAction {
  return {
    token: row.token,
    scanId: row.scan_id,
    action: row.action as ExecutionAction,
    status: row.status as ApprovalStatus,
    executionId: row.execution_id || undefined,
    requestedAt: new Date(row.requested_at).toISOString(),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : undefined,
    resolvedBy: row.resolved_by || undefined,
  };
}

export async function listActions(): Promise<PendingAction[]> {
  const result = await pool.query(`SELECT * FROM approvals ORDER BY requested_at DESC`);
  return result.rows.map(mapRowToPendingAction);
}

export async function getAction(token: string): Promise<PendingAction | undefined> {
  const result = await pool.query(`SELECT * FROM approvals WHERE token = $1`, [token]);
  return result.rows.length > 0 ? mapRowToPendingAction(result.rows[0]) : undefined;
}

export async function createAction(scanId: string, action: ExecutionAction): Promise<PendingAction> {
  const token = randomUUID();
  const result = await pool.query(
    `INSERT INTO approvals (token, scan_id, action) VALUES ($1, $2, $3) RETURNING *`,
    [token, scanId, action]
  );
  return mapRowToPendingAction(result.rows[0]);
}

export async function resolveAction(token: string, resolution: "approved" | "denied"): Promise<PendingAction> {
  const action = await getAction(token);
  if (!action) throw new Error(`Token not found: ${token}`);
  if (action.status !== "pending") throw new Error(`Already processed: ${action.status}`);

  const result = await pool.query(
    `UPDATE approvals SET status = $1, resolved_at = NOW(), resolved_by = 'dashboard-user' 
     WHERE token = $2 AND status = 'pending' RETURNING *`,
    [resolution, token]
  );

  if (result.rows.length === 0) {
    throw new Error(`Failed to update: token may have been processed concurrently`);
  }
  return mapRowToPendingAction(result.rows[0]);
}

export async function updateActionStatus(token: string, status: "executed" | "rolled_back"): Promise<PendingAction> {
  const result = await pool.query(
    `UPDATE approvals SET status = $1 WHERE token = $2 RETURNING *`,
    [status, token]
  );
  if (result.rows.length === 0) throw new Error(`Token not found: ${token}`);
  return mapRowToPendingAction(result.rows[0]);
}
