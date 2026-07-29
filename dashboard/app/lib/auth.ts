import { NextResponse } from "next/server";

/**
 * Verifies the X-Dashboard-Secret header against the DASHBOARD_SECRET env var.
 * Returns a 401 NextResponse if auth fails, or null if auth passes.
 *
 * Usage:
 *   const authError = requireDashboardSecret(req);
 *   if (authError) return authError;
 */
export function requireDashboardSecret(req: Request): NextResponse | null {
  const secret = process.env.DASHBOARD_SECRET;

  // If DASHBOARD_SECRET is not configured, skip auth (dev mode / no-config fallback)
  if (!secret) {
    console.warn("[auth] DASHBOARD_SECRET not set — skipping auth (set it in production)");
    return null;
  }

  const provided = req.headers.get("x-dashboard-secret");
  if (!provided || provided !== secret) {
    return NextResponse.json(
      { error: "Unauthorized: missing or invalid X-Dashboard-Secret header" },
      { status: 401 }
    );
  }

  return null;
}
