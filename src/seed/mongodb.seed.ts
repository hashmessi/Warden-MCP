import { faker } from "@faker-js/faker";
import { getMongoDb } from "../db/mongodb.js";

export async function seedMongoDB(): Promise<void> {
  console.log("[seed:mongodb] Starting...");
  const start = Date.now();
  const db = await getMongoDb();

  // Clear existing
  await db.collection("sessions").deleteMany({});
  await db.collection("activity_logs").deleteMany({});

  // Jane Doe sessions (scattered across time)
  const janeSessions = Array.from({ length: 8 }, (_, i) => ({
    email: "jane.doe@email.com",
    userId: "jane-placeholder", // updated in Phase 3 to real UUID
    sessionToken: faker.string.alphanumeric(64),
    loginAt: faker.date.past({ years: 1 }),
    expiresAt: faker.date.future({ years: 0.1 }),
    ipAddress: faker.internet.ip(),
    userAgent: faker.internet.userAgent(),
    isActive: i < 2, // 2 active sessions
  }));

  const janeActivityLogs = Array.from({ length: 15 }, () => ({
    email: "jane.doe@email.com",
    userId: "jane-placeholder",
    event: faker.helpers.arrayElement(["page_view", "click", "api_call", "export", "login"]),
    payload: { page: faker.internet.url(), duration: faker.number.int({ min: 1, max: 300 }) },
    timestamp: faker.date.past({ years: 1 }),
  }));

  // Synthetic users sessions
  const syntheticSessions = Array.from({ length: 200 }, () => ({
    email: faker.internet.email().toLowerCase(),
    userId: faker.string.uuid(),
    sessionToken: faker.string.alphanumeric(64),
    loginAt: faker.date.past({ years: 1 }),
    expiresAt: faker.date.future({ years: 0.1 }),
    ipAddress: faker.internet.ip(),
    userAgent: faker.internet.userAgent(),
    isActive: faker.datatype.boolean(),
  }));

  await db.collection("sessions").insertMany([...janeSessions, ...syntheticSessions]);
  await db.collection("activity_logs").insertMany(janeActivityLogs);

  // Create indexes
  await db.collection("sessions").createIndex({ email: 1 });
  await db.collection("sessions").createIndex({ userId: 1 });
  await db.collection("activity_logs").createIndex({ email: 1 });

  const elapsed = Date.now() - start;
  console.log(`[seed:mongodb] Complete in ${elapsed}ms`);
}
