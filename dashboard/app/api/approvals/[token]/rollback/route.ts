import { NextResponse } from "next/server";
import { getAction, updateActionStatus } from "../../../../lib/store";
import { requireDashboardSecret } from "../../../../lib/auth";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const authError = requireDashboardSecret(req);
  if (authError) return authError;

  const { token } = await params;
  try {
    const action = await getAction(token);
    if (!action) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }
    if (action.status !== "executed") {
      return NextResponse.json({ error: "Only executed actions can be rolled back" }, { status: 400 });
    }

    if (!action.executionId) {
      return NextResponse.json({ error: "No execution ID found for this action" }, { status: 400 });
    }

    const { stdout, stderr } = await execAsync(`npx tsx src/scripts/rollback.ts ${action.executionId}`, {
      cwd: process.cwd().replace(/dashboard$/, ""), // Run in project root
    });
    
    if (stderr && stderr.includes("failed")) {
      return NextResponse.json({ error: "Rollback failed", details: stderr }, { status: 500 });
    }

    // Note: rollbackAction() in the engine also updates status to rolled_back,
    // but we update here too for the dashboard path as a safety net.
    await updateActionStatus(token, "rolled_back");

    return NextResponse.json({ message: "Rollback completed", stdout });
  } catch (err) {
    const message = (err as Error).message;
    // Surface "already rolled back" as a 409
    const status = message.includes("already been rolled back") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
