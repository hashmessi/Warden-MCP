import { getMongoDb } from "../db/mongodb.js";
import type {
  DataAdapter,
  DataHit,
  DeletionResult,
  SchemaInfo,
  SystemName,
} from "./types.js";

export class MongoDbAdapter implements DataAdapter {
  readonly systemName: SystemName = "mongodb";

  async findByIdentifier(identifier: string): Promise<DataHit[]> {
    const db = await getMongoDb();
    const hits: DataHit[] = [];

    // 1. Search sessions collection
    const sessions = await db
      .collection("sessions")
      .find({ $or: [{ email: identifier }, { userId: identifier }] })
      .project({ _id: 1 })
      .toArray();

    if (sessions.length > 0) {
      hits.push({
        sourceSystem: "mongodb",
        table: "sessions",
        rowCount: sessions.length,
        fields: [
          { fieldName: "email", sensitivityTag: "pii" },
          { fieldName: "sessionToken", sensitivityTag: "system" },
          { fieldName: "ipAddress", sensitivityTag: "behavioral" },
        ],
        sampleIds: sessions.map((s) => s._id.toString()),
      });
    }

    // 2. Search activity_logs collection
    const activityLogs = await db
      .collection("activity_logs")
      .find({ $or: [{ email: identifier }, { userId: identifier }] })
      .project({ _id: 1 })
      .toArray();

    if (activityLogs.length > 0) {
      hits.push({
        sourceSystem: "mongodb",
        table: "activity_logs",
        rowCount: activityLogs.length,
        fields: [
          { fieldName: "event", sensitivityTag: "behavioral" },
          { fieldName: "payload", sensitivityTag: "behavioral" },
        ],
        sampleIds: activityLogs.map((l) => l._id.toString()),
      });
    }

    return hits;
  }

  async deleteRecords(
    identifier: string,
    mode: "delete" | "anonymize"
  ): Promise<DeletionResult[]> {
    const db = await getMongoDb();
    const results: DeletionResult[] = [];
    const filter = { $or: [{ email: identifier }, { userId: identifier }] };

    if (mode === "delete") {
      const sessResult = await db.collection("sessions").deleteMany(filter);
      results.push({
        sourceSystem: "mongodb",
        table: "sessions",
        affected: sessResult.deletedCount,
        mode: "delete",
      });

      const logResult = await db.collection("activity_logs").deleteMany(filter);
      results.push({
        sourceSystem: "mongodb",
        table: "activity_logs",
        affected: logResult.deletedCount,
        mode: "delete",
      });
    } else {
      const anonymized = {
        $set: { email: "anonymized@deleted.invalid", userId: "anonymized" },
      };
      const sessResult = await db.collection("sessions").updateMany(filter, anonymized);
      results.push({
        sourceSystem: "mongodb",
        table: "sessions",
        affected: sessResult.modifiedCount,
        mode: "anonymize",
      });

      const logResult = await db.collection("activity_logs").updateMany(filter, anonymized);
      results.push({
        sourceSystem: "mongodb",
        table: "activity_logs",
        affected: logResult.modifiedCount,
        mode: "anonymize",
      });
    }

    return results;
  }

  async getSchema(): Promise<SchemaInfo> {
    const db = await getMongoDb();
    const collections = await db.listCollections().toArray();
    const sessionCount = await db.collection("sessions").countDocuments();
    return {
      tables: collections.map((c) => c.name),
      recordCount: sessionCount,
    };
  }

  async ping(): Promise<boolean> {
    try {
      const db = await getMongoDb();
      await db.command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }
}
