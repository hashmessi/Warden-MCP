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
    
    // We fetch the last hash first, but the actual insert enforces it to avoid race conditions.
    const lastLogResult = await query<{ hash: string }>(
      `SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1`
    );
    const expectedPrevHash = lastLogResult.length > 0 ? lastLogResult[0].hash : "GENESIS";
    
    // Calculate new hash
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
          expectedPrevHash
        ]
      );

      if (insertResult.length === 0) {
        throw new Error("Hash chain integrity violation: prev_hash mismatch");
      }

      return insertResult[0];
    } catch (err: any) {
      if (err.code === "23505") { // Unique constraint violation in Postgres
        throw new Error("Concurrent hash chain append conflict: prev_hash or hash already exists");
      }
      throw err;
    }
  }
}

