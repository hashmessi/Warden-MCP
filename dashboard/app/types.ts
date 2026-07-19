// Shared types — mirrors src/approval/types.ts
// Dashboard cannot import from src/ directly (separate Next.js app)

export type ApprovalStatus = "pending" | "approved" | "denied";
export type ExecutionAction = "delete" | "anonymize";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface PendingAction {
  token: string;
  scanId: string;
  reportId?: string;
  action: ExecutionAction;
  status: ApprovalStatus;
  requestedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface DependencyItem {
  system: string;
  table: string;
  rowCount: number;
  description: string;
}

export interface ScanHit {
  sourceSystem: string;
  table: string;
  rowCount: number;
  sensitivityTags: string[];
}

export interface ImpactReportSummary {
  reportId: string;
  scanId: string;
  subject: string;
  sections: {
    dataFound: { systems: string[]; tables: ScanHit[]; totalRecords: number };
    dependencies: { hasRisks: boolean; items: DependencyItem[] };
    riskLevel: RiskLevel;
    recommendedAction: string;
  };
  narrative?: string;
}
