import { randomUUID } from "crypto";
import { createAdapterRegistry } from "./adapters/index.js";
import type { ScanResult, DataHit } from "./adapters/types.js";
import { AuditLogger } from "./audit/logger.js";
import { query } from "./db/postgres.js";

// In-memory hot cache: scanId → ScanResult (primary lookup, DB is fallback)
const scanStore = new Map<string, ScanResult>();

/**
 * Fans out across all connected data adapters in parallel.
 * Partial adapter failures are logged to stderr and don't crash the scan.
 * Writes an audit log entry after completion.
 * Persists result to Postgres so server restarts don't lose mid-flow state.
 */
export async function scanSubject(identifier: string): Promise<ScanResult> {
  const scanId = randomUUID();
  const scannedAt = new Date().toISOString();
  const adapters = createAdapterRegistry();

  // Fan out in parallel — tolerate individual adapter failures
  const settled = await Promise.allSettled(
    adapters.map((a) => a.findByIdentifier(identifier))
  );

  const hits: DataHit[] = [];
  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    if (outcome.status === "fulfilled") {
      hits.push(...outcome.value);
    } else {
      console.error(
        `[scanner] Adapter error (${adapters[i].systemName}):`,
        outcome.reason
      );
    }
  }

  const totalRecords = hits.reduce((sum, h) => sum + h.rowCount, 0);
  const systemsScanned = [...new Set(hits.map((h) => h.sourceSystem))];

  const result: ScanResult = {
    scanId,
    identifier,
    scannedAt,
    hits,
    totalRecords,
    systemsScanned,
  };

  // Hot cache — immediate availability
  scanStore.set(scanId, result);

  // Persist to Postgres — survives server restarts
  try {
    await query(
      `INSERT INTO scans (scan_id, identifier, scanned_at, result) VALUES ($1, $2, $3, $4) ON CONFLICT (scan_id) DO NOTHING`,
      [scanId, identifier, scannedAt, JSON.stringify(result)]
    );
  } catch (dbErr) {
    console.error("[scanner] Failed to persist scan to DB:", dbErr);
  }

  // Audit trail — non-blocking; if this fails we still return the result
  try {
    await AuditLogger.appendLog({
      action: "SCAN",
      actor: "mcp-client",
      subject: identifier,
      details: { scanId, totalRecords, systemsScanned },
    });
  } catch (auditErr) {
    console.error("[scanner] Failed to write audit log entry:", auditErr);
  }

  return result;
}

/**
 * Retrieve a previous scan result by its scanId.
 * Checks in-memory hot cache first, falls back to Postgres DB.
 * Used by Phase 4 (impact report) and Phase 5 (approval gate).
 */
export async function getScanResult(scanId: string): Promise<ScanResult | undefined> {
  // 1. Hot cache hit
  if (scanStore.has(scanId)) {
    return scanStore.get(scanId);
  }

  // 2. DB fallback (server restart or cross-process lookup)
  try {
    const rows = await query<{ result: ScanResult }>(
      `SELECT result FROM scans WHERE scan_id = $1`,
      [scanId]
    );
    if (rows.length > 0) {
      const result = rows[0].result;
      // Repopulate cache
      scanStore.set(scanId, result);
      return result;
    }
  } catch (err) {
    console.error("[scanner] DB fallback lookup failed:", err);
  }

  return undefined;
}
