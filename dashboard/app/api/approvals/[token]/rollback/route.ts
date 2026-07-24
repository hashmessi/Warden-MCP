import { NextResponse } from "next/server";
import { resolveAction, getAction, updateActionStatus } from "../../../../lib/store";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
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

    await updateActionStatus(token, "rolled_back");

    return NextResponse.json({ message: "Rollback completed", stdout });
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
