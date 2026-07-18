import { randomUUID } from "crypto";
import { createAdapterRegistry } from "./adapters/index.js";
import type { ScanResult, DataHit } from "./adapters/types.js";
import { AuditLogger } from "./audit/logger.js";

// In-memory store: scanId → ScanResult (Phase 4 reads from here)
const scanStore = new Map<string, ScanResult>();

/**
 * Fans out across all connected data adapters in parallel.
 * Partial adapter failures are logged to stderr and don't crash the scan.
 * Writes an audit log entry after completion.
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

  // Store for Phase 4 lookup
  scanStore.set(scanId, result);

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
 * Used by Phase 4 (impact report) and Phase 5 (approval gate).
 */
export function getScanResult(scanId: string): ScanResult | undefined {
  return scanStore.get(scanId);
}
