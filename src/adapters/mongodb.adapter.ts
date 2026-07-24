import { ObjectId } from "mongodb";
import { getMongoDb } from "../db/mongodb.js";
import { query } from "../db/postgres.js";
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

  async snapshotRecords(
    identifier: string,
    executionId: string
  ): Promise<number> {
    const db = await getMongoDb();
    const filter = { $or: [{ email: identifier }, { userId: identifier }] };

    const sessions = await db.collection("sessions").find(filter).toArray();
    const activityLogs = await db.collection("activity_logs").find(filter).toArray();

    let count = 0;
    for (const session of sessions) {
      await query(
        `INSERT INTO snapshots (execution_id, source_system, record_id, data) VALUES ($1, $2, $3, $4)`,
        [executionId, 'mongodb:sessions', session._id.toString(), JSON.stringify(session)]
      );
      count++;
    }

    for (const log of activityLogs) {
      await query(
        `INSERT INTO snapshots (execution_id, source_system, record_id, data) VALUES ($1, $2, $3, $4)`,
        [executionId, 'mongodb:activity_logs', log._id.toString(), JSON.stringify(log)]
      );
      count++;
    }

    return count;
  }

  async restoreRecords(executionId: string): Promise<number> {
    const db = await getMongoDb();
    const snapshots = await query<{ record_id: string; data: any; source_system: string }>(
      `SELECT record_id, data, source_system FROM snapshots WHERE execution_id = $1 AND source_system LIKE 'mongodb:%'`,
      [executionId]
    );

    let count = 0;
    for (const snap of snapshots) {
      const collection = snap.source_system.split(':')[1];
      const data = typeof snap.data === 'string' ? JSON.parse(snap.data) : snap.data;
      if (data._id && typeof data._id === 'string' && ObjectId.isValid(data._id)) {
        data._id = new ObjectId(data._id);
      }
      try {
        await db.collection(collection).replaceOne({ _id: data._id }, data, { upsert: true });
        count++;
      } catch (err) {
        console.error(`[mongodb] Failed to restore to ${collection}:`, err);
      }
    }
    return count;
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
