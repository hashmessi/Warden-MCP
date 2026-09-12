import type {
  DataAdapter,
  DataHit,
  DeleteMode,
  DeletionResult,
  SchemaInfo,
  SystemName,
} from "../adapters/types.js";

export type InterceptableMethod =
  | "findByIdentifier"
  | "deleteRecords"
  | "snapshotRecords"
  | "restoreRecords"
  | "getSchema"
  | "ping";

export interface FaultInjectionAdapter extends DataAdapter {
  failOn(method: InterceptableMethod, error?: Error): void;
  delay(method: InterceptableMethod, delayMs: number): void;
  reset(): void;
  getCallCount(method: InterceptableMethod): number;
}

export function createFaultProxy(target: DataAdapter): FaultInjectionAdapter {
  const failureRules = new Map<InterceptableMethod, Error>();
  const delayRules = new Map<InterceptableMethod, number>();
  const callCounters = new Map<InterceptableMethod, number>();

  function incrementCall(method: InterceptableMethod): void {
    callCounters.set(method, (callCounters.get(method) || 0) + 1);
  }

  async function checkInterception(method: InterceptableMethod): Promise<void> {
    incrementCall(method);

    const delayMs = delayRules.get(method);
    if (delayMs && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const err = failureRules.get(method);
    if (err) {
      throw err;
    }
  }

  const proxy: FaultInjectionAdapter = {
    get systemName(): SystemName {
      return target.systemName;
    },

    failOn(method: InterceptableMethod, error?: Error): void {
      failureRules.set(
        method,
        error || new Error(`[FaultInjection] Simulated failure on ${target.systemName}.${method}`)
      );
    },

    delay(method: InterceptableMethod, delayMs: number): void {
      delayRules.set(method, delayMs);
    },

    reset(): void {
      failureRules.clear();
      delayRules.clear();
      callCounters.clear();
    },

    getCallCount(method: InterceptableMethod): number {
      return callCounters.get(method) || 0;
    },

    async findByIdentifier(identifier: string): Promise<DataHit[]> {
      await checkInterception("findByIdentifier");
      return target.findByIdentifier(identifier);
    },

    async deleteRecords(identifier: string, mode: DeleteMode): Promise<DeletionResult[]> {
      await checkInterception("deleteRecords");
      return target.deleteRecords(identifier, mode);
    },

    async snapshotRecords(identifier: string, executionId: string): Promise<number> {
      await checkInterception("snapshotRecords");
      return target.snapshotRecords(identifier, executionId);
    },

    async restoreRecords(executionId: string): Promise<number> {
      await checkInterception("restoreRecords");
      return target.restoreRecords(executionId);
    },

    async getSchema(): Promise<SchemaInfo> {
      await checkInterception("getSchema");
      return target.getSchema();
    },

    async ping(): Promise<boolean> {
      await checkInterception("ping");
      return target.ping();
    },
  };

  return proxy;
}
