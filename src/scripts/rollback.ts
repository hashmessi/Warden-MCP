import "dotenv/config";
import { rollbackAction } from "../execution/engine.js";

async function main() {
  const executionId = process.argv[2];
  if (!executionId) {
    console.error("Usage: npx tsx src/scripts/rollback.ts <executionId>");
    process.exit(1);
  }

  try {
    await rollbackAction(executionId);
    console.log("Rollback completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Rollback failed:", err);
    process.exit(1);
  }
}

main();
