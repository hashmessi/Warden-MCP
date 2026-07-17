# Phase 1 Research: Foundation & Data Layer

**Phase:** 1 — Foundation & Data Layer  
**Researched:** 2026-07-15  
**Requirements addressed:** INFR-01, INFR-02, INFR-03, INFR-04, INFR-05

---

## Executive Summary

Phase 1 is pure infrastructure scaffolding: TypeScript project, database connections (Postgres + MongoDB + mock payment ledger), typed adapter interfaces, and rich seed data. No MCP tools yet — just the reliable foundation every subsequent phase builds on. The key technical decision is establishing a clean adapter abstraction that future phases can call without touching raw DB drivers.

---

## Technology Stack (Confirmed from STATE.md)

| Layer | Choice | Version |
|-------|--------|---------|
| Language | TypeScript | 5.x |
| MCP SDK | `@modelcontextprotocol/sdk` | latest |
| Postgres driver | `pg` + `@types/pg` | latest |
| MongoDB driver | `mongodb` | latest |
| Validation | `zod` | 3.x |
| Runtime | Node.js | 22 LTS |
| Dev tooling | `tsx` (dev run) + `tsc` (build) | latest |
| Containerization | Docker Compose | v2 |
| Fake data | `@faker-js/faker` | latest |

---

## Project Scaffold Structure

```
warden/
├── src/
│   ├── adapters/
│   │   ├── types.ts           # DataAdapter interface
│   │   ├── postgres.adapter.ts
│   │   ├── mongodb.adapter.ts
│   │   └── payment.adapter.ts
│   ├── db/
│   │   ├── postgres.ts        # PG pool singleton
│   │   └── mongodb.ts         # Mongo client singleton
│   ├── seed/
│   │   ├── index.ts           # Seed orchestrator
│   │   ├── postgres.seed.ts
│   │   ├── mongodb.seed.ts
│   │   └── payment.seed.ts
│   └── index.ts               # Entry point (placeholder)
├── docker-compose.yml
├── .env.example
├── tsconfig.json
├── package.json
└── README.md
```

---

## Database Schema Design

### Postgres (Primary — User Data)

5 tables to create data scatter for demo user (jane.doe@email.com):

```sql
-- users (master identity table)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- user_profiles (PII-rich table)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  date_of_birth DATE,
  phone VARCHAR(50),
  address TEXT,
  country VARCHAR(100)
);

-- subscriptions (creates orphan risk for demo)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  plan VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'active', -- active | cancelled | expired
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- user_activity (behavioral data)
CREATE TABLE user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- audit_log (append-only — populated in Phase 2)
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action VARCHAR(100) NOT NULL,
  actor VARCHAR(255) NOT NULL,
  subject_hash VARCHAR(64),      -- SHA-256 of subject identifier
  details JSONB,
  prev_hash VARCHAR(64),
  hash VARCHAR(64) NOT NULL
);
```

### MongoDB (Sessions & Logs)

Collection: `sessions`
```json
{
  "_id": ObjectId,
  "userId": "uuid-string",
  "email": "user@example.com",
  "sessionToken": "token-hash",
  "loginAt": ISODate,
  "expiresAt": ISODate,
  "ipAddress": "string",
  "userAgent": "string",
  "isActive": true
}
```

Collection: `activity_logs`
```json
{
  "_id": ObjectId,
  "userId": "uuid-string",
  "event": "page_view | click | api_call",
  "payload": {},
  "timestamp": ISODate
}
```

### Mock Payment Ledger (In-Memory JSON / SQLite)

Simple JSON file or in-memory store (not a real DB):
```typescript
interface PaymentRecord {
  id: string;
  userId: string;
  email: string;
  amount: number;
  currency: string;
  status: "paid" | "refunded" | "pending";
  createdAt: string;
  subscriptionId?: string;
}
```

---

## DataAdapter Interface Design

Critical for multi-system fan-out in Phase 3. All adapters implement the same interface:

```typescript
export interface FieldHit {
  fieldName: string;
  sensitivityTag: "pii" | "financial" | "behavioral" | "system";
  sample?: string; // redacted sample for display
}

export interface DataHit {
  sourceSystem: "postgres" | "mongodb" | "payment_ledger";
  table: string;        // table or collection name
  rowCount: number;
  fields: FieldHit[];
  sampleIds: string[];  // row IDs for snapshot in Phase 6
}

export interface DataAdapter {
  readonly systemName: string;
  
  /** Find all records referencing the given identifier (email or userId) */
  findByIdentifier(identifier: string): Promise<DataHit[]>;
  
  /** Delete or anonymize records for the given identifier */
  deleteRecords(identifier: string, mode: "delete" | "anonymize"): Promise<{ affected: number }>;
  
  /** Return schema info for display in impact report */
  getSchema(): Promise<{ tables: string[]; recordCount: number }>;
  
  /** Health check */
  ping(): Promise<boolean>;
}
```

---

## Seed Data Strategy

### Key Users (Demoable)

1. **jane.doe@email.com** — "high-profile" user with data in ALL 3 systems:
   - 2 active Postgres subscriptions (creates orphan risk narrative)
   - Session records in MongoDB
   - Payment history in mock ledger
   - Activity logs across 5 behavioral categories

2. **john.smith@email.com** — "clean" user (single system, easy deletion)

3. **bob.wilson@email.com** — "edge case" user (deleted subscriptions, no payment records)

4. **~497 other synthetic users** — filled with faker data to make scan counts realistic

### Seed Script Requirements
- Idempotent: `DELETE FROM users WHERE TRUE` then reinsert — safe to re-run
- Sub-5-second execution (faker generation is fast; 500 rows is trivial)
- Single command: `npm run seed`

---

## Environment Variables

```bash
# .env.example
POSTGRES_URL=postgresql://warden:warden_dev@localhost:5432/warden_db
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB=warden_db
NODE_ENV=development
```

---

## Docker Compose Design

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: warden
      POSTGRES_PASSWORD: warden_dev
      POSTGRES_DB: warden_db
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U warden -d warden_db"]
      interval: 5s
      timeout: 5s
      retries: 5

  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 5s
      timeout: 5s
      retries: 5
```

---

## tsconfig.json Key Settings

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
    "resolveJsonModule": true
  }
}
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Docker not available on target machine | Document manual Postgres/Mongo install path |
| Port conflicts (5432/27017) | Configurable ports via env vars |
| Seed runs too slowly | Use batch inserts (`INSERT INTO ... VALUES (batch)`) not row-by-row |
| Type drift between adapter and actual DB schema | Generate TypeScript interfaces from schema in seed file |

---

## Validation Architecture

### Phase 1 Verification Checklist

```
[ ] tsc --noEmit exits 0 (no TypeScript errors)
[ ] docker compose up -d starts both services with health checks green
[ ] npm run seed completes in < 5 seconds
[ ] SELECT COUNT(*) FROM users returns ~500
[ ] db.sessions.countDocuments({}) returns > 0 in MongoDB
[ ] jane.doe@email.com has records in users, user_profiles, subscriptions, user_activity, sessions, and payment_ledger
[ ] DataAdapter interface is defined and all 3 implementations have no TypeScript errors
[ ] .env.example exists with all required keys
```

---

## ## RESEARCH COMPLETE

Phase 1 is a well-understood infrastructure problem. No major unknowns. Recommend proceeding directly to planning.
