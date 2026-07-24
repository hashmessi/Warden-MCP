import * as fs from "fs";
import * as path from "path";
import type {
  DataAdapter,
  DataHit,
  DeletionResult,
  SchemaInfo,
  SystemName,
} from "./types.js";
import { query } from "../db/postgres.js";

export interface PaymentRecord {
  id: string;
  userId: string;
  email: string;
  amount: number;
  currency: string;
  status: "paid" | "refunded" | "pending";
  description: string;
  createdAt: string;
  subscriptionId?: string;
}

const LEDGER_PATH = path.resolve(process.cwd(), "src", "db", "ledger.json");

// In-memory store backed by disk persistence
let ledger: PaymentRecord[] | null = null;

function saveLedgerToDisk(records: PaymentRecord[]): void {
  try {
    const dir = path.dirname(LEDGER_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(records, null, 2), "utf-8");
  } catch (err) {
    console.error("[payment_ledger] Failed to save ledger to disk:", err);
  }
}

function ensureLedgerLoaded(): PaymentRecord[] {
  if (ledger !== null) return ledger;
  try {
    if (fs.existsSync(LEDGER_PATH)) {
      const content = fs.readFileSync(LEDGER_PATH, "utf-8");
      ledger = JSON.parse(content);
      return ledger!;
    }
  } catch (err) {
    console.error("[payment_ledger] Failed to load ledger from disk:", err);
  }
  ledger = [];
  return ledger;
}

export function loadLedger(records: PaymentRecord[]): void {
  ledger = [...records];
  saveLedgerToDisk(ledger);
}

export function getLedger(): PaymentRecord[] {
  return ensureLedgerLoaded();
}

export class PaymentLedgerAdapter implements DataAdapter {
  readonly systemName: SystemName = "payment_ledger";

  async findByIdentifier(identifier: string): Promise<DataHit[]> {
    const records = ensureLedgerLoaded();
    const matches = records.filter(
      (r) => r.email === identifier || r.userId === identifier
    );

    if (matches.length === 0) return [];

    const hasActiveSubscription = matches.some(
      (r) => r.status === "paid" && r.subscriptionId
    );

    return [
      {
        sourceSystem: "payment_ledger",
        table: "payment_records",
        rowCount: matches.length,
        fields: [
          { fieldName: "email", sensitivityTag: "pii" },
          { fieldName: "amount", sensitivityTag: "financial" },
          { fieldName: "status", sensitivityTag: "financial" },
        ],
        sampleIds: matches.map((r) => r.id),
        hasOrphanRisk: hasActiveSubscription,
        orphanDetails: hasActiveSubscription
          ? `${matches.filter((r) => r.subscriptionId).length} payment record(s) linked to active subscriptions`
          : undefined,
      },
    ];
  }

  async snapshotRecords(
    identifier: string,
    executionId: string
  ): Promise<number> {
    const records = ensureLedgerLoaded();
    const hits = records.filter(
      (r) => r.email === identifier || r.userId === identifier
    );
    let count = 0;
    for (const record of hits) {
      await query(
        `INSERT INTO snapshots (execution_id, source_system, record_id, data) VALUES ($1, $2, $3, $4)`,
        [executionId, 'payment_ledger', record.id, JSON.stringify(record)]
      );
      count++;
    }
    return count;
  }

  async restoreRecords(executionId: string): Promise<number> {
    const records = ensureLedgerLoaded();
    const snapshots = await query<{ record_id: string; data: any }>(
      `SELECT record_id, data FROM snapshots WHERE execution_id = $1 AND source_system = 'payment_ledger'`,
      [executionId]
    );

    let count = 0;
    for (const snap of snapshots) {
      const data = typeof snap.data === "string" ? JSON.parse(snap.data) : snap.data;
      const index = records.findIndex((r) => r.id === data.id);
      if (index >= 0) {
        records[index] = data;
      } else {
        records.push(data);
      }
      count++;
    }
    saveLedgerToDisk(records);
    return count;
  }

  async deleteRecords(
    identifier: string,
    mode: "delete" | "anonymize"
  ): Promise<DeletionResult[]> {
    let records = ensureLedgerLoaded();
    const before = records.length;

    if (mode === "delete") {
      records = records.filter(
        (r) => r.email !== identifier && r.userId !== identifier
      );
    } else {
      records = records.map((r) => {
        if (r.email === identifier || r.userId === identifier) {
          return {
            ...r,
            email: "anonymized@deleted.invalid",
            userId: "anonymized",
          };
        }
        return r;
      });
    }

    ledger = records;
    saveLedgerToDisk(records);

    const affected =
      mode === "delete"
        ? before - records.length
        : records.filter((r) => r.email === "anonymized@deleted.invalid").length;

    return [
      {
        sourceSystem: "payment_ledger",
        table: "payment_records",
        affected,
        mode,
      },
    ];
  }

  async getSchema(): Promise<SchemaInfo> {
    const records = ensureLedgerLoaded();
    return {
      tables: ["payment_records"],
      recordCount: records.length,
    };
  }

  async ping(): Promise<boolean> {
    return true;
  }
}
