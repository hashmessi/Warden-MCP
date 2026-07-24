import { NextResponse } from "next/server";
import { resolveAction } from "../../../../lib/store";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const updated = await resolveAction(token, "approved");
    return NextResponse.json(updated);
  } catch (err) {
    const message = (err as Error).message;
    const status = message.includes("not found") ? 404 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}
