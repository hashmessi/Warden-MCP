import { randomUUID } from "crypto";
import { query } from "../db/postgres.js";
import { getMongoDb } from "../db/mongodb.js";
import { loadLedger, getLedger, type PaymentRecord } from "../adapters/payment.adapter.js";
import type { ScenarioSubject } from "./types.js";

/**
 * Generates an isolated test subject identity.
 * Example email: eval-normal-a1b2c3d4@warden.test
 */
export function generateTestSubject(scenarioName: string): ScenarioSubject {
  const shortId = randomUUID().replace(/-/g, "").slice(0, 8);
  const cleanName = scenarioName.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return {
    email: `eval-${cleanName}-${shortId}@warden.test`,
    userId: randomUUID(),
    name: `Eval User (${scenarioName})`,
  };
}

/**
 * Seeds isolated test records across PostgreSQL, MongoDB, and the in-memory Payment Ledger.
 * Never touches or overwrites existing demo records (e.g. jane.doe@email.com).
 */
export async function seedTestSubject(subject: ScenarioSubject): Promise<void> {
  // 1. Seed PostgreSQL
  await query(
    `INSERT INTO users (id, email, name, created_at, is_deleted)
     VALUES ($1, $2, $3, NOW(), FALSE)
     ON CONFLICT (email) DO NOTHING`,
    [subject.userId, subject.email, subject.name]
  );

  await query(
    `INSERT INTO user_profiles (id, user_id, date_of_birth, phone, address, country)
     VALUES ($1, $2, '1990-01-01', '+1-555-0199', '123 Eval Way', 'United States')`,
    [randomUUID(), subject.userId]
  );

  await query(
    `INSERT INTO subscriptions (id, user_id, plan, status, started_at, expires_at)
     VALUES 
       ($1, $2, 'Pro Plan (Eval)', 'active', NOW(), NOW() + INTERVAL '30 days'),
       ($3, $2, 'Addon Storage (Eval)', 'active', NOW(), NOW() + INTERVAL '30 days')`,
    [randomUUID(), subject.userId, randomUUID()]
  );

  await query(
    `INSERT INTO user_activity (id, user_id, action, metadata, created_at)
     VALUES 
       ($1, $2, 'login', '{"ip": "127.0.0.1", "device": "eval-harness"}'::jsonb, NOW()),
       ($3, $2, 'page_view', '{"path": "/dashboard"}'::jsonb, NOW())`,
    [randomUUID(), subject.userId, randomUUID()]
  );

  // 2. Seed MongoDB
  const mongoDb = await getMongoDb();
  await mongoDb.collection("sessions").insertMany([
    {
      email: subject.email,
      userId: subject.userId,
      sessionToken: `sess-${randomUUID()}`,
      loginAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      ipAddress: "127.0.0.1",
      userAgent: "WardenEvalHarness/2.0",
      isActive: true,
    },
    {
      email: subject.email,
      userId: subject.userId,
      sessionToken: `sess-${randomUUID()}`,
      loginAt: new Date(Date.now() - 3600000),
      expiresAt: new Date(Date.now() + 86400000),
      ipAddress: "127.0.0.1",
      userAgent: "WardenEvalHarness/2.0",
      isActive: false,
    },
  ]);

  await mongoDb.collection("activity_logs").insertMany([
    {
      email: subject.email,
      userId: subject.userId,
      event: "eval_metric_logged",
      payload: { scenario: "automated_eval" },
      timestamp: new Date(),
    },
  ]);

  // 3. Seed Payment Ledger
  const currentLedger = getLedger();
  const testPayments: PaymentRecord[] = [
    {
      id: `pay-${randomUUID().slice(0, 8)}`,
      userId: subject.userId,
      email: subject.email,
      amount: 49.99,
      currency: "USD",
      status: "paid",
      description: "Eval Subscription Invoice",
      createdAt: new Date().toISOString(),
      subscriptionId: `sub-eval-${subject.userId.slice(0, 8)}`,
    },
  ];
  loadLedger([...currentLedger, ...testPayments]);
}

/**
 * Cleans up all evaluation records for the given subject across all data stores.
 */
export async function cleanupTestSubject(subject: ScenarioSubject): Promise<void> {
  try {
    // 1. Clean PostgreSQL
    // Cascade on users handles user_profiles, subscriptions, user_activity
    await query(`DELETE FROM users WHERE email = $1 OR id = $2`, [subject.email, subject.userId]);
    
    // Clean snapshots and approvals
    await query(`
      DELETE FROM snapshots 
      WHERE execution_id IN (
        SELECT execution_id FROM approvals 
        WHERE scan_id IN (SELECT scan_id::text FROM scans WHERE identifier = $1)
        AND execution_id IS NOT NULL
      )
    `, [subject.email]);

    await query(`
      DELETE FROM impact_reports 
      WHERE scan_id IN (SELECT scan_id FROM scans WHERE identifier = $1)
    `, [subject.email]);

    await query(`
      DELETE FROM approvals 
      WHERE scan_id IN (SELECT scan_id::text FROM scans WHERE identifier = $1)
    `, [subject.email]);

    await query(`DELETE FROM scans WHERE identifier = $1`, [subject.email]);

    // 2. Clean MongoDB
    const mongoDb = await getMongoDb();
    await mongoDb.collection("sessions").deleteMany({
      $or: [{ email: subject.email }, { userId: subject.userId }],
    });
    await mongoDb.collection("activity_logs").deleteMany({
      $or: [{ email: subject.email }, { userId: subject.userId }],
    });

    // 3. Clean Payment Ledger
    const currentLedger = getLedger();
    const filteredLedger = currentLedger.filter(
      (p) => p.email !== subject.email && p.userId !== subject.userId
    );
    loadLedger(filteredLedger);
  } catch (err) {
    console.error(`[eval:seeder] Error cleaning up ${subject.email}:`, err);
  }
}
