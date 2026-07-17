import { faker } from "@faker-js/faker";
import { withClient } from "../db/postgres.js";

const TOTAL_USERS = 500;

export async function seedPostgres(): Promise<void> {
  console.log("[seed:postgres] Starting...");
  const start = Date.now();

  await withClient(async (client) => {
    // === SCHEMA CREATION (idempotent) ===
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        is_deleted BOOLEAN DEFAULT FALSE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        date_of_birth DATE,
        phone VARCHAR(50),
        address TEXT,
        country VARCHAR(100)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        plan VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        started_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_activity (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR(255),
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id BIGSERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        action VARCHAR(100) NOT NULL,
        actor VARCHAR(255) NOT NULL,
        subject_hash VARCHAR(64),
        details JSONB,
        prev_hash VARCHAR(64),
        hash VARCHAR(64) NOT NULL
      )
    `);

    // === CLEAR EXISTING DATA (idempotent) ===
    await client.query(`DELETE FROM user_activity`);
    await client.query(`DELETE FROM subscriptions`);
    await client.query(`DELETE FROM user_profiles`);
    await client.query(`DELETE FROM audit_log`);
    await client.query(`DELETE FROM users`);

    // === SEED DEMO USER (jane.doe) ===
    const janeResult = await client.query<{ id: string }>(
      `INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id`,
      ["jane.doe@email.com", "Jane Doe"]
    );
    const janeId = janeResult.rows[0].id;

    await client.query(
      `INSERT INTO user_profiles (user_id, date_of_birth, phone, address, country)
       VALUES ($1, $2, $3, $4, $5)`,
      [janeId, "1990-03-15", "+1-555-0100", "123 Privacy Lane, San Francisco, CA 94102", "US"]
    );

    // 2 active subscriptions (creates orphan risk narrative)
    await client.query(
      `INSERT INTO subscriptions (user_id, plan, status, expires_at)
       VALUES ($1, 'pro', 'active', NOW() + INTERVAL '6 months'),
              ($1, 'storage-addon', 'active', NOW() + INTERVAL '3 months')`,
      [janeId]
    );

    // Activity across 5 categories
    const actions = ["login", "export_data", "update_profile", "api_access", "payment"];
    for (const action of actions) {
      await client.query(
        `INSERT INTO user_activity (user_id, action, metadata)
         VALUES ($1, $2, $3)`,
        [janeId, action, JSON.stringify({ source: "web", demo: true })]
      );
    }

    // === SEED JOHN SMITH (clean user) ===
    const johnResult = await client.query<{ id: string }>(
      `INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id`,
      ["john.smith@email.com", "John Smith"]
    );
    const johnId = johnResult.rows[0].id;
    await client.query(
      `INSERT INTO user_profiles (user_id, phone, country) VALUES ($1, $2, $3)`,
      [johnId, "+1-555-0200", "US"]
    );

    // === SEED BOB WILSON (edge case: expired subscriptions) ===
    const bobResult = await client.query<{ id: string }>(
      `INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id`,
      ["bob.wilson@email.com", "Bob Wilson"]
    );
    const bobId = bobResult.rows[0].id;
    await client.query(
      `INSERT INTO subscriptions (user_id, plan, status, expires_at)
       VALUES ($1, 'basic', 'cancelled', NOW() - INTERVAL '1 month')`,
      [bobId]
    );

    // === SEED ~497 SYNTHETIC USERS (batch insert) ===
    const BATCH_SIZE = 50;
    const emails = new Set(["jane.doe@email.com", "john.smith@email.com", "bob.wilson@email.com"]);
    const syntheticUsers: Array<{ email: string; name: string }> = [];

    while (syntheticUsers.length < TOTAL_USERS - 3) {
      const email = faker.internet.email().toLowerCase();
      if (!emails.has(email)) {
        emails.add(email);
        syntheticUsers.push({ email, name: faker.person.fullName() });
      }
    }

    for (let i = 0; i < syntheticUsers.length; i += BATCH_SIZE) {
      const batch = syntheticUsers.slice(i, i + BATCH_SIZE);
      const values = batch.map((u, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`).join(",");
      const params = batch.flatMap((u) => [u.email, u.name]);
      await client.query(
        `INSERT INTO users (email, name) VALUES ${values}`,
        params
      );
    }
  });

  const elapsed = Date.now() - start;
  console.log(`[seed:postgres] Complete in ${elapsed}ms`);
  if (elapsed > 5000) {
    console.warn(`[seed:postgres] WARNING: Seed exceeded 5s budget (${elapsed}ms)`);
  }
}
