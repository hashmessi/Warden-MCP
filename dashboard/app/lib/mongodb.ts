import { MongoClient, Db } from "mongodb";

const globalForMongo = global as unknown as { mongoClient: MongoClient; mongoDb: Db };

const MONGODB_URL = process.env.MONGODB_URL || "mongodb://localhost:27017";
const MONGODB_DB = process.env.MONGODB_DB || "warden_db";

export async function getMongoDb(): Promise<Db> {
  if (globalForMongo.mongoDb) return globalForMongo.mongoDb;

  const client = new MongoClient(MONGODB_URL);
  await client.connect();
  const db = client.db(MONGODB_DB);

  if (process.env.NODE_ENV !== "production") {
    globalForMongo.mongoClient = client;
    globalForMongo.mongoDb = db;
  }

  return db;
}
