import "dotenv/config";
import { seedPostgres } from "./postgres.seed.js";
import { seedMongoDB } from "./mongodb.seed.js";
import { seedPaymentLedger } from "./payment.seed.js";
import { closePool } from "../db/postgres.js";
import { closeMongoClient } from "../db/mongodb.js";

async function main(): Promise<void> {
  const start = Date.now();
  console.log("=== Warden Seed Script ===");

  try {
    await seedPostgres();
    await seedMongoDB();
    seedPaymentLedger(); // synchronous — in-memory
  } finally {
    await closePool();
    await closeMongoClient();
  }

  const elapsed = Date.now() - start;
  console.log(`\n=== Seed Complete in ${elapsed}ms ===`);
  console.log("Demo user: jane.doe@email.com — data in all 3 systems");
}

main().catch((err) => {
  console.error("[seed] Fatal error:", err);
  process.exit(1);
});
