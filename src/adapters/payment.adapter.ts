import type {
  DataAdapter,
  DataHit,
  DeletionResult,
  SchemaInfo,
  SystemName,
} from "./types.js";

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

// In-memory store — loaded by seed script
let ledger: PaymentRecord[] = [];

export function loadLedger(records: PaymentRecord[]): void {
  ledger = [...records];
}

export function getLedger(): PaymentRecord[] {
  return ledger;
}

export class PaymentLedgerAdapter implements DataAdapter {
  readonly systemName: SystemName = "payment_ledger";

  async findByIdentifier(identifier: string): Promise<DataHit[]> {
    const matches = ledger.filter(
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

  async deleteRecords(
    identifier: string,
    mode: "delete" | "anonymize"
  ): Promise<DeletionResult[]> {
    const before = ledger.length;

    if (mode === "delete") {
      ledger = ledger.filter(
        (r) => r.email !== identifier && r.userId !== identifier
      );
    } else {
      ledger = ledger.map((r) => {
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

    const affected =
      mode === "delete"
        ? before - ledger.length
        : ledger.filter((r) => r.email === "anonymized@deleted.invalid").length;

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
    return {
      tables: ["payment_records"],
      recordCount: ledger.length,
    };
  }

  async ping(): Promise<boolean> {
    return true; // In-memory store is always available
  }
}
