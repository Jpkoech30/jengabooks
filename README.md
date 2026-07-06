<div align="center">
  <br />
  <div>
    <img src="https://img.shields.io/badge/NestJS-10-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS 10" />
    <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 18" />
    <img src="https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL 15" />
    <img src="https://img.shields.io/badge/Redis_7-FF4438?style=for-the-badge&logo=redis&logoColor=white" alt="Redis 7" />
    <img src="https://img.shields.io/badge/TypeScript_Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Prisma_5-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma 5" />
    <img src="https://img.shields.io/badge/Expo_51-000020?style=for-the-badge&logo=expo&logoColor=white" alt="Expo 51" />
    <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
    <img src="https://img.shields.io/badge/Turborepo-EF4444?style=for-the-badge&logo=turborepo&logoColor=white" alt="Turborepo" />
  </div>
  <br />
</div>

<h1 align="center">🏗️📚 JengaBooks</h1>

<p align="center">
  <strong>Kenya-first · AI-native · Offline-first accounting platform</strong>
  <br />
  Built for Kenyan SMEs, accounting firms, and enterprise partners.
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-api-reference">API</a> •
  <a href="#-deployment">Deployment</a>
</p>

<br />

---

## 🌟 Overview

JengaBooks is a **multi-tenant accounting SaaS** purpose-built for the Kenyan market. It treats **M-Pesa as a first-class citizen**, automates **KRA eTIMS** submissions, survives **offline environments**, and gamifies accounting to drive daily engagement.

> 🎯 **The 7 Pillars**
> 
> 1. 🛡️ **Immutable Audit & Uniqueness** — Postgres RLS, eTIMS serial enforcement, fiscal period controls
> 2. 📡 **Offline-First Sync** — Optimistic locking, NTP clock validation, token-scoped sync
> 3. 📊 **Adaptive Data Ingestion** — M-Pesa & Bank CSV parsing with column fingerprinting
> 4. 🤖 **Agentic AI** — 5 DeepSeek agents with auto-fallback to Suspense Account
> 5. 🔌 **Fault-Tolerant APIs** — Sliding window circuit breaker for KRA eTIMS
> 6. 🏗️ **Tenant Isolation** — Dynamic statement timeouts, `SKIP LOCKED` queries
> 7. 👤 **Human-in-the-Loop** — Centralized DLQ, Kanban dashboard, XP gamification

<br />

---

## ✨ Features

<table>
  <tr>
    <td width="50%">
      <h3>📱 M-Pesa Integration</h3>
      <ul>
        <li>CSV import with smart column fingerprinting</li>
        <li>Rule-based auto-categorization</li>
        <li>Reconciliation engine</li>
        <li>HITL auto-creation for low-confidence matches</li>
      </ul>
    </td>
    <td width="50%">
      <h3>🧾 KRA eTIMS</h3>
      <ul>
        <li>Invoice creation & submission</li>
        <li>Circuit breaker for KRA API failures</li>
        <li>Automatic retry with exponential backoff</li>
        <li>Queue-based async processing</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🤖 AI Agents (DeepSeek V4)</h3>
      <ul>
        <li><strong>Advisory</strong> — Business insights & recommendations</li>
        <li><strong>Compliance</strong> — IFRS/KRA compliance checks</li>
        <li><strong>Fraud Detection</strong> — Anomaly detection on transactions</li>
        <li><strong>HITL Resolution</strong> — Auto-resolve pending reviews</li>
        <li><strong>Reconciliation</strong> — Bank/M-Pesa matching</li>
      </ul>
    </td>
    <td width="50%">
      <h3>🎮 Gamification</h3>
      <ul>
        <li>XP points for transactions, reports, reviews</li>
        <li>50-level progression system with titles</li>
        <li>Achievement badges (9 unlockables)</li>
        <li>Company-wide leaderboards</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>📒 Double-Entry Ledger</h3>
      <ul>
        <li>Full journal entry management</li>
        <li>Chart of accounts with hierarchy</li>
        <li>Fiscal period enforcement</li>
        <li>Trial balance, P&L, balance sheet, cash flow</li>
      </ul>
    </td>
    <td width="50%">
      <h3>👥 Multi-Tenant RBAC</h3>
      <ul>
        <li>7 roles: SUPER_ADMIN → SME_OWNER</li>
        <li>Row-Level Security on every query</li>
        <li>Company switcher for multi-entity users</li>
        <li>Team management with granular permissions</li>
      </ul>
    </td>
  </tr>
</table>

<br />

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        JengaBooks Platform                        │
├────────────────────────┬─────────────────────────────────────────┤
│                        │                                         │
│    🌐 Web App (Vite)   │    📱 Mobile App (Expo/RN)              │
│    React 18 + Tailwind │    WatermelonDB + NativeWind             │
│    React Router · Axios│    Offline-first · Socket.io             │
│                        │                                         │
├────────────────────────┴─────────────────────────────────────────┤
│                    📦 Shared Package (@jengabooks/shared)           │
│            Types · Zod Schemas · RBAC Permissions · Theme Tokens   │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│    🚀 NestJS 10 API (Stateless · RLS-enabled)                    │
│                                                                   │
│    ┌─────────────┐ ┌──────────────┐ ┌──────────────────┐        │
│    │ Auth Module │ │ Ledger Module│ │ AI Module        │        │
│    │ JWT · Cookie│ │ Fiscal Period│ │ 5 DeepSeek Agents│        │
│    ├─────────────┤ ├──────────────┤ ├──────────────────┤        │
│    │ M-Pesa      │ │ eTIMS Module │ │ HITL Module      │        │
│    │ CSV Import  │ │ Circuit Brkr │ │ Kanban · Reviews │        │
│    └─────────────┘ └──────────────┘ └──────────────────┘        │
│                                                                   │
│    ┌──────────────────────┐  ┌──────────────────────────┐        │
│    │ 📤 BullMQ Queues     │  │ 🔌 Socket.io Gateway     │        │
│    │ Sync · AI · eTIMS    │  │ Real-time · Notifications │        │
│    └──────────────────────┘  └──────────────────────────┘        │
│                                                                   │
├────────────────────────┬─────────────────────────────────────────┤
│                        │                                         │
│   🗄️ PostgreSQL 15     │    ⚡ Redis 7 (AOF · RDB)               │
│   pgvector · RLS       │    BullMQ · Rate Limiting               │
│                        │    Circuit Breaker State                │
└────────────────────────┴─────────────────────────────────────────┘
```

<br />

---

## 🛠️ Tech Stack

<table>
  <thead>
    <tr>
      <th>Layer</th>
      <th>Technology</th>
      <th>Purpose</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Runtime</strong></td>
      <td><img src="https://img.shields.io/badge/Node.js_24-339933?logo=nodedotjs&logoColor=white" alt="Node.js" /></td>
      <td>JavaScript runtime with TypeScript strict mode</td>
    </tr>
    <tr>
      <td><strong>Backend</strong></td>
      <td><img src="https://img.shields.io/badge/NestJS_10-E0234E?logo=nestjs&logoColor=white" alt="NestJS" /></td>
      <td>Modular server framework with DI, guards, interceptors</td>
    </tr>
    <tr>
      <td><strong>Database</strong></td>
      <td><img src="https://img.shields.io/badge/PostgreSQL_15-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" /> + pgvector</td>
      <td>Primary data store with Row-Level Security</td>
    </tr>
    <tr>
      <td><strong>ORM</strong></td>
      <td><img src="https://img.shields.io/badge/Prisma_5-2D3748?logo=prisma&logoColor=white" alt="Prisma" /></td>
      <td>Type-safe database access & migrations</td>
    </tr>
    <tr>
      <td><strong>Cache & Queue</strong></td>
      <td><img src="https://img.shields.io/badge/Redis_7-FF4438?logo=redis&logoColor=white" alt="Redis" /> + BullMQ</td>
      <td>Job queues, rate limiting, circuit breaker state</td>
    </tr>
    <tr>
      <td><strong>AI</strong></td>
      <td><img src="https://img.shields.io/badge/DeepSeek_V4-4F46E5?logo=deepseek&logoColor=white" alt="DeepSeek" /></td>
      <td>5 specialized AI agents (Pro + Flash models)</td>
    </tr>
    <tr>
      <td><strong>Web Frontend</strong></td>
      <td><img src="https://img.shields.io/badge/React_18-61DAFB?logo=react&logoColor=black" alt="React" /> + Vite + TailwindCSS</td>
      <td>SPA dashboard with responsive design</td>
    </tr>
    <tr>
      <td><strong>Mobile</strong></td>
      <td><img src="https://img.shields.io/badge/Expo_51-000020?logo=expo&logoColor=white" alt="Expo" /> + NativeWind</td>
      <td>Cross-platform mobile app</td>
    </tr>
    <tr>
      <td><strong>Offline DB</strong></td>
      <td>WatermelonDB</td>
      <td>Local-first sync database for mobile</td>
    </tr>
    <tr>
      <td><strong>Real-time</strong></td>
      <td><img src="https://img.shields.io/badge/Socket.io-010101?logo=socketdotio&logoColor=white" alt="Socket.io" /></td>
      <td>Live notifications & sync events</td>
    </tr>
    <tr>
      <td><strong>Auth</strong></td>
      <td>JWT + httpOnly Cookies</td>
      <td>Stateless auth with refresh token rotation</td>
    </tr>
    <tr>
      <td><strong>Monorepo</strong></td>
      <td><img src="https://img.shields.io/badge/Turborepo-EF4444?logo=turborepo&logoColor=white" alt="Turborepo" /></td>
      <td>Workspace orchestration & caching</td>
    </tr>
  </tbody>
</table>

<br />

---

## 📁 Project Structure

```
jengabooks/
│
├── apps/
│   ├── api/                    # 🚀 NestJS Backend
│   │   ├── prisma/             # Schema, migrations, seeds
│   │   └── src/
│   │       ├── common/         # Decorators, filters, interceptors
│   │       ├── config/         # Database, Redis configuration
│   │       ├── modules/        # Feature modules
│   │       │   ├── auth/       # JWT auth, refresh, switch-company
│   │       │   ├── ledger/     # Journal entries, accounts, periods
│   │       │   ├── mpesa/      # CSV import, categorization
│   │       │   ├── etims/      # KRA invoice submission
│   │       │   ├── ai/         # 5 DeepSeek AI agents
│   │       │   ├── hitl/       # Human-in-the-Loop reviews
│   │       │   ├── gamification/# XP, levels, badges, leaderboard
│   │       │   ├── reports/    # P&L, Balance Sheet, Cash Flow
│   │       │   ├── sync/       # Offline sync endpoints
│   │       │   └── tenants/    # Multi-tenant management
│   │       ├── prisma/         # Prisma service module
│   │       └── queues/         # BullMQ queue definitions
│   │
│   ├── web/                    # 🌐 Web Frontend
│   │   └── src/
│   │       ├── components/     # UI components, forms, layout
│   │       ├── pages/          # Route pages (12 routes)
│   │       ├── hooks/          # React Query hooks
│   │       ├── stores/         # Zustand state stores
│   │       └── lib/            # API client, types, utils
│   │
│   └── mobile/                 # 📱 Mobile App
│       └── src/
│           ├── app/            # Expo Router pages
│           ├── components/     # Mobile UI components
│           ├── hooks/          # Mobile hooks
│           ├── stores/         # Mobile state stores
│           └── lib/            # API client, offline DB
│
├── packages/
│   └── shared/                 # 📦 Shared Package
│       └── src/                # Types, Zod schemas, RBAC, theme
│
├── docker-compose.yml          # 🐳 Local dev (Postgres + Redis)
├── turbo.json                  # ⚡ Turborepo configuration
└── package.json                # 📋 Monorepo root
```

<br />

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version | Required for |
|------|---------|-------------|
| <img src="https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs&logoColor=white" /> | >= 20.0.0 | Runtime |
| <img src="https://img.shields.io/badge/npm-11-FF4438?logo=npm&logoColor=white" /> | 11.x | Package management |
| <img src="https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white" /> | 15+ | Database |
| <img src="https://img.shields.io/badge/Redis-7-FF4438?logo=redis&logoColor=white" /> | 7+ | Queues & caching |

### 🏁 One-time Setup

```bash
# 1. Clone & install
git clone https://github.com/Jpkoech30/jengabooks.git
cd jengabooks
npm install

# 2. Configure environment
cp .env.example apps/api/.env
# Edit apps/api/.env with your database credentials

# 3. Start infrastructure (Docker)
docker-compose up -d

# 4. Run database migrations
cd apps/api && npx prisma migrate dev

# 5. Seed demo data
npx ts-node prisma/seed.ts

# 6. Start development (from root)
npm run dev
```

### 🖥️ Without Docker

If you have PostgreSQL and Redis installed natively:

```bash
# 1. Create the database
psql -U postgres -c "CREATE DATABASE jengabooks;"

# 2. Configure .env
# apps/api/.env:
# DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/jengabooks"
# PORT=3001
# JWT_SECRET=your-secure-secret-here

# 3. Run migrations
cd apps/api && npx prisma migrate dev

# 4. Seed & start
npx ts-node prisma/seed.ts
cd ../.. && npm run dev
```

### 🔐 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| **Firm Owner** | `admin@jengabooks.com` | `password123` |

<br />

---

## 🌐 API Reference

All endpoints are prefixed with `/api/v1` and protected with JWT authentication (except login & register).

### 🔑 Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/auth/login` | Sign in with email + password |
| `POST` | `/api/v1/auth/register` | Create account + company |
| `POST` | `/api/v1/auth/refresh` | Refresh JWT token |
| `POST` | `/api/v1/auth/logout` | Clear session |
| `GET` | `/api/v1/auth/profile` | Get user profile + memberships |
| `POST` | `/api/v1/auth/switch-company` | Switch active company |

### 📒 Ledger

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/ledger/accounts` | List chart of accounts |
| `POST` | `/api/v1/ledger/accounts` | Create account |
| `GET` | `/api/v1/ledger/entries` | List journal entries |
| `POST` | `/api/v1/ledger/entries` | Create journal entry |
| `POST` | `/api/v1/ledger/transactions/income` | Quick income entry |
| `POST` | `/api/v1/ledger/transactions/expense` | Quick expense entry |
| `GET` | `/api/v1/ledger/trial-balance` | Trial balance report |
| `GET` | `/api/v1/ledger/periods` | Fiscal periods |

### 💰 M-Pesa

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/mpesa/import` | Import CSV transactions |
| `GET` | `/api/v1/mpesa` | List transactions |
| `POST` | `/api/v1/mpesa/:txId/map` | Map to account |

### 🧾 eTIMS

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/etims/invoices` | List invoices |
| `POST` | `/api/v1/etims/invoices` | Create invoice |
| `POST` | `/api/v1/etims/submissions/:id/submit` | Submit to KRA |

### 🤖 AI

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/ai/process` | Trigger AI processing |
| `POST` | `/api/v1/ai/feedback` | Submit feedback |

### 👤 HITL (Human-in-the-Loop)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/hitl` | List reviews (with filters) |
| `POST` | `/api/v1/hitl` | Create review |
| `POST` | `/api/v1/hitl/:id/assign` | Claim task |
| `POST` | `/api/v1/hitl/:id/resolve` | Resolve with action + XP |

### 🏆 Gamification

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/gamification/profile` | User XP, level, badges |
| `GET` | `/api/v1/gamification/badges` | Earned & available badges |
| `GET` | `/api/v1/gamification/leaderboard` | Company ranking |

### 📊 Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/reports/profit-loss` | Profit & Loss statement |
| `GET` | `/api/v1/reports/balance-sheet` | Balance sheet |
| `GET` | `/api/v1/reports/trial-balance` | Trial balance |
| `GET` | `/api/v1/reports/cash-flow` | Cash flow statement |

<br />

---

## 🎮 Gamification System

### Level Progression

| Level Range | Title | XP Required |
|-------------|-------|-------------|
| 1–5 | 🪜 Apprentice | 0 – 1,000 |
| 6–10 | 📚 Bookkeeper | 1,500 – 4,500 |
| 11–20 | 🧮 Accountant | 5,500 – 19,000 |
| 21–30 | 💼 Finance Pro | 21,000 – 43,500 |
| 31–50 | 🏆 Business Master | 46,500 – 122,500 |

### Badges

| Badge | Trigger | XP |
|-------|---------|----|
| 📚 **Accountant** | Set up Chart of Accounts | 25 |
| 📱 **M-Pesa Connected** | Connect M-Pesa number | 25 |
| 📊 **Data Driven** | Import first CSV | 25 |
| 💰 **First Income** | Record first income | 25 |
| 💳 **First Expense** | Record first expense | 25 |
| 🛡️ **Tax Compliant** | Submit first eTIMS invoice | 50 |
| 👥 **Team Player** | Invite team member | 25 |
| 📈 **Analyst** | Generate first report | 25 |

<br />

---

## 👥 RBAC Roles

| Role | Level | Description |
|------|-------|-------------|
| `SUPER_ADMIN` | 🔴 Platform | Full system access, DevOps |
| `FIRM_OWNER` | 🟣 Partner | Accounting firm ownership |
| `TENANT_ADMIN` | 🟠 Admin | Tenant internal administration |
| `ACCOUNTANT` | 🔵 Staff | Daily accounting operations |
| `SME_OWNER` | 🟢 Business | SME business owner view |
| `AUDITOR` | 🟡 External | Read-only audit access |
| `BANK_OFFICER` | ⚪ Loan | Loan portfolio view |

<br />

---

## ☁️ Deployment

Target: **Vultr Johannesburg** (South Africa)

### Tier 1 — Single VM

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Tier 2 — Horizontal Scaling

```
Vultr Load Balancer
    ├── Node.js VM 1 (API + Web)
    ├── Node.js VM 2 (API + Web)
    └── Node.js VM n (Workers)
```

### Tier 3 — High Availability

```
Vultr Managed PostgreSQL → Replica set
Vultr Managed Redis      → Cluster
Vultr Object Storage     → Backups
```

<br />

---

## 📝 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `PORT` | ❌ | `3000` | API server port |
| `JWT_SECRET` | ✅ | — | JWT signing secret |
| `REDIS_HOST` | ❌ | `localhost` | Redis host |
| `REDIS_PORT` | ❌ | `6379` | Redis port |
| `DEEPSEEK_API_KEY` | ⚠️ | — | Required for AI features |
| `KRA_CLIENT_ID` | ⚠️ | — | Required for eTIMS |
| `CORS_ORIGIN` | ❌ | `http://localhost:5173` | Allowed CORS origin |

<br />

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

<br />

---

## 📄 License

**Private** · JengaBooks Inc. © 2026

---

<p align="center">
  <strong>Built with 💚 for Kenyan businesses</strong>
  <br />
  <sub>Nairobi · Mombasa · Kisumu · Eldoret</sub>
</p>
