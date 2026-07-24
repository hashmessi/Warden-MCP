import "dotenv/config";
import { scanSubject } from "../scanner.js";
import { createPendingAction, approveAction } from "../approval/store.js";
import { executeAction, rollbackAction } from "../execution/engine.js";
import { initDb } from "../db/postgres.js";
import { loadLedger } from "../adapters/payment.adapter.js";

async function run() {
  await initDb();
  // Payment ledger is in-memory and seeded by seed script normally, 
  // but let's just test postgres/mongo if payment is empty, or load a mock one.
  loadLedger([
    {
      id: "pay_1",
      userId: "u1",
      email: "jane.doe@email.com",
      amount: 100,
      currency: "usd",
      status: "paid",
      description: "Test",
      createdAt: new Date().toISOString(),
      subscriptionId: "sub_1",
    }
  ]);

  console.log("=== 1. Initial Scan ===");
  const res1 = await scanSubject("jane.doe@email.com");
  console.log(`Found ${res1.totalRecords} records.`);

  if (res1.totalRecords === 0) {
    console.log("No records found to delete. Maybe seed the DB first?");
    process.exit(1);
  }

  console.log("\n=== 2. Request Execution ===");
  const pending = await createPendingAction(res1.scanId, "delete");
  console.log(`Created pending action: ${pending.token}`);

  console.log("\n=== 3. Approve Action ===");
  const approved = await approveAction(pending.token);
  console.log(`Action approved by: ${approved.resolvedBy}`);

  console.log("\n=== 4. Execute Action ===");
  const executionId = await executeAction(pending.token);
  console.log(`Executed action. Execution ID: ${executionId}`);

  console.log("\n=== 5. Verify Deletion (Scan 2) ===");
  const res2 = await scanSubject("jane.doe@email.com");
  console.log(`Found ${res2.totalRecords} records (Expected: 0).`);
  
  if (res2.totalRecords !== 0) {
    console.error("Deletion failed! Records still exist.");
    process.exit(1);
  }

  console.log("\n=== 6. Rollback Action ===");
  await rollbackAction(executionId);
  console.log(`Rollback completed.`);

  console.log("\n=== 7. Verify Restoration (Scan 3) ===");
  const res3 = await scanSubject("jane.doe@email.com");
  console.log(`Found ${res3.totalRecords} records (Expected: ${res1.totalRecords}).`);

  if (res3.totalRecords !== res1.totalRecords) {
    console.error(`Rollback mismatch! Expected ${res1.totalRecords} but got ${res3.totalRecords}`);
    process.exit(1);
  }

  console.log("\n✅ E2E Verification Passed!");
  process.exit(0);
}

run().catch(console.error);
