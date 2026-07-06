# JengaBooks 🏗️📚

**Kenya-first, AI-native, offline-first accounting platform.**

JengaBooks is a multi-tenant accounting SaaS built specifically for Kenyan SMEs, accounting firms, and enterprise partners. It treats M-Pesa as a first-class citizen, automates KRA eTIMS submissions, survives offline environments, and gamifies accounting to drive daily engagement.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    JengaBooks Platform                    │
├───────────────────┬─────────────────────────────────────┤
│   Web App (Vite)  │   Mobile App (Expo/React Native)    │
│   React + Shadcn  │   WatermelonDB + NativeWind         │
├───────────────────┴─────────────────────────────────────┤
│              Shared Package (@jengabooks/shared)         │
│         Types · Zod Schemas · RBAC · Theme Tokens        │
├─────────────────────────────────────────────────────────┤
│          NestJS API (Stateless, RLS-enabled)             │
│     Prisma ORM · BullMQ Queues · Socket.io Gateway       │
├───────────────────┬─────────────────────────────────────┤
│   PostgreSQL 15    │         Redis 7 (AOF)              │
│   pgvector · RLS   │   BullMQ · Circuit Breaker         │
└───────────────────┴─────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 20 LTS + TypeScript (Strict) |
| **Backend Framework** | NestJS 10 |
| **Database** | PostgreSQL 15 + pgvector |
| **ORM** | Prisma 5 |
| **Cache & Queue** | Redis 7 + BullMQ |
| **AI** | DeepSeek V4 (Pro + Flash models) |
| **Web Frontend** | React 18 + Vite + TailwindCSS |
| **Mobile** | Expo 51 + React Native 0.74 + NativeWind |
| **Offline DB** | WatermelonDB |
| **Real-time** | Socket.io |
| **Auth** | JWT (Passport.js) |

## The 7 Pillars

1. **Immutable Audit & Uniqueness** — Postgres RLS, eTIMS serial uniqueness, fiscal period enforcement
2. **Bulletproof Offline-First Sync** — Optimistic locking, NTP clock validation, sync token scoping
3. **Adaptive Data Ingestion** — M-Pesa/Bank CSV parsing with column fingerprinting
4. **Agentic AI with Self-Healing** — 5 DeepSeek agents with auto-fallback to Suspense Account
5. **Fault-Tolerant External APIs** — Sliding window circuit breaker for KRA eTIMS
6. **Tenant Performance Isolation** — Dynamic statement timeouts, SKIP LOCKED queries
7. **Unified Human-in-the-Loop** — Centralized DLQ, Kanban dashboard, XP gamification

## Project Structure

```
jengabooks/
├── apps/
│   ├── api/              # NestJS backend (30+ modules)
│   ├── web/              # React/Vite web frontend (27 files)
│   └── mobile/           # Expo/React Native mobile (28 files)
├── packages/
│   └── shared/           # Types, Zod schemas, RBAC, theme
├── docker-compose.yml    # Local dev stack (Postgres + Redis)
├── turbo.json            # Turborepo pipeline
└── package.json          # Monorepo root
```

## Getting Started

### Prerequisites
- Node.js >= 20.0.0
- Docker Desktop (for Postgres + Redis)

### Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start infrastructure
docker-compose up -d

# 3. Run database migrations
cd apps/api && npx prisma migrate dev

# 4. Seed demo data
npx ts-node prisma/seed.ts

# 5. Start development
npm run dev
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=jengabooks
DB_USER=admin
DB_PASSWORD=changeme

REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=your-jwt-secret-here
DEEPSEEK_API_KEY=your-api-key-here
KRA_CLIENT_ID=your-client-id
AT_API_KEY=your-api-key
```

## RBAC Matrix

7 user roles with granular permissions across 11 modules:

| Role | Description |
|------|-------------|
| `SUPER_ADMIN` | Platform admin, DevOps access |
| `FIRM_OWNER` | Accounting firm partner |
| `TENANT_ADMIN` | Tenant internal admin |
| `ACCOUNTANT` | Staff accountant |
| `SME_OWNER` | Business owner |
| `AUDITOR` | External auditor / KRA |
| `BANK_OFFICER` | Bank loan officer |

## API Endpoints

| Prefix | Module | Description |
|--------|--------|-------------|
| `/api/v1/auth` | Auth | Login, JWT tokens |
| `/api/v1/tenants` | Tenants | Multi-tenant CRUD |
| `/api/v1/ledger` | Ledger | Journal entries, fiscal periods |
| `/api/v1/etims` | eTIMS | KRA invoice submission |
| `/api/v1/mpesa` | M-Pesa | CSV upload, reconciliation |
| `/api/v1/ai` | AI | Agent triggers, feedback |
| `/api/v1/sync` | Sync | Offline sync endpoints |
| `/api/v1/hitl` | HITL | Pending reviews, gamification |

## Deployment (Vultr)

```bash
# Tier 1: Single VM
docker-compose -f docker-compose.prod.yml up -d

# Tier 2: Horizontal scaling
# Add Node.js VMs behind Vultr Load Balancer

# Tier 3: High Availability
# Vultr Managed Postgres + Redis + Object Storage
```

## License

Private · JengaBooks Inc.
