import type { SensitivityTag } from "../adapters/types.js";

export interface DataFoundSection {
  systems: string[];
  tables: Array<{
    system: string;
    table: string;
    rowCount: number;
    sensitivityTags: SensitivityTag[];
  }>;
  totalRecords: number;
}

export interface DependencyItem {
  system: string;
  table: string;
  rowCount: number;
  description: string;
}

export interface DependencySection {
  hasRisks: boolean;
  items: DependencyItem[];
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ImpactReport {
  reportId: string;
  scanId: string;
  generatedAt: string;
  subject: string;
  sections: {
    dataFound: DataFoundSection;
    dependencies: DependencySection;
    riskLevel: RiskLevel;
    recommendedAction: string;
  };
  narrative?: string;
}
