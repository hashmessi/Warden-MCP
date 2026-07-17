import "dotenv/config";

export const config = {
  postgres: {
    connectionString: process.env.POSTGRES_URL ?? "postgresql://warden:warden_dev@localhost:5432/warden_db",
  },
  mongodb: {
    url: process.env.MONGODB_URL ?? "mongodb://localhost:27017",
    dbName: process.env.MONGODB_DB ?? "warden_db",
  },
  app: {
    port: parseInt(process.env.PORT ?? "3001", 10),
    nodeEnv: process.env.NODE_ENV ?? "development",
  },
  llm: {
    enabled: process.env.LLM_ENABLED === "true",
    openaiApiKey: process.env.OPENAI_API_KEY,
  },
} as const;
