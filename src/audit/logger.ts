import { query } from "../db/postgres.js";
import { AuditAction, AuditEntry, CreateAuditEntryParams } from "./types.js";
import { hashIdentifier, computeAuditHash, canonicalizeAuditEntry } from "../utils/crypto.js";

export class AuditLogger {
  /**
   * Hashes a raw identifier (like an email or user ID) using SHA-256.
   */
  public static hashIdentifier(identifier: string): string {
    return hashIdentifier(identifier);
  }

  /**
   * Deterministically canonicalizes the payload before hashing.
   */
  public static canonicalize(
    action: string,
    actor: string,
    subjectHash: string | null,
    details: Record<string, any>,
    prevHash: string
  ): string {
    return canonicalizeAuditEntry(action, actor, subjectHash, details, prevHash);
  }

  /**
   * Appends a new entry to the audit log, enforcing the hash chain.
   */
  public static async appendLog(params: CreateAuditEntryParams): Promise<AuditEntry> {
    const subjectHash = params.subject ? hashIdentifier(params.subject) : null;
    const maxRetries = 12;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;

      // We fetch the latest hash to link to
      const lastLogResult = await query<{ hash: string }>(
        `SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1`
      );
      const expectedPrevHash = lastLogResult.length > 0 ? lastLogResult[0].hash : "GENESIS";

      // Calculate new hash based on the fresh prevHash
      const newHash = computeAuditHash(
        params.action,
        params.actor,
        subjectHash,
        params.details,
        expectedPrevHash
      );

      try {
        // Enforce integrity at insert time
        const insertResult = await query<AuditEntry>(
          `WITH last_log AS (
            SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1
          )
          INSERT INTO audit_log (action, actor, subject_hash, details, prev_hash, hash)
          SELECT $1, $2, $3, $4, COALESCE((SELECT hash FROM last_log), 'GENESIS'), $5
          WHERE $6 = COALESCE((SELECT hash FROM last_log), 'GENESIS')
          RETURNING *;`,
          [
            params.action,
            params.actor,
            subjectHash,
            params.details,
            newHash,
            expectedPrevHash,
          ]
        );

        if (insertResult.length > 0) {
          return insertResult[0];
        }

        // If insertResult is empty, another worker committed a row concurrently; back off and retry
        const backoffMs = Math.min(250, 8 * Math.pow(1.3, attempt) + Math.random() * 30);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      } catch (err: any) {
        if (err.code === "23505") {
          // Unique constraint violation (hash chain conflict); back off and retry
          const backoffMs = Math.min(250, 8 * Math.pow(1.3, attempt) + Math.random() * 30);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }
        throw err;
      }
    }

    throw new Error("Audit log append failed after max retries due to heavy concurrent write contention");
  }

  /**
   * Cryptographically verifies the entire audit log hash chain.
   * Detects any altered data, truncated records, or broken links.
   */
  public static async verifyIntegrity(): Promise<{
    valid: boolean;
    total: number;
    brokenAt?: number;
    details?: string;
  }> {
    const rows = await query<any>(
      `SELECT id, action, actor, subject_hash, details, prev_hash, hash
       FROM audit_log ORDER BY id ASC`
    );

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const expectedPrevHash = i === 0 ? "GENESIS" : rows[i - 1].hash;

      if (row.prev_hash !== expectedPrevHash) {
        return {
          valid: false,
          total: rows.length,
          brokenAt: row.id,
          details: `Prev hash mismatch at row ${row.id}: expected ${expectedPrevHash.slice(0, 8)}, got ${row.prev_hash?.slice(0, 8)}`,
        };
      }

      const computed = computeAuditHash(
        row.action,
        row.actor,
        row.subject_hash,
        row.details,
        row.prev_hash
      );

      if (computed !== row.hash) {
        return {
          valid: false,
          total: rows.length,
          brokenAt: row.id,
          details: `Hash mismatch at row ${row.id}: computed ${computed.slice(0, 8)}, stored ${row.hash?.slice(0, 8)}`,
        };
      }
    }

    return { valid: true, total: rows.length };
  }
}


