import "dotenv/config";
import { initDb } from "./src/db/postgres.js";

async function main() {
  console.log("Initializing DB...");
  await initDb();
  console.log("Done.");
  process.exit(0);
}

main();
