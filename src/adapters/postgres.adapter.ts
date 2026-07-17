import { query } from "../db/postgres.js";
import type {
  DataAdapter,
  DataHit,
  DeletionResult,
  SchemaInfo,
  SystemName,
} from "./types.js";

export class PostgresAdapter implements DataAdapter {
  readonly systemName: SystemName = "postgres";

  async findByIdentifier(identifier: string): Promise<DataHit[]> {
    const hits: DataHit[] = [];

    // 1. Search users table
    const users = await query<{ id: string; email: string; name: string }>(
      `SELECT id, email, name FROM users WHERE email = $1 AND is_deleted = FALSE`,
      [identifier]
    );
    if (users.length > 0) {
      hits.push({
        sourceSystem: "postgres",
        table: "users",
        rowCount: users.length,
        fields: [
          { fieldName: "email", sensitivityTag: "pii" },
          { fieldName: "name", sensitivityTag: "pii" },
        ],
        sampleIds: users.map((u) => u.id),
      });
    }

    // 2. Search user_profiles
    const profiles = await query<{ id: string }>(
      `SELECT up.id FROM user_profiles up
       INNER JOIN users u ON u.id = up.user_id
       WHERE u.email = $1`,
      [identifier]
    );
    if (profiles.length > 0) {
      hits.push({
        sourceSystem: "postgres",
        table: "user_profiles",
        rowCount: profiles.length,
        fields: [
          { fieldName: "date_of_birth", sensitivityTag: "pii" },
          { fieldName: "phone", sensitivityTag: "pii" },
          { fieldName: "address", sensitivityTag: "pii" },
        ],
        sampleIds: profiles.map((p) => p.id),
      });
    }

    // 3. Search subscriptions (with orphan risk detection)
    const subs = await query<{ id: string; status: string; plan: string }>(
      `SELECT s.id, s.status, s.plan FROM subscriptions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE u.email = $1 AND s.status = 'active'`,
      [identifier]
    );
    if (subs.length > 0) {
      hits.push({
        sourceSystem: "postgres",
        table: "subscriptions",
        rowCount: subs.length,
        fields: [
          { fieldName: "plan", sensitivityTag: "financial" },
          { fieldName: "status", sensitivityTag: "system" },
        ],
        sampleIds: subs.map((s) => s.id),
        hasOrphanRisk: true,
        orphanDetails: `${subs.length} active subscription(s) reference this user — deleting will orphan billing records`,
      });
    }

    // 4. Search user_activity
    const activity = await query<{ id: string }>(
      `SELECT ua.id FROM user_activity ua
       INNER JOIN users u ON u.id = ua.user_id
       WHERE u.email = $1`,
      [identifier]
    );
    if (activity.length > 0) {
      hits.push({
        sourceSystem: "postgres",
        table: "user_activity",
        rowCount: activity.length,
        fields: [
          { fieldName: "action", sensitivityTag: "behavioral" },
          { fieldName: "metadata", sensitivityTag: "behavioral" },
        ],
        sampleIds: activity.map((a) => a.id),
      });
    }

    return hits;
  }

  async deleteRecords(
    identifier: string,
    mode: "delete" | "anonymize"
  ): Promise<DeletionResult[]> {
    const results: DeletionResult[] = [];

    if (mode === "delete") {
      // Soft delete — set is_deleted flag
      const r = await query<{ id: string }>(
        `UPDATE users SET is_deleted = TRUE WHERE email = $1 RETURNING id`,
        [identifier]
      );
      results.push({
        sourceSystem: "postgres",
        table: "users",
        affected: r.length,
        mode: "delete",
      });
    } else {
      // Anonymize PII fields
      const r = await query<{ id: string }>(
        `UPDATE users 
         SET email = 'anonymized-' || id || '@deleted.invalid',
             name = 'Anonymized User'
         WHERE email = $1
         RETURNING id`,
        [identifier]
      );
      results.push({
        sourceSystem: "postgres",
        table: "users",
        affected: r.length,
        mode: "anonymize",
      });
    }

    return results;
  }

  async getSchema(): Promise<SchemaInfo> {
    const tables = await query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM users`
    );
    return {
      tables: tables.map((t) => t.tablename),
      recordCount: parseInt(countResult[0]?.count ?? "0", 10),
    };
  }

  async ping(): Promise<boolean> {
    try {
      await query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }
}
