import { MongoClient, Db } from "mongodb";
import { config } from "../config.js";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getMongoDb(): Promise<Db> {
  if (!client) {
    client = new MongoClient(config.mongodb.url, {
      serverSelectionTimeoutMS: 5_000,
      connectTimeoutMS: 5_000,
    });
    await client.connect();
  }
  if (!db) {
    db = client.db(config.mongodb.dbName);
  }
  return db;
}

export async function closeMongoClient(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

export async function pingMongo(): Promise<boolean> {
  try {
    const database = await getMongoDb();
    await database.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}
