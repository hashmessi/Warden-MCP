import { NextResponse } from "next/server";
import { listActions, createAction } from "../../lib/store";

export async function GET() {
  const actions = await listActions();
  return NextResponse.json(actions);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { scanId, action } = body;
    if (!scanId || !action) {
      return NextResponse.json({ error: "scanId and action are required" }, { status: 400 });
    }
    if (action !== "delete" && action !== "anonymize") {
      return NextResponse.json({ error: "action must be 'delete' or 'anonymize'" }, { status: 400 });
    }
    const pending = await createAction(scanId, action);
    return NextResponse.json(pending, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
