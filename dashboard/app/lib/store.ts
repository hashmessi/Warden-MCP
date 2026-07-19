/**
 * Shared approval store for the dashboard API routes.
 * This is a module-level singleton — Next.js API routes share the same Node.js process.
 *
 * In production, this would be replaced with a Postgres table.
 * For the demo, it's an in-memory Map that lives as long as the Next.js server runs.
 *
 * NOTE: The MCP server and dashboard are separate processes.
 * The MCP server has its own in-memory store.
 * The dashboard has its own in-memory store.
 * They are connected via the dashboard API being called directly from the browser.
 * To connect them: in a real deployment, use a shared DB. For the demo:
 * the dashboard's /api/approvals/seed endpoint can be called to add test data.
 */
import type { PendingAction, ApprovalStatus, ExecutionAction } from "../types";
import { randomUUID } from "crypto";

const store = new Map<string, PendingAction>();

// Seed with demo data so the dashboard is immediately usable
function seedDemoData() {
  if (store.size > 0) return;

  const demoActions: PendingAction[] = [
    {
      token: "demo-token-001",
      scanId: "demo-scan-001",
      action: "delete",
      status: "pending",
      requestedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
    {
      token: "demo-token-002",
      scanId: "demo-scan-002",
      action: "anonymize",
      status: "approved",
      requestedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      resolvedAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
      resolvedBy: "dashboard-user",
    },
    {
      token: "demo-token-003",
      scanId: "demo-scan-003",
      action: "delete",
      status: "denied",
      requestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      resolvedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
      resolvedBy: "dashboard-user",
    },
  ];

  for (const action of demoActions) {
    store.set(action.token, action);
  }
}

seedDemoData();

export function listActions(): PendingAction[] {
  return [...store.values()].sort(
    (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
  );
}

export function getAction(token: string): PendingAction | undefined {
  return store.get(token);
}

export function createAction(scanId: string, action: ExecutionAction): PendingAction {
  const token = randomUUID();
  const pending: PendingAction = {
    token,
    scanId,
    action,
    status: "pending",
    requestedAt: new Date().toISOString(),
  };
  store.set(token, pending);
  return pending;
}

export function resolveAction(token: string, resolution: "approved" | "denied"): PendingAction {
  const action = store.get(token);
  if (!action) throw new Error(`Token not found: ${token}`);
  if (action.status !== "pending") throw new Error(`Already processed: ${action.status}`);
  const updated: PendingAction = {
    ...action,
    status: resolution,
    resolvedAt: new Date().toISOString(),
    resolvedBy: "dashboard-user",
  };
  store.set(token, updated);
  return updated;
}
