/**
 * Warden Data Adapter Interface
 * 
 * All data system adapters (Postgres, MongoDB, payment ledger) MUST implement
 * this interface. It is the backbone of Phase 3's multi-system scan fan-out.
 */

export type SensitivityTag = "pii" | "financial" | "behavioral" | "system";
export type SystemName = "postgres" | "mongodb" | "payment_ledger";
export type DeleteMode = "delete" | "anonymize";
export type RecordStatus = "active" | "pending" | "deleted" | "anonymized";

export interface FieldHit {
  fieldName: string;
  sensitivityTag: SensitivityTag;
  sample?: string; // redacted/truncated display value — never raw PII
}

export interface DataHit {
  sourceSystem: SystemName;
  table: string;           // table name (Postgres) or collection name (MongoDB)
  rowCount: number;
  fields: FieldHit[];
  sampleIds: string[];     // row IDs — used by Phase 6 snapshot engine
  hasOrphanRisk?: boolean; // true if deleting would orphan dependent records
  orphanDetails?: string;  // human-readable description of orphan risk
}

export interface ScanResult {
  scanId: string;          // UUID — stored and referenced by subsequent phases
  identifier: string;      // searched email or userId
  scannedAt: string;       // ISO8601
  hits: DataHit[];
  totalRecords: number;    // sum of rowCount across all hits
  systemsScanned: string[];
}

export interface DeletionResult {
  sourceSystem: SystemName;
  table: string;
  affected: number;
  mode: DeleteMode;
}

export interface SchemaInfo {
  tables: string[];
  recordCount: number;
}

export interface DataAdapter {
  readonly systemName: SystemName;

  /**
   * Find all records referencing the given identifier (email or userId).
   * MUST be read-only. MUST NOT mutate any data.
   */
  findByIdentifier(identifier: string): Promise<DataHit[]>;

  /**
   * Delete or anonymize all records for the given identifier.
   * Called ONLY by Phase 6 execution engine after human approval.
   */
  deleteRecords(
    identifier: string,
    mode: DeleteMode
  ): Promise<DeletionResult[]>;

  /**
   * Snapshot all records matching the identifier to the central snapshot store.
   * Returns the number of records snapshotted.
   */
  snapshotRecords(
    identifier: string,
    executionId: string
  ): Promise<number>;

  /**
   * Restore all records from the central snapshot store for a given executionId.
   * Returns the number of records restored.
   */
  restoreRecords(
    executionId: string
  ): Promise<number>;

  /**
   * Return schema info for display in impact report (Phase 4).
   */
  getSchema(): Promise<SchemaInfo>;

  /**
   * Health check — returns true if the system is reachable.
   */
  ping(): Promise<boolean>;
}
