export type AuditAction = 
  | "SCAN" 
  | "APPROVAL_REQUESTED" 
  | "APPROVED" 
  | "DENIED" 
  | "EXECUTED" 
  | "ROLLED_BACK";

export interface AuditEntry {
  id: number;
  timestamp: Date;
  action: AuditAction;
  actor: string;
  subject_hash: string | null;
  details: Record<string, any>;
  prev_hash: string;
  hash: string;
}

export interface CreateAuditEntryParams {
  action: AuditAction;
  actor: string;
  subject: string | null;
  details: Record<string, any>;
}
