import { Pool, PoolClient } from "pg";
import { config } from "../config.js";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.postgres.connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 2_000,
    });

    pool.on("error", (err) => {
      console.error("[postgres] Unexpected pool error:", err);
    });
  }
  return pool;
}

export async function initDb(): Promise<void> {
  await withClient(async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS approvals (
        token UUID PRIMARY KEY,
        scan_id VARCHAR(255) NOT NULL,
        action VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        impact_report JSONB,
        execution_id UUID,
        requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        resolved_by VARCHAR(255)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS snapshots (
        id BIGSERIAL PRIMARY KEY,
        execution_id UUID NOT NULL,
        source_system VARCHAR(50) NOT NULL,
        record_id VARCHAR(255) NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS execution_steps (
        id BIGSERIAL PRIMARY KEY,
        execution_id UUID NOT NULL,
        step_name VARCHAR(100) NOT NULL,
        system VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        details JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id BIGSERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        action VARCHAR(100) NOT NULL,
        actor VARCHAR(255) NOT NULL,
        subject_hash VARCHAR(64),
        details JSONB,
        prev_hash VARCHAR(64),
        hash VARCHAR(64) NOT NULL
      )
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_log_hash ON audit_log(hash);
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_log_prev_hash ON audit_log(prev_hash) WHERE prev_hash != 'GENESIS';
    `);
  });
}

export async function query<T = unknown>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await getPool().query(sql, params);
  return result.rows as T[];
}

export async function withClient<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
