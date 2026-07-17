---
phase: 1
name: Foundation & Data Layer
wave_count: 3
requirements: [INFR-01, INFR-02, INFR-03, INFR-04, INFR-05]
depends_on: []
autonomous: false
---

# Phase 1 Plan: Foundation & Data Layer

**Goal:** Set up the TypeScript project scaffold, configure database connections (Postgres + MongoDB + mock payment ledger), define typed adapter interfaces, and seed all three systems with rich synthetic data that enables a demoable story.

**Must-haves:**
- [ ] TypeScript compiles with zero errors (`tsc --noEmit` exits 0)
- [ ] Docker Compose brings up Postgres + MongoDB with health checks passing
- [ ] All 3 DataAdapter implementations satisfy the `DataAdapter` interface with no TypeScript errors
- [ ] Seed script runs idempotently in < 5 seconds and populates ~500 users
- [ ] `jane.doe@email.com` has data scattered across ALL 3 systems (enabling the Phase 3 demo)

---

## Wave 1: Project Scaffold & Config

*Parallel. No dependencies. Establishes the foundation everything else builds on.*

---

### Task 1.1 — Initialize TypeScript Project

```xml
<task id="1.1">
  <title>Initialize TypeScript project with correct dependencies</title>
  
  <read_first>
    - package.json (if exists — check for conflicts before writing)
    - tsconfig.json (if exists)
    - .planning/REQUIREMENTS.md (confirm dependency list)
    - .planning/STATE.md (confirm Node version: 22 LTS)
  </read_first>
  
  <action>
    Run the following commands in order:

    1. Initialize package.json:
       ```
       npm init -y
       ```

    2. Install runtime dependencies:
       ```
       npm install @modelcontextprotocol/sdk zod pg mongodb @faker-js/faker dotenv uuid
       ```

    3. Install dev dependencies:
       ```
       npm install -D typescript tsx @types/node @types/pg @types/uuid ts-node
       ```

    4. Create tsconfig.json with EXACT content:
       ```json
       {
         "compilerOptions": {
           "target": "ES2022",
           "module": "NodeNext",
           "moduleResolution": "NodeNext",
           "outDir": "./dist",
           "rootDir": "./src",
           "strict": true,
           "esModuleInterop": true,
           "resolveJsonModule": true,
           "declaration": true,
           "declarationMap": true,
           "sourceMap": true,
           "skipLibCheck": true
         },
         "include": ["src/**/*"],
         "exclude": ["node_modules", "dist"]
       }
       ```

    5. Add scripts to package.json:
       ```json
       "scripts": {
         "build": "tsc",
         "dev": "tsx watch src/index.ts",
         "seed": "tsx src/seed/index.ts",
         "typecheck": "tsc --noEmit",
         "start": "node dist/index.js"
       }
       ```

    6. Create src/index.ts placeholder:
       ```typescript
       // Warden MCP Server — entry point
       // Populated in Phase 3
       console.log("Warden server placeholder — implement in Phase 3");
       ```
  </action>
  
  <acceptance_criteria>
    - package.json contains "dependencies" with keys: @modelcontextprotocol/sdk, zod, pg, mongodb, @faker-js/faker, dotenv, uuid
    - package.json contains "devDependencies" with keys: typescript, tsx, @types/node, @types/pg
    - tsconfig.json contains "moduleResolution": "NodeNext"
    - tsconfig.json contains "strict": true
    - `npm run typecheck` exits 0 with no errors
    - src/index.ts exists and contains "Warden server placeholder"
  </acceptance_criteria>
</task>
```

---

### Task 1.2 — Create Environment Configuration

```xml
<task id="1.2">
  <title>Create .env.example and environment loading utility</title>
  
  <read_first>
    - .planning/phases/01-foundation-data-layer/01-RESEARCH.md (env vars section)
    - .env (if exists — do NOT overwrite, only create .env.example)
  </read_first>
  
  <action>
    1. Create .env.example with EXACT content:
       ```
       # Warden — Environment Configuration
       # Copy to .env for local development

       # PostgreSQL
       POSTGRES_URL=postgresql://warden:warden_dev@localhost:5432/warden_db

       # MongoDB
       MONGODB_URL=mongodb://localhost:27017
       MONGODB_DB=warden_db

       # Application
       NODE_ENV=development
       PORT=3001

       # Optional: LLM enrichment for impact reports (Phase 4)
       # OPENAI_API_KEY=sk-...
       # LLM_ENABLED=false
       ```

    2. Create .env (actual local config) with the same content as .env.example 
       (this is the development default — never committed).

    3. Add .env to .gitignore (create .gitignore if missing):
       ```
       node_modules/
       dist/
       .env
       *.js.map
       ```

    4. Create src/config.ts with EXACT content:
       ```typescript
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
       ```
  </action>
  
  <acceptance_criteria>
    - .env.example contains "POSTGRES_URL=postgresql://warden:warden_dev@localhost:5432/warden_db"
    - .env.example contains "MONGODB_URL=mongodb://localhost:27017"
    - .gitignore contains ".env" on its own line
    - src/config.ts contains "export const config"
    - src/config.ts contains "POSTGRES_URL"
    - `npm run typecheck` exits 0 after creating config.ts
  </acceptance_criteria>
</task>
```

---

### Task 1.3 — Docker Compose Setup

```xml
<task id="1.3">
  <title>Create Docker Compose for Postgres + MongoDB with health checks</title>
  
  <read_first>
    - .planning/REQUIREMENTS.md (INFR-05: Docker Compose requirement)
    - .planning/phases/01-foundation-data-layer/01-RESEARCH.md (Docker Compose section)
    - docker-compose.yml (if exists — check for conflicts)
  </read_first>
  
  <action>
    Create docker-compose.yml with EXACT content:
    ```yaml
    version: "3.9"

    services:
      postgres:
        image: postgres:16-alpine
        container_name: warden_postgres
        environment:
          POSTGRES_USER: warden
          POSTGRES_PASSWORD: warden_dev
          POSTGRES_DB: warden_db
        ports:
          - "5432:5432"
        volumes:
          - postgres_data:/var/lib/postgresql/data
        healthcheck:
          test: ["CMD-SHELL", "pg_isready -U warden -d warden_db"]
          interval: 5s
          timeout: 5s
          retries: 10
          start_period: 10s
        restart: unless-stopped

      mongodb:
        image: mongo:7
        container_name: warden_mongodb
        ports:
          - "27017:27017"
        volumes:
          - mongo_data:/data/db
        healthcheck:
          test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok"]
          interval: 5s
          timeout: 5s
          retries: 10
          start_period: 10s
        restart: unless-stopped

    volumes:
      postgres_data:
      mongo_data:
    ```
  </action>
  
  <acceptance_criteria>
    - docker-compose.yml contains "postgres:16-alpine"
    - docker-compose.yml contains "mongo:7"
    - docker-compose.yml contains "pg_isready -U warden -d warden_db"
    - docker-compose.yml contains "healthcheck" under both services
    - docker-compose.yml contains "5432:5432" port mapping
    - docker-compose.yml contains "27017:27017" port mapping
  </acceptance_criteria>
</task>
```

---

## Wave 2: Database Connections & Adapter Interface

*Depends on Wave 1 (config.ts must exist). Tasks in this wave run in parallel.*

---

### Task 2.1 — Postgres Connection Pool

```xml
<task id="2.1">
  <title>Create Postgres connection pool singleton</title>
  
  <read_first>
    - src/config.ts (connectionString location)
    - .planning/phases/01-foundation-data-layer/01-RESEARCH.md (DB schema section)
    - node_modules/pg/lib/index.d.ts (or pg API — confirm Pool constructor signature)
  </read_first>
  
  <action>
    Create src/db/postgres.ts with EXACT content:
    ```typescript
    import { Pool, PoolClient } from "pg";
    import { config } from "../config.js";

    let pool: Pool | null = null;

    export function getPool(): Pool {
      if (!pool) {
        pool = new Pool({
          connectionString: config.postgres.connectionString,
          max: 10,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 2_000,
        });

        pool.on("error", (err) => {
          console.error("[postgres] Unexpected pool error:", err);
        });
      }
      return pool;
    }

    export async function query<T = unknown>(
      sql: string,
      params?: unknown[]
    ): Promise<T[]> {
      const result = await getPool().query(sql, params);
      return result.rows as T[];
    }

    export async function withClient<T>(
      fn: (client: PoolClient) => Promise<T>
    ): Promise<T> {
      const client = await getPool().connect();
      try {
        return await fn(client);
      } finally {
        client.release();
      }
    }

    export async function closePool(): Promise<void> {
      if (pool) {
        await pool.end();
        pool = null;
      }
    }
    ```
  </action>
  
  <acceptance_criteria>
    - src/db/postgres.ts contains "export function getPool()"
    - src/db/postgres.ts contains "export async function query"
    - src/db/postgres.ts contains "export async function withClient"
    - src/db/postgres.ts contains "export async function closePool"
    - src/db/postgres.ts imports from "../config.js" (NodeNext requires .js extension)
    - `npm run typecheck` exits 0
  </acceptance_criteria>
</task>
```

---

### Task 2.2 — MongoDB Connection Singleton

```xml
<task id="2.2">
  <title>Create MongoDB client singleton</title>
  
  <read_first>
    - src/config.ts (mongodb.url and mongodb.dbName)
    - .planning/phases/01-foundation-data-layer/01-RESEARCH.md (MongoDB schema section)
  </read_first>
  
  <action>
    Create src/db/mongodb.ts with EXACT content:
    ```typescript
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
    ```
  </action>
  
  <acceptance_criteria>
    - src/db/mongodb.ts contains "export async function getMongoDb()"
    - src/db/mongodb.ts contains "export async function closeMongoClient()"
    - src/db/mongodb.ts contains "export async function pingMongo()"
    - src/db/mongodb.ts imports from "../config.js"
    - `npm run typecheck` exits 0
  </acceptance_criteria>
</task>
```

---

### Task 2.3 — DataAdapter Interface & Types

```xml
<task id="2.3">
  <title>Define the DataAdapter interface and shared types</title>
  
  <read_first>
    - .planning/phases/01-foundation-data-layer/01-RESEARCH.md (DataAdapter Interface section)
    - .planning/REQUIREMENTS.md (DISC-01 through DISC-05 — what the interface must support)
    - .planning/ROADMAP.md (Phase 3 goal — scan_subject fan-out — this interface is its backbone)
  </read_first>
  
  <action>
    Create src/adapters/types.ts with EXACT content:
    ```typescript
    /**
     * Warden Data Adapter Interface
     * 
     * All data system adapters (Postgres, MongoDB, payment ledger) MUST implement
     * this interface. It is the backbone of Phase 3's multi-system scan fan-out.
     */

    export type SensitivityTag = "pii" | "financial" | "behavioral" | "system";
    export type SystemName = "postgres" | "mongodb" | "payment_ledger";
    export type DeleteMode = "delete" | "anonymize";
    export type RecordStatus = "active" | "pending" | "deleted" | "anonymized";

    export interface FieldHit {
      fieldName: string;
      sensitivityTag: SensitivityTag;
      sample?: string; // redacted/truncated display value — never raw PII
    }

    export interface DataHit {
      sourceSystem: SystemName;
      table: string;           // table name (Postgres) or collection name (MongoDB)
      rowCount: number;
      fields: FieldHit[];
      sampleIds: string[];     // row IDs — used by Phase 6 snapshot engine
      hasOrphanRisk?: boolean; // true if deleting would orphan dependent records
      orphanDetails?: string;  // human-readable description of orphan risk
    }

    export interface ScanResult {
      scanId: string;          // UUID — stored and referenced by subsequent phases
      identifier: string;      // searched email or userId
      scannedAt: string;       // ISO8601
      hits: DataHit[];
      totalRecords: number;    // sum of rowCount across all hits
      systemsScanned: string[];
    }

    export interface DeletionResult {
      sourceSystem: SystemName;
      table: string;
      affected: number;
      mode: DeleteMode;
    }

    export interface SchemaInfo {
      tables: string[];
      recordCount: number;
    }

    export interface DataAdapter {
      readonly systemName: SystemName;

      /**
       * Find all records referencing the given identifier (email or userId).
       * MUST be read-only. MUST NOT mutate any data.
       */
      findByIdentifier(identifier: string): Promise<DataHit[]>;

      /**
       * Delete or anonymize all records for the given identifier.
       * Called ONLY by Phase 6 execution engine after human approval.
       */
      deleteRecords(
        identifier: string,
        mode: DeleteMode
      ): Promise<DeletionResult[]>;

      /**
       * Return schema info for display in impact report (Phase 4).
       */
      getSchema(): Promise<SchemaInfo>;

      /**
       * Health check — returns true if the system is reachable.
       */
      ping(): Promise<boolean>;
    }
    ```
  </action>
  
  <acceptance_criteria>
    - src/adapters/types.ts contains "export interface DataAdapter"
    - src/adapters/types.ts contains "findByIdentifier(identifier: string): Promise<DataHit[]>"
    - src/adapters/types.ts contains "deleteRecords("
    - src/adapters/types.ts contains "export interface ScanResult"
    - src/adapters/types.ts contains "export type SensitivityTag"
    - `npm run typecheck` exits 0
  </acceptance_criteria>
</task>
```

---

## Wave 3: Adapter Implementations & Seed Data

*Depends on Wave 2 (types.ts + db clients must exist). Tasks in this wave run in parallel.*

---

### Task 3.1 — Postgres DataAdapter Implementation

```xml
<task id="3.1">
  <title>Implement PostgresAdapter satisfying DataAdapter interface</title>
  
  <read_first>
    - src/adapters/types.ts (DataAdapter interface — implement EXACTLY)
    - src/db/postgres.ts (query and withClient functions)
    - .planning/phases/01-foundation-data-layer/01-RESEARCH.md (Postgres schema — all 5 tables)
    - .planning/REQUIREMENTS.md (DISC-01, DISC-04)
  </read_first>
  
  <action>
    Create src/adapters/postgres.adapter.ts with EXACT content:
    ```typescript
    import { query } from "../db/postgres.js";
    import type {
      DataAdapter,
      DataHit,
      DeletionResult,
      SchemaInfo,
      SystemName,
    } from "./types.js";

    export class PostgresAdapter implements DataAdapter {
      readonly systemName: SystemName = "postgres";

      async findByIdentifier(identifier: string): Promise<DataHit[]> {
        const hits: DataHit[] = [];

        // 1. Search users table
        const users = await query<{ id: string; email: string; name: string }>(
          `SELECT id, email, name FROM users WHERE email = $1 AND is_deleted = FALSE`,
          [identifier]
        );
        if (users.length > 0) {
          hits.push({
            sourceSystem: "postgres",
            table: "users",
            rowCount: users.length,
            fields: [
              { fieldName: "email", sensitivityTag: "pii" },
              { fieldName: "name", sensitivityTag: "pii" },
            ],
            sampleIds: users.map((u) => u.id),
          });
        }

        // 2. Search user_profiles
        const profiles = await query<{ id: string }>(
          `SELECT up.id FROM user_profiles up
           INNER JOIN users u ON u.id = up.user_id
           WHERE u.email = $1`,
          [identifier]
        );
        if (profiles.length > 0) {
          hits.push({
            sourceSystem: "postgres",
            table: "user_profiles",
            rowCount: profiles.length,
            fields: [
              { fieldName: "date_of_birth", sensitivityTag: "pii" },
              { fieldName: "phone", sensitivityTag: "pii" },
              { fieldName: "address", sensitivityTag: "pii" },
            ],
            sampleIds: profiles.map((p) => p.id),
          });
        }

        // 3. Search subscriptions (with orphan risk detection)
        const subs = await query<{ id: string; status: string; plan: string }>(
          `SELECT s.id, s.status, s.plan FROM subscriptions s
           INNER JOIN users u ON u.id = s.user_id
           WHERE u.email = $1 AND s.status = 'active'`,
          [identifier]
        );
        if (subs.length > 0) {
          hits.push({
            sourceSystem: "postgres",
            table: "subscriptions",
            rowCount: subs.length,
            fields: [
              { fieldName: "plan", sensitivityTag: "financial" },
              { fieldName: "status", sensitivityTag: "system" },
            ],
            sampleIds: subs.map((s) => s.id),
            hasOrphanRisk: true,
            orphanDetails: `${subs.length} active subscription(s) reference this user — deleting will orphan billing records`,
          });
        }

        // 4. Search user_activity
        const activity = await query<{ id: string }>(
          `SELECT ua.id FROM user_activity ua
           INNER JOIN users u ON u.id = ua.user_id
           WHERE u.email = $1`,
          [identifier]
        );
        if (activity.length > 0) {
          hits.push({
            sourceSystem: "postgres",
            table: "user_activity",
            rowCount: activity.length,
            fields: [
              { fieldName: "action", sensitivityTag: "behavioral" },
              { fieldName: "metadata", sensitivityTag: "behavioral" },
            ],
            sampleIds: activity.map((a) => a.id),
          });
        }

        return hits;
      }

      async deleteRecords(
        identifier: string,
        mode: "delete" | "anonymize"
      ): Promise<DeletionResult[]> {
        const results: DeletionResult[] = [];

        if (mode === "delete") {
          // Soft delete — set is_deleted flag
          const r = await query<{ id: string }>(
            `UPDATE users SET is_deleted = TRUE WHERE email = $1 RETURNING id`,
            [identifier]
          );
          results.push({
            sourceSystem: "postgres",
            table: "users",
            affected: r.length,
            mode: "delete",
          });
        } else {
          // Anonymize PII fields
          const r = await query<{ id: string }>(
            `UPDATE users 
             SET email = 'anonymized-' || id || '@deleted.invalid',
                 name = 'Anonymized User'
             WHERE email = $1
             RETURNING id`,
            [identifier]
          );
          results.push({
            sourceSystem: "postgres",
            table: "users",
            affected: r.length,
            mode: "anonymize",
          });
        }

        return results;
      }

      async getSchema(): Promise<SchemaInfo> {
        const tables = await query<{ tablename: string }>(
          `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
        );
        const countResult = await query<{ count: string }>(
          `SELECT COUNT(*) as count FROM users`
        );
        return {
          tables: tables.map((t) => t.tablename),
          recordCount: parseInt(countResult[0]?.count ?? "0", 10),
        };
      }

      async ping(): Promise<boolean> {
        try {
          await query("SELECT 1");
          return true;
        } catch {
          return false;
        }
      }
    }
    ```
  </action>
  
  <acceptance_criteria>
    - src/adapters/postgres.adapter.ts contains "implements DataAdapter"
    - src/adapters/postgres.adapter.ts contains "readonly systemName: SystemName = \"postgres\""
    - src/adapters/postgres.adapter.ts contains "hasOrphanRisk: true"
    - src/adapters/postgres.adapter.ts contains "findByIdentifier"
    - src/adapters/postgres.adapter.ts contains "deleteRecords"
    - src/adapters/postgres.adapter.ts contains "getSchema"
    - src/adapters/postgres.adapter.ts contains "ping"
    - `npm run typecheck` exits 0
  </acceptance_criteria>
</task>
```

---

### Task 3.2 — MongoDB DataAdapter Implementation

```xml
<task id="3.2">
  <title>Implement MongoDbAdapter satisfying DataAdapter interface</title>
  
  <read_first>
    - src/adapters/types.ts (DataAdapter interface)
    - src/db/mongodb.ts (getMongoDb function)
    - .planning/phases/01-foundation-data-layer/01-RESEARCH.md (MongoDB schema: sessions + activity_logs collections)
  </read_first>
  
  <action>
    Create src/adapters/mongodb.adapter.ts with EXACT content:
    ```typescript
    import { getMongoDb } from "../db/mongodb.js";
    import type {
      DataAdapter,
      DataHit,
      DeletionResult,
      SchemaInfo,
      SystemName,
    } from "./types.js";

    export class MongoDbAdapter implements DataAdapter {
      readonly systemName: SystemName = "mongodb";

      async findByIdentifier(identifier: string): Promise<DataHit[]> {
        const db = await getMongoDb();
        const hits: DataHit[] = [];

        // 1. Search sessions collection
        const sessions = await db
          .collection("sessions")
          .find({ $or: [{ email: identifier }, { userId: identifier }] })
          .project({ _id: 1 })
          .toArray();

        if (sessions.length > 0) {
          hits.push({
            sourceSystem: "mongodb",
            table: "sessions",
            rowCount: sessions.length,
            fields: [
              { fieldName: "email", sensitivityTag: "pii" },
              { fieldName: "sessionToken", sensitivityTag: "system" },
              { fieldName: "ipAddress", sensitivityTag: "behavioral" },
            ],
            sampleIds: sessions.map((s) => s._id.toString()),
          });
        }

        // 2. Search activity_logs collection
        const activityLogs = await db
          .collection("activity_logs")
          .find({ $or: [{ email: identifier }, { userId: identifier }] })
          .project({ _id: 1 })
          .toArray();

        if (activityLogs.length > 0) {
          hits.push({
            sourceSystem: "mongodb",
            table: "activity_logs",
            rowCount: activityLogs.length,
            fields: [
              { fieldName: "event", sensitivityTag: "behavioral" },
              { fieldName: "payload", sensitivityTag: "behavioral" },
            ],
            sampleIds: activityLogs.map((l) => l._id.toString()),
          });
        }

        return hits;
      }

      async deleteRecords(
        identifier: string,
        mode: "delete" | "anonymize"
      ): Promise<DeletionResult[]> {
        const db = await getMongoDb();
        const results: DeletionResult[] = [];
        const filter = { $or: [{ email: identifier }, { userId: identifier }] };

        if (mode === "delete") {
          const sessResult = await db.collection("sessions").deleteMany(filter);
          results.push({
            sourceSystem: "mongodb",
            table: "sessions",
            affected: sessResult.deletedCount,
            mode: "delete",
          });

          const logResult = await db.collection("activity_logs").deleteMany(filter);
          results.push({
            sourceSystem: "mongodb",
            table: "activity_logs",
            affected: logResult.deletedCount,
            mode: "delete",
          });
        } else {
          const anonymized = {
            $set: { email: "anonymized@deleted.invalid", userId: "anonymized" },
          };
          const sessResult = await db.collection("sessions").updateMany(filter, anonymized);
          results.push({
            sourceSystem: "mongodb",
            table: "sessions",
            affected: sessResult.modifiedCount,
            mode: "anonymize",
          });

          const logResult = await db.collection("activity_logs").updateMany(filter, anonymized);
          results.push({
            sourceSystem: "mongodb",
            table: "activity_logs",
            affected: logResult.modifiedCount,
            mode: "anonymize",
          });
        }

        return results;
      }

      async getSchema(): Promise<SchemaInfo> {
        const db = await getMongoDb();
        const collections = await db.listCollections().toArray();
        const sessionCount = await db.collection("sessions").countDocuments();
        return {
          tables: collections.map((c) => c.name),
          recordCount: sessionCount,
        };
      }

      async ping(): Promise<boolean> {
        try {
          const db = await getMongoDb();
          await db.command({ ping: 1 });
          return true;
        } catch {
          return false;
        }
      }
    }
    ```
  </action>
  
  <acceptance_criteria>
    - src/adapters/mongodb.adapter.ts contains "implements DataAdapter"
    - src/adapters/mongodb.adapter.ts contains "readonly systemName: SystemName = \"mongodb\""
    - src/adapters/mongodb.adapter.ts contains "sessions"
    - src/adapters/mongodb.adapter.ts contains "activity_logs"
    - `npm run typecheck` exits 0
  </acceptance_criteria>
</task>
```

---

### Task 3.3 — Mock Payment Ledger Adapter

```xml
<task id="3.3">
  <title>Implement PaymentLedgerAdapter with in-memory data store</title>
  
  <read_first>
    - src/adapters/types.ts (DataAdapter interface)
    - .planning/phases/01-foundation-data-layer/01-RESEARCH.md (mock payment ledger design)
    - .planning/REQUIREMENTS.md (INFR-03: mock payment ledger seeded with data)
  </read_first>
  
  <action>
    1. Create src/adapters/payment.adapter.ts with EXACT content:
       ```typescript
       import type {
         DataAdapter,
         DataHit,
         DeletionResult,
         SchemaInfo,
         SystemName,
       } from "./types.js";

       export interface PaymentRecord {
         id: string;
         userId: string;
         email: string;
         amount: number;
         currency: string;
         status: "paid" | "refunded" | "pending";
         description: string;
         createdAt: string;
         subscriptionId?: string;
       }

       // In-memory store — loaded by seed script
       let ledger: PaymentRecord[] = [];

       export function loadLedger(records: PaymentRecord[]): void {
         ledger = [...records];
       }

       export function getLedger(): PaymentRecord[] {
         return ledger;
       }

       export class PaymentLedgerAdapter implements DataAdapter {
         readonly systemName: SystemName = "payment_ledger";

         async findByIdentifier(identifier: string): Promise<DataHit[]> {
           const matches = ledger.filter(
             (r) => r.email === identifier || r.userId === identifier
           );

           if (matches.length === 0) return [];

           const hasActiveSubscription = matches.some(
             (r) => r.status === "paid" && r.subscriptionId
           );

           return [
             {
               sourceSystem: "payment_ledger",
               table: "payment_records",
               rowCount: matches.length,
               fields: [
                 { fieldName: "email", sensitivityTag: "pii" },
                 { fieldName: "amount", sensitivityTag: "financial" },
                 { fieldName: "status", sensitivityTag: "financial" },
               ],
               sampleIds: matches.map((r) => r.id),
               hasOrphanRisk: hasActiveSubscription,
               orphanDetails: hasActiveSubscription
                 ? `${matches.filter((r) => r.subscriptionId).length} payment record(s) linked to active subscriptions`
                 : undefined,
             },
           ];
         }

         async deleteRecords(
           identifier: string,
           mode: "delete" | "anonymize"
         ): Promise<DeletionResult[]> {
           const before = ledger.length;

           if (mode === "delete") {
             ledger = ledger.filter(
               (r) => r.email !== identifier && r.userId !== identifier
             );
           } else {
             ledger = ledger.map((r) => {
               if (r.email === identifier || r.userId === identifier) {
                 return {
                   ...r,
                   email: "anonymized@deleted.invalid",
                   userId: "anonymized",
                 };
               }
               return r;
             });
           }

           const affected =
             mode === "delete"
               ? before - ledger.length
               : ledger.filter((r) => r.email === "anonymized@deleted.invalid").length;

           return [
             {
               sourceSystem: "payment_ledger",
               table: "payment_records",
               affected,
               mode,
             },
           ];
         }

         async getSchema(): Promise<SchemaInfo> {
           return {
             tables: ["payment_records"],
             recordCount: ledger.length,
           };
         }

         async ping(): Promise<boolean> {
           return true; // In-memory store is always available
         }
       }
       ```
  </action>
  
  <acceptance_criteria>
    - src/adapters/payment.adapter.ts contains "implements DataAdapter"
    - src/adapters/payment.adapter.ts contains "readonly systemName: SystemName = \"payment_ledger\""
    - src/adapters/payment.adapter.ts contains "export function loadLedger"
    - src/adapters/payment.adapter.ts contains "export function getLedger"
    - src/adapters/payment.adapter.ts contains "hasOrphanRisk"
    - `npm run typecheck` exits 0
  </acceptance_criteria>
</task>
```

---

### Task 3.4 — Postgres Seed Script (Schema + Data)

```xml
<task id="3.4">
  <title>Create Postgres seed script with schema creation and ~500 synthetic users</title>
  
  <read_first>
    - src/db/postgres.ts (query and withClient)
    - .planning/phases/01-foundation-data-layer/01-RESEARCH.md (Postgres schema — all 5 tables exact SQL)
    - .planning/REQUIREMENTS.md (INFR-01, INFR-04: idempotent, < 5 seconds)
  </read_first>
  
  <action>
    Create src/seed/postgres.seed.ts with EXACT content:
    ```typescript
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
    ```
  </action>
  
  <acceptance_criteria>
    - src/seed/postgres.seed.ts contains "export async function seedPostgres()"
    - src/seed/postgres.seed.ts contains "jane.doe@email.com"
    - src/seed/postgres.seed.ts contains "2 active subscription" (in comment or string)
    - src/seed/postgres.seed.ts contains "CREATE TABLE IF NOT EXISTS users"
    - src/seed/postgres.seed.ts contains "CREATE TABLE IF NOT EXISTS audit_log"
    - src/seed/postgres.seed.ts contains "DELETE FROM users" (idempotency)
    - src/seed/postgres.seed.ts contains "BATCH_SIZE"
    - `npm run typecheck` exits 0
  </acceptance_criteria>
</task>
```

---

### Task 3.5 — MongoDB & Payment Ledger Seed Scripts + Orchestrator

```xml
<task id="3.5">
  <title>Create MongoDB seed, payment ledger seed, and main seed orchestrator</title>
  
  <read_first>
    - src/db/mongodb.ts (getMongoDb function)
    - src/adapters/payment.adapter.ts (loadLedger function + PaymentRecord interface)
    - src/seed/postgres.seed.ts (pattern reference — follow same structure)
    - .planning/REQUIREMENTS.md (INFR-02, INFR-03, INFR-04)
  </read_first>
  
  <action>
    1. Create src/seed/mongodb.seed.ts:
       ```typescript
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
       ```

    2. Create src/seed/payment.seed.ts:
       ```typescript
       import { faker } from "@faker-js/faker";
       import { loadLedger, type PaymentRecord } from "../adapters/payment.adapter.js";

       export function seedPaymentLedger(): void {
         console.log("[seed:payment] Loading ledger...");

         const janePayments: PaymentRecord[] = [
           {
             id: faker.string.uuid(),
             userId: "jane-placeholder",
             email: "jane.doe@email.com",
             amount: 29.99,
             currency: "USD",
             status: "paid",
             description: "Pro Plan — Monthly",
             createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
             subscriptionId: "sub-pro-jane",
           },
           {
             id: faker.string.uuid(),
             userId: "jane-placeholder",
             email: "jane.doe@email.com",
             amount: 9.99,
             currency: "USD",
             status: "paid",
             description: "Storage Add-on — Monthly",
             createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
             subscriptionId: "sub-storage-jane",
           },
         ];

         const syntheticPayments: PaymentRecord[] = Array.from({ length: 150 }, () => ({
           id: faker.string.uuid(),
           userId: faker.string.uuid(),
           email: faker.internet.email().toLowerCase(),
           amount: faker.number.float({ min: 5, max: 200, fractionDigits: 2 }),
           currency: "USD",
           status: faker.helpers.arrayElement(["paid", "refunded", "pending"] as const),
           description: faker.commerce.productName(),
           createdAt: faker.date.past({ years: 1 }).toISOString(),
           subscriptionId: faker.datatype.boolean() ? faker.string.uuid() : undefined,
         }));

         loadLedger([...janePayments, ...syntheticPayments]);
         console.log(`[seed:payment] Loaded ${janePayments.length + syntheticPayments.length} records`);
       }
       ```

    3. Create src/seed/index.ts (orchestrator):
       ```typescript
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
       ```
  </action>
  
  <acceptance_criteria>
    - src/seed/mongodb.seed.ts contains "jane.doe@email.com"
    - src/seed/mongodb.seed.ts contains "export async function seedMongoDB"
    - src/seed/payment.seed.ts contains "export function seedPaymentLedger"
    - src/seed/payment.seed.ts contains "jane.doe@email.com"
    - src/seed/index.ts contains "import { seedPostgres }"
    - src/seed/index.ts contains "import { seedMongoDB }"
    - src/seed/index.ts contains "import { seedPaymentLedger }"
    - src/seed/index.ts contains "closePool"
    - `npm run typecheck` exits 0
  </acceptance_criteria>
</task>
```

---

### Task 3.6 — Adapter Registry & README

```xml
<task id="3.6">
  <title>Create adapter registry barrel export and project README</title>
  
  <read_first>
    - src/adapters/types.ts
    - src/adapters/postgres.adapter.ts
    - src/adapters/mongodb.adapter.ts
    - src/adapters/payment.adapter.ts
    - .planning/ROADMAP.md (Phase 3 will import adapter registry)
  </read_first>
  
  <action>
    1. Create src/adapters/index.ts (registry):
       ```typescript
       import { PostgresAdapter } from "./postgres.adapter.js";
       import { MongoDbAdapter } from "./mongodb.adapter.js";
       import { PaymentLedgerAdapter } from "./payment.adapter.js";
       import type { DataAdapter } from "./types.js";

       export * from "./types.js";
       export { PostgresAdapter } from "./postgres.adapter.js";
       export { MongoDbAdapter } from "./mongodb.adapter.js";
       export { PaymentLedgerAdapter, loadLedger, getLedger } from "./payment.adapter.js";

       /**
        * Registry of all connected data adapters.
        * Phase 3 scan_subject iterates this array for fan-out queries.
        * Add new adapters here to extend Warden's reach.
        */
       export function createAdapterRegistry(): DataAdapter[] {
         return [
           new PostgresAdapter(),
           new MongoDbAdapter(),
           new PaymentLedgerAdapter(),
         ];
       }
       ```

    2. Create README.md:
       ```markdown
       # Warden — Governed Data-Rights Execution Agent

       > An MCP agent that finds, proves, and executes a user's data-deletion or data-access rights across every system in your company — but it never acts without showing you the blast radius first, and every action it takes can be undone and independently audited.

       ## Quick Start

       ### Prerequisites
       - Node.js 22 LTS
       - Docker Desktop

       ### Setup

       \`\`\`bash
       # 1. Clone and install
       npm install

       # 2. Copy environment config
       cp .env.example .env

       # 3. Start databases
       docker compose up -d

       # 4. Wait for health checks, then seed
       npm run seed

       # 5. Start the server (Phase 3+)
       npm run dev
       \`\`\`

       ### Verify Setup
       \`\`\`bash
       # TypeScript compiles cleanly
       npm run typecheck

       # Databases are running
       docker compose ps
       \`\`\`

       ## Architecture

       | Component | Technology |
       |-----------|------------|
       | MCP Server | TypeScript + @modelcontextprotocol/sdk |
       | Primary DB | PostgreSQL 16 |
       | Secondary DB | MongoDB 7 |
       | Payment Ledger | In-memory mock |
       | Dashboard | Next.js 15 (Phase 5+) |

       ## Project Phases

       1. **Foundation & Data Layer** ← *current*
       2. Audit Logger (Hash Chain)
       3. MCP Server & Data Scanner
       4. Impact Report Engine
       5. Approval Gate & Dashboard
       6. Execute, Snapshot & Rollback
       7. Integrity Verification & Polish

       ## Demo Users

       | Email | Scenario |
       |-------|----------|
       | jane.doe@email.com | High-profile: data in ALL 3 systems, active subscriptions |
       | john.smith@email.com | Clean user: single system, safe to delete |
       | bob.wilson@email.com | Edge case: expired subscriptions, no payment records |
       ```
  </action>
  
  <acceptance_criteria>
    - src/adapters/index.ts contains "export function createAdapterRegistry()"
    - src/adapters/index.ts contains "new PostgresAdapter()"
    - src/adapters/index.ts contains "new MongoDbAdapter()"
    - src/adapters/index.ts contains "new PaymentLedgerAdapter()"
    - README.md contains "npm run seed"
    - README.md contains "jane.doe@email.com"
    - README.md contains "docker compose up -d"
    - `npm run typecheck` exits 0
  </acceptance_criteria>
</task>
```

---

## Verification Checklist

After all tasks complete, verify the following manually or by script:

```bash
# 1. TypeScript type check
npm run typecheck
# Expected: exits 0, zero errors

# 2. Docker services healthy
docker compose up -d
docker compose ps
# Expected: warden_postgres and warden_mongodb both show "healthy"

# 3. Seed data
npm run seed
# Expected: "=== Seed Complete in Xms ===" where X < 5000
# Expected: "Demo user: jane.doe@email.com — data in all 3 systems"

# 4. Verify jane.doe data in Postgres
# (requires psql or DBeaver)
# SELECT COUNT(*) FROM users WHERE email = 'jane.doe@email.com'; -- 1
# SELECT COUNT(*) FROM subscriptions s JOIN users u ON s.user_id = u.id WHERE u.email = 'jane.doe@email.com'; -- 2

# 5. Verify total user count
# SELECT COUNT(*) FROM users; -- ~500

# 6. Verify MongoDB sessions
# (requires mongosh)
# db.sessions.countDocuments({ email: "jane.doe@email.com" }) -- 8
```

---

## Files Modified

```
NEW: package.json
NEW: tsconfig.json
NEW: .env.example
NEW: .env
NEW: .gitignore
NEW: docker-compose.yml
NEW: README.md
NEW: src/index.ts
NEW: src/config.ts
NEW: src/db/postgres.ts
NEW: src/db/mongodb.ts
NEW: src/adapters/types.ts
NEW: src/adapters/postgres.adapter.ts
NEW: src/adapters/mongodb.adapter.ts
NEW: src/adapters/payment.adapter.ts
NEW: src/adapters/index.ts
NEW: src/seed/postgres.seed.ts
NEW: src/seed/mongodb.seed.ts
NEW: src/seed/payment.seed.ts
NEW: src/seed/index.ts
```

---

*Phase 1 Plan created: 2026-07-15*  
*Requirements coverage: INFR-01 ✓, INFR-02 ✓, INFR-03 ✓, INFR-04 ✓, INFR-05 ✓*
