import { NextResponse } from "next/server";
import { Pool } from "pg";

export async function GET() {
  const checks: Record<string, string> = {};
  let healthy = true;

  // Postgres check
  try {
    const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
    await pool.query("SELECT 1");
    await pool.end();
    checks.postgres = "connected";
  } catch (err) {
    checks.postgres = `error: ${(err as Error).message}`;
    healthy = false;
  }

  const body = {
    status: healthy ? "ok" : "degraded",
    service: "warden-dashboard",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    checks,
  };

  return NextResponse.json(body, { status: healthy ? 200 : 503 });
}
