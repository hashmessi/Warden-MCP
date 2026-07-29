import { NextResponse } from "next/server";
import { resolveAction } from "../../../../lib/store";
import { requireDashboardSecret } from "../../../../lib/auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const authError = requireDashboardSecret(req);
  if (authError) return authError;

  const { token } = await params;
  try {
    const updated = await resolveAction(token, "denied");
    return NextResponse.json(updated);
  } catch (err) {
    const message = (err as Error).message;
    const status = message.includes("not found") ? 404 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}
