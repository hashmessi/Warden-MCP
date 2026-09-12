import type { InvariantType } from "./types.js";

/**
 * Invariant Assertion Engine
 * 
 * Verifies the 4 core mathematical and architectural invariants of Warden.
 */

export interface InvariantCheckResult {
  invariant: InvariantType;
  passed: boolean;
  message: string;
}

/**
 * INV-01: Authorization Gate
 * Asserts that mutations can only occur if an approval is valid and approved.
 * Unauthorized mutation attempts must throw/reject.
 */
export function checkAuthGateInvariant(
  attemptedStatus: string,
  mutationOccurred: boolean,
  errorThrown: boolean
): InvariantCheckResult {
  if (attemptedStatus === "approved") {
    return {
      invariant: "INV-01-AUTH-GATE",
      passed: mutationOccurred,
      message: mutationOccurred
        ? "Approved token allowed mutation as expected"
        : "Approved token failed to execute mutation",
    };
  }

  // Non-approved states (pending, denied, executed, rolled_back, non-existent)
  const passed = !mutationOccurred && errorThrown;
  return {
    invariant: "INV-01-AUTH-GATE",
    passed,
    message: passed
      ? `Mutation correctly blocked for unapproved status: ${attemptedStatus}`
      : `CRITICAL: Unauthorized mutation occurred with status: ${attemptedStatus}!`,
  };
}

/**
 * INV-02: Execution Monotonicity & Idempotency
 * Asserts that duplicate or replayed tokens cannot trigger secondary mutations.
 */
export function checkIdempotencyInvariant(
  executionAttempts: number,
  successfulMutations: number,
  totalRecordsDeletedExpected: number,
  totalRecordsActuallyDeleted: number
): InvariantCheckResult {
  const passed =
    successfulMutations <= 1 &&
    totalRecordsActuallyDeleted <= totalRecordsDeletedExpected;

  return {
    invariant: "INV-02-IDEMPOTENCY",
    passed,
    message: passed
      ? `Idempotency preserved across ${executionAttempts} attempts; duplicate executions blocked.`
      : `CRITICAL: Duplicate mutation occurred! Successful mutations: ${successfulMutations}, records deleted: ${totalRecordsActuallyDeleted}`,
  };
}

/**
 * INV-03: Lossless Reversibility
 * Asserts that snapshot restoration restores 100% of the originally deleted records.
 */
export function checkReversibilityInvariant(
  initialCount: number,
  postRollbackCount: number
): InvariantCheckResult {
  const passed = initialCount === postRollbackCount && initialCount > 0;
  return {
    invariant: "INV-03-REVERSIBILITY",
    passed,
    message: passed
      ? `Reversibility 100%: ${postRollbackCount}/${initialCount} records restored from snapshot.`
      : `CRITICAL: Rollback mismatch! Initial: ${initialCount}, Restored: ${postRollbackCount}`,
  };
}

/**
 * INV-04: Cryptographic Tamper-Evidence
 * Asserts that out-of-band modifications to audit log records are detected.
 */
export function checkTamperDetectionInvariant(
  isTampered: boolean,
  verificationPassed: boolean
): InvariantCheckResult {
  if (isTampered) {
    const passed = !verificationPassed;
    return {
      invariant: "INV-04-TAMPER-EVIDENCE",
      passed,
      message: passed
        ? "Audit tamper was successfully detected by hash chain verification."
        : "CRITICAL: Audit tamper went UNDETECTED by hash chain verification!",
    };
  } else {
    const passed = verificationPassed;
    return {
      invariant: "INV-04-TAMPER-EVIDENCE",
      passed,
      message: passed
        ? "Untampered audit log verified valid."
        : "Audit log validation failed on untampered log.",
    };
  }
}
