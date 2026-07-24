import * as crypto from "crypto";

/**
 * Deterministically stringifies an object by recursively sorting object keys.
 * Ensures consistent canonical representations for hashing regardless of property insertion order.
 */
export function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(",")}]`;
  const keys = Object.keys(obj).sort();
  const result = keys.map(k => `"${k}":${stableStringify(obj[k])}`).join(",");
  return `{${result}}`;
}

/**
 * Hashes a raw identifier (like an email or user ID) using SHA-256.
 */
export function hashIdentifier(identifier: string): string {
  return crypto.createHash("sha256").update(identifier).digest("hex");
}

/**
 * Canonicalizes audit entry fields into a deterministic JSON string.
 */
export function canonicalizeAuditEntry(
  action: string,
  actor: string,
  subjectHash: string | null,
  details: Record<string, any>,
  prevHash: string
): string {
  return stableStringify({ action, actor, subjectHash, details, prevHash });
}

/**
 * Computes SHA-256 hash of canonical audit log payload.
 */
export function computeAuditHash(
  action: string,
  actor: string,
  subjectHash: string | null,
  details: Record<string, any>,
  prevHash: string
): string {
  const canonical = canonicalizeAuditEntry(action, actor, subjectHash, details, prevHash);
  return crypto.createHash("sha256").update(canonical).digest("hex");
}
