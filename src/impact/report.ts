import { randomUUID } from "crypto";
import type { ScanResult, DataHit } from "../adapters/types.js";
import type {
  ImpactReport,
  DataFoundSection,
  DependencySection,
  RiskLevel,
} from "./types.js";
import { enrichWithNarrative } from "./llm.js";
import { query } from "../db/postgres.js";

// In-memory hot cache: reportId → ImpactReport (primary lookup, DB is fallback)
const reportStore = new Map<string, ImpactReport>();

function computeRiskLevel(hits: DataHit[]): RiskLevel {
  // CRITICAL: any active orphan risk (e.g. linked subscriptions)
  if (hits.some((h) => h.hasOrphanRisk === true)) {
    return "CRITICAL";
  }

  const totalRecords = hits.reduce((sum, h) => sum + h.rowCount, 0);
  const hasFinancial = hits.some((h) =>
    h.fields.some((f) => f.sensitivityTag === "financial")
  );

  // HIGH: large volume or financial data
  if (totalRecords > 50 || hasFinancial) {
    return "HIGH";
  }

  // MEDIUM: PII across 2+ different source systems
  const systemsWithPii = new Set(
    hits
      .filter((h) => h.fields.some((f) => f.sensitivityTag === "pii"))
      .map((h) => h.sourceSystem)
  );
  if (systemsWithPii.size >= 2) {
    return "MEDIUM";
  }

  return "LOW";
}

function recommendedActionFor(risk: RiskLevel): string {
  switch (risk) {
    case "CRITICAL":
      return "Review downstream dependencies before proceeding. Active subscriptions or billing records may be orphaned. Consider anonymization instead of deletion.";
    case "HIGH":
      return "Proceed with caution. Large volume or financial data detected. Ensure all backups are current.";
    case "MEDIUM":
      return "Standard data deletion. PII present across multiple systems — verify all systems are included in scope.";
    case "LOW":
      return "Safe to proceed with deletion. Minimal data footprint detected.";
  }
}

/**
 * Generates a structured ImpactReport from a ScanResult.
 * Deterministic template always works. LLM narrative is optional.
 * Persists to Postgres so server restarts don't lose mid-flow state.
 */
export async function generateImpactReport(
  scanResult: ScanResult
): Promise<ImpactReport> {
  const reportId = randomUUID();

  // Build dataFound section
  const dataFound: DataFoundSection = {
    systems: scanResult.systemsScanned,
    tables: scanResult.hits.map((h) => ({
      system: h.sourceSystem,
      table: h.table,
      rowCount: h.rowCount,
      sensitivityTags: [...new Set(h.fields.map((f) => f.sensitivityTag))],
    })),
    totalRecords: scanResult.totalRecords,
  };

  // Build dependencies section
  const riskyHits = scanResult.hits.filter((h) => h.hasOrphanRisk === true);
  const dependencies: DependencySection = {
    hasRisks: riskyHits.length > 0,
    items: riskyHits.map((h) => ({
      system: h.sourceSystem,
      table: h.table,
      rowCount: h.rowCount,
      description: h.orphanDetails ?? `Records in ${h.table} reference this subject`,
    })),
  };

  const riskLevel = computeRiskLevel(scanResult.hits);
  const recommendedAction = recommendedActionFor(riskLevel);

  const report: ImpactReport = {
    reportId,
    scanId: scanResult.scanId,
    generatedAt: new Date().toISOString(),
    subject: scanResult.identifier,
    sections: {
      dataFound,
      dependencies,
      riskLevel,
      recommendedAction,
    },
  };

  // Optional LLM narrative — graceful fallback if unavailable
  const enrichedReport = await enrichWithNarrative(report);

  // Hot cache — immediate availability
  reportStore.set(reportId, enrichedReport);

  // Persist to Postgres — survives server restarts
  try {
    await query(
      `INSERT INTO impact_reports (report_id, scan_id, generated_at, report)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (report_id) DO NOTHING`,
      [reportId, scanResult.scanId, enrichedReport.generatedAt, JSON.stringify(enrichedReport)]
    );
  } catch (dbErr) {
    console.error("[impact] Failed to persist report to DB:", dbErr);
  }

  return enrichedReport;
}

/**
 * Retrieve a previously generated report by its reportId.
 * Checks in-memory hot cache first, falls back to Postgres DB.
 * Used by Phase 5 (approval gate) and Phase 6 (execution).
 */
export async function getImpactReport(reportId: string): Promise<ImpactReport | undefined> {
  // 1. Hot cache hit
  if (reportStore.has(reportId)) {
    return reportStore.get(reportId);
  }

  // 2. DB fallback (server restart or cross-process lookup)
  try {
    const rows = await query<{ report: ImpactReport }>(
      `SELECT report FROM impact_reports WHERE report_id = $1`,
      [reportId]
    );
    if (rows.length > 0) {
      const report = rows[0].report;
      reportStore.set(reportId, report);
      return report;
    }
  } catch (err) {
    console.error("[impact] DB fallback lookup failed:", err);
  }

  return undefined;
}
