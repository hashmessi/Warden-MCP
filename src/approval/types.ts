export type ApprovalStatus = "pending" | "approved" | "denied";
export type ExecutionAction = "delete" | "anonymize";

export interface PendingAction {
  token: string;           // crypto.randomUUID() — unique approval token
  scanId: string;          // links to ScanResult in scanner.ts scanStore
  reportId?: string;       // links to ImpactReport if generated
  action: ExecutionAction; // what will be done if approved
  status: ApprovalStatus;
  requestedAt: string;     // ISO8601
  resolvedAt?: string;     // ISO8601 when approved or denied
  resolvedBy?: string;     // actor string
}
