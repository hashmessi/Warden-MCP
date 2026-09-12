/**
 * Warden Evaluation Harness - Type Definitions
 * 
 * Formal type contracts for scenario execution, invariant assertions,
 * and empirical scorecard metrics.
 */

export type InvariantType =
  | "INV-01-AUTH-GATE"
  | "INV-02-IDEMPOTENCY"
  | "INV-03-REVERSIBILITY"
  | "INV-04-TAMPER-EVIDENCE";

export type ScenarioStatus = "PASSED" | "FAILED" | "CRITICAL_FAILURE";

export interface EvalCaseResult {
  id: string;
  name: string;
  scenario: string;
  status: ScenarioStatus;
  durationMs: number;
  invariantsChecked: InvariantType[];
  invariantsViolated: InvariantType[];
  error?: string;
  details?: Record<string, unknown>;
}

export interface ScorecardMetrics {
  totalCases: number;
  passed: number;
  failed: number;
  criticalFailures: number;
  rollbackSuccessRate: number; // percentage 0 - 100
  unauthorizedExecutions: number;
  duplicateExecutions: number;
  auditTamperDetected: boolean;
  latencyP50Ms: number;
  latencyP95Ms: number;
  timestamp: string;
}

export interface EvalScenario {
  id: string;
  name: string;
  description: string;
  run: () => Promise<EvalCaseResult[]>;
}

export interface ScenarioSubject {
  email: string;
  userId: string;
  name: string;
}
