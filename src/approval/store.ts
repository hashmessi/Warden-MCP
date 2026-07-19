import { randomUUID } from "crypto";
import type { PendingAction, ExecutionAction } from "./types.js";
import { AuditLogger } from "../audit/logger.js";

// In-memory approval store: token → PendingAction
// Phase 6 reads from here to execute approved actions
const approvalStore = new Map<string, PendingAction>();

/**
 * Creates a pending action with a unique approval token.
 * Does NOT execute any mutation — the gate stays shut.
 * Writes APPROVAL_REQUESTED to the audit log.
 */
export async function createPendingAction(
  scanId: string,
  action: ExecutionAction
): Promise<PendingAction> {
  const token = randomUUID();
  const pending: PendingAction = {
    token,
    scanId,
    action,
    status: "pending",
    requestedAt: new Date().toISOString(),
  };
  approvalStore.set(token, pending);

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
 * Throws if already processed (idempotent single-use enforcement).
 */
export function approveAction(token: string, actor = "dashboard-user"): PendingAction {
  const pending = approvalStore.get(token);
  if (!pending) throw new Error(`Approval token not found: ${token}`);
  if (pending.status !== "pending") {
    throw new Error(`Already processed: token is ${pending.status}`);
  }
  const updated: PendingAction = {
    ...pending,
    status: "approved",
    resolvedAt: new Date().toISOString(),
    resolvedBy: actor,
  };
  approvalStore.set(token, updated);
  return updated;
}

/**
 * Transitions a pending action to "denied".
 * Throws if already processed.
 */
export function denyAction(token: string, actor = "dashboard-user"): PendingAction {
  const pending = approvalStore.get(token);
  if (!pending) throw new Error(`Approval token not found: ${token}`);
  if (pending.status !== "pending") {
    throw new Error(`Already processed: token is ${pending.status}`);
  }
  const updated: PendingAction = {
    ...pending,
    status: "denied",
    resolvedAt: new Date().toISOString(),
    resolvedBy: actor,
  };
  approvalStore.set(token, updated);
  return updated;
}

/**
 * Look up a pending action by its approval token.
 * Used by Phase 6 execution engine and dashboard API routes.
 */
export function getApprovalByToken(token: string): PendingAction | undefined {
  return approvalStore.get(token);
}

/**
 * Returns all actions in the store (any status).
 * Used by the dashboard to display the full list.
 */
export function listPendingActions(): PendingAction[] {
  return [...approvalStore.values()].sort(
    (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
  );
}
