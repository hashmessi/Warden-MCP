import { PostgresAdapter } from "./postgres.adapter.js";
import { MongoDbAdapter } from "./mongodb.adapter.js";
import { PaymentLedgerAdapter } from "./payment.adapter.js";
import type { DataAdapter } from "./types.js";

export * from "./types.js";
export { PostgresAdapter } from "./postgres.adapter.js";
export { MongoDbAdapter } from "./mongodb.adapter.js";
export { PaymentLedgerAdapter, loadLedger, getLedger } from "./payment.adapter.js";

/**
 * Registry of all connected data adapters.
 * Phase 3 scan_subject iterates this array for fan-out queries.
 * Add new adapters here to extend Warden's reach.
 */
export function createAdapterRegistry(): DataAdapter[] {
  return [
    new PostgresAdapter(),
    new MongoDbAdapter(),
    new PaymentLedgerAdapter(),
  ];
}
