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
    <img src="https://img.shields.io/badge/Tests-234_✔️-0A5C36?style=for-the-badge" alt="234 Tests" />
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
  <a href="#-testing">Testing</a> •
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
        <li>CSV/PDF/XLSX import with smart column fingerprinting</li>
        <li>Rule-based + AI-powered auto-categorization</li>
        <li>Reconciliation engine (exact/fuzzy/amount-only matching)</li>
        <li>HITL auto-creation for low-confidence matches</li>
        <li>3-tier confidence UI (Green ✓ / Amber ~ / Red !)</li>
        <li>Auto-post journal entries for ≥90% confidence</li>
      </ul>
    </td>
    <td width="50%">
      <h3>🧾 KRA eTIMS</h3>
      <ul>
        <li>Invoice creation & submission</li>
        <li>KRA PIN format validation (A123456789B)</li>
        <li>Circuit breaker for KRA API failures</li>
        <li>Automatic retry with exponential backoff</li>
        <li>Queue-based async processing</li>
        <li>VAT calculation (16% Standard, 0% Exempt/Zero-rated)</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🤖 AI Agents (DeepSeek V4)</h3>
      <ul>
        <li><strong>Reconciliation</strong> — Auto-map transactions to accounts</li>
        <li><strong>Compliance</strong> — KRA eTIMS & IFRS validation</li>
        <li><strong>Fraud Detection</strong> — Nightly batch anomaly scanning</li>
        <li><strong>Advisory</strong> — Business insights & recommendations</li>
        <li><strong>HITL Resolution</strong> — Auto-resolve simple conflicts</li>
      </ul>
    </td>
    <td width="50%">
      <h3>🎮 Gamification</h3>
      <ul>
        <li>50-level progression system with titles</li>
        <li>9 achievement badges (auto-earned from activity)</li>
        <li>Sync Streak tracking</li>
        <li>Early Bird XP bonus (reports before 5th)</li>
        <li>Company-wide leaderboards</li>
        <li>Flawless Finisher trophy (lockdown ceremony)</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>📒 Double-Entry Ledger</h3>
      <ul>
        <li>Full journal entry management</li>
        <li>Chart of accounts with hierarchy</li>
        <li>Fiscal period enforcement with lockdown ceremony</li>
        <li>Trial balance, P&L, balance sheet, cash flow</li>
        <li>Recurring journal entry templates</li>
        <li>Period-over-period comparison with variance</li>
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
  <tr>
    <td width="50%">
      <h3>🔄 Monthly Workflow</h3>
      <ul>
        <li>5-phase bookkeeping tracker: Data → Categorize → Reconcile → Close → Report</li>
        <li>Real-time progress bar per client</li>
        <li>Phase-by-phase action links</li>
        <li>Automated status detection from live data</li>
      </ul>
    </td>
    <td width="50%">
      <h3>📊 Reporting</h3>
      <ul>
        <li>Profit & Loss, Balance Sheet, Cash Flow</li>
        <li>Bank-grade loan application format</li>
        <li>Period-over-period comparison</li>
        <li>CSV export with nested data handling</li>
        <li>Shareable report links (24-hour expiry)</li>
        <li>Duplicate payment detection</li>
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
│    │ Reconciliation       │  │ Batch/QA                 │        │
│    │ Matching Engine      │  │ Nightly Fraud Detection  │        │
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
      <td>Node.js 20+</td>
      <td>JavaScript runtime with TypeScript strict mode</td>
    </tr>
    <tr>
      <td><strong>Backend</strong></td>
      <td>NestJS 10</td>
      <td>Modular server framework with DI, guards, interceptors</td>
    </tr>
    <tr>
      <td><strong>Database</strong></td>
      <td>PostgreSQL 15 + pgvector</td>
      <td>Primary data store with Row-Level Security</td>
    </tr>
    <tr>
      <td><strong>ORM</strong></td>
      <td>Prisma 5</td>
      <td>Type-safe database access & migrations</td>
    </tr>
    <tr>
      <td><strong>Cache & Queue</strong></td>
      <td>Redis 7 + BullMQ</td>
      <td>Job queues, rate limiting, circuit breaker state</td>
    </tr>
    <tr>
      <td><strong>AI</strong></td>
      <td>DeepSeek V4</td>
      <td>5 specialized AI agents (Pro + Flash models)</td>
    </tr>
    <tr>
      <td><strong>Web Frontend</strong></td>
      <td>React 18 + Vite + TailwindCSS</td>
      <td>SPA dashboard with responsive design</td>
    </tr>
    <tr>
      <td><strong>Mobile</strong></td>
      <td>Expo 51 + NativeWind</td>
      <td>Cross-platform mobile app</td>
    </tr>
    <tr>
      <td><strong>Offline DB</strong></td>
      <td>WatermelonDB</td>
      <td>Local-first sync database for mobile</td>
    </tr>
    <tr>
      <td><strong>Real-time</strong></td>
      <td>Socket.io</td>
      <td>Live notifications & sync events</td>
    </tr>
    <tr>
      <td><strong>Auth</strong></td>
      <td>JWT + httpOnly Cookies</td>
      <td>Stateless auth with refresh token rotation</td>
    </tr>
    <tr>
      <td><strong>Monorepo</strong></td>
      <td>Turborepo</td>
      <td>Workspace orchestration & caching</td>
    </tr>
    <tr>
      <td><strong>Testing</strong></td>
      <td>Jest 29 + Supertest</td>
      <td>Unit, integration, and E2E testing</td>
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
│   │       ├── modules/        # Feature modules (13 total)
│   │       │   ├── auth/       # JWT auth, refresh, switch-company
│   │       │   ├── ledger/     # Journal entries, accounts, periods, recurring
│   │       │   ├── mpesa/      # CSV/PDF import, categorization, file parser
│   │       │   ├── etims/      # KRA invoice submission, circuit breaker
│   │       │   ├── ai/         # 5 DeepSeek AI agents + batch service
│   │       │   ├── hitl/       # Human-in-the-Loop reviews
│   │       │   ├── gamification/# XP, levels, badges, streaks, leaderboard
│   │       │   ├── reports/    # P&L, Balance Sheet, Cash Flow, comparisons
│   │       │   ├── reconciliation/ # Transaction matching engine
│   │       │   ├── sync/       # Offline sync endpoints
│   │       │   ├── tenants/    # Multi-tenant management
│   │       │   ├── wizard/     # Onboarding wizard
│   │       │   ├── health-score/ # Business health scoring
│   │       │   └── workflow/   # Workflow dashboard logic
│   │       ├── prisma/         # Prisma service module
│   │       ├── queues/         # BullMQ queue definitions
│   │       └── e2e/            # End-to-end integration tests
│   │
│   ├── web/                    # 🌐 Web Frontend
│   │   └── src/
│   │       ├── components/     # UI components, forms, layout
│   │       ├── pages/          # Route pages (13 routes)
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
│       └── src/                # Types, Zod schemas, RBAC, theme, helpers
│
├── plans/                      # 📋 Architecture plans & audit docs
├── docker-compose.yml          # 🐳 Local dev (Postgres + Redis)
├── turbo.json                  # ⚡ Turborepo configuration
└── package.json                # 📋 Monorepo root
```

<br />

---

## 🚀 Quick Start

Choose your environment below.

---

### 🐧 Option A: Linux Native (PostgreSQL + Redis on host)

Best for: Linux workstations, CI/CD runners, production servers.

#### Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | >= 20.0.0 | `node --version` |
| npm | 11.x | `npm --version` |
| PostgreSQL | 15+ | `psql --version` |
| Redis | 7+ | `redis-cli --version` |

#### Setup

```bash
# 1. Clone & install
git clone https://github.com/Jpkoech30/jengabooks.git
cd jengabooks
npm install

# 2. Configure environment
cp .env.example apps/api/.env

# 3. Create the database
sudo -u postgres psql -c "CREATE DATABASE jengabooks;"

# 4. Run database migrations
cd apps/api && npx prisma migrate dev

# 5. Seed demo data
npx ts-node prisma/seed.ts

# 6. Start development (from root)
cd ../.. && npm run dev
```

**Connection config** (`.env` / `apps/api/.env`):
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/jengabooks?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

### 🐳 Option B: Windows + Docker (PostgreSQL + Redis in containers)

Best for: Windows workstations with Docker Desktop.

#### Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | >= 20.0.0 | `node --version` |
| npm | 11.x | `npm --version` |
| Docker Desktop | Latest | `docker --version` |

#### Setup

```bash
# 1. Clone & install
git clone https://github.com/Jpkoech30/jengabooks.git
cd jengabooks
npm install

# 2. Configure environment
cp .env.example apps/api/.env

# 3. Start infrastructure (Docker)
docker-compose up -d

# 4. Run database migrations
cd apps/api && npx prisma migrate dev

# 5. Seed demo data
npx ts-node prisma/seed.ts

# 6. Start development (from root)
cd ../.. && npm run dev
```

**Connection config** (`.env` / `apps/api/.env`):
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/jengabooks?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379
```

> Docker Desktop on Windows maps container ports to `localhost` by default — no special config needed.

---

### 🪟 Option C: Windows + WSL (PostgreSQL + Redis inside WSL)

Best for: Windows workstations running services natively in WSL without Docker.

#### Prerequisites

| Tool | Version | Check | Where |
|------|---------|-------|-------|
| Node.js | >= 20.0.0 | `node --version` | **Windows** |
| npm | 11.x | `npm --version` | **Windows** |
| WSL distro | Ubuntu 24.04+ | `wsl -l -v` | **Windows** |
| PostgreSQL | 15+ | `psql --version` | **WSL** (inside distro) |
| Redis | 7+ | `redis-cli --version` | **WSL** (inside distro) |

> ⚠️ **Important:** Node.js runs on **Windows**, while PostgreSQL and Redis run **inside WSL**. This means `localhost` from Node.js on Windows does **not** reliably forward to WSL services. You must use the WSL instance's network IP.

#### Step 1: WSL Infrastructure Setup

```bash
# Inside WSL — Install PostgreSQL
sudo apt update
sudo apt install -y postgresql postgresql-client redis-server

# Start services
sudo service postgresql start
sudo service redis-server start

# Configure PostgreSQL for external connections
sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/15/main/postgresql.conf
sudo sed -i "s/127.0.0.1\/32/0.0.0.0\/0/" /etc/postgresql/15/main/pg_hba.conf
sudo service postgresql restart

# Create the database
sudo -u postgres psql -c "CREATE DATABASE jengabooks;"
```

#### Step 2: Find your WSL IP

```powershell
# From Windows PowerShell
wsl -- ip addr | findstr "inet "
# Look for an address like 192.168.1.XXX (not 127.0.0.1 or inet6)
```

#### Step 3: Configure Connection

```bash
# On Windows — Clone & install
git clone https://github.com/Jpkoech30/jengabooks.git
cd jengabooks
npm install

# Configure .env with the WSL IP found above
# Edit .env and apps/api/.env
```

**Connection config** (`.env` / `apps/api/.env`):
```env
# ❌ Will NOT work:
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/jengabooks"

# ✅ Use WSL's real IP — disable SSL (local Postgres doesn't need it):
DATABASE_URL="postgresql://postgres:postgres@192.168.1.180:5432/jengabooks?schema=public&sslmode=disable"
REDIS_HOST=localhost
REDIS_PORT=6379
```

> **Why `localhost` fails:** Windows' WSL2 port forwarding is unreliable on some configurations. The WSL instance gets a virtual IP that is stable within a session but `localhost` does not always forward correctly. Direct IP connection with SSL disabled is the confirmed working configuration.

#### Step 4: Run Migrations & Seed

```bash
cd apps/api
npx prisma migrate dev
npx ts-node prisma/seed.ts
cd ../..
npm run dev
```

#### Step 5: Verify Connection

```bash
# From the project root — tests both WSL IP and localhost
node scripts/test-conn2.js

# Expected output:
# ✓ WSL IP: [{"db":"jengabooks","ver":"PostgreSQL 18.4..."}]
# ✗ localhost: Can't reach database server at localhost:5432
```

#### Automation: One-command start

The dev launcher script handles everything automatically:

```powershell
.\scripts\dev.ps1
```

**What it does:**
1. Starts WSL (if not running)
2. Starts PostgreSQL and Redis in WSL
3. **Auto-detects the WSL IP** and injects it into `DATABASE_URL` at runtime
4. Waits for PostgreSQL and Redis to be ready (retries up to 15 times)
5. Checks optional 3rd party API connectivity (DeepSeek, KRA eTIMS)
6. Starts the JengaBooks dev server

**Expected output:**
```
=== JengaBooks Dev Environment ===

[1/5] Checking WSL status...
  ✓ WSL is ready
[2/5] Starting PostgreSQL...
  ✓ PostgreSQL already running
[3/5] Starting Redis...
  ✓ Redis already running
[4/5] Detecting WSL IP and configuring connection...
  ✓ DATABASE_URL configured with WSL IP
    → postgresql://postgres:postgres@192.168.1.180:5432/jengabooks?schema=public&sslmode=disable
[5/5] Verifying service connectivity...
  ✓ PostgreSQL is ready
  ✓ Redis is ready
  - DeepSeek AI API: skipped (no API key configured)
  - KRA eTIMS API: skipped (no KRA_API_URL configured)
  ✅ All services are ready! Starting application...
```

**Options:**
```powershell
# Skip the service health check (faster startup)
.\scripts\dev.ps1 -SkipServiceCheck

# Skip WSL steps entirely (for Docker or Linux)
.\scripts\dev.ps1 -SkipWsl

# Specify a different WSL distro
.\scripts\dev.ps1 -WslDistro Ubuntu-22.04
```

> **How IP injection works:** The script runs [`node scripts/wsl-ip.js --export`](jengabooks/scripts/wsl-ip.js) which outputs `$env:DATABASE_URL="postgresql://...@<detected-ip>..."`. This env var overrides whatever is in the `.env` file, so you **never need to edit `.env` when the WSL IP changes**.

#### If WSL IP Changes (manual fallback)

WSL's IP can change after a reboot. If you're not using `dev.ps1`, find the new IP:

```powershell
wsl -- ip addr | findstr "inet "
```

Then update `DATABASE_URL` in both:
- [`jengabooks/.env`](jengabooks/.env)
- [`jengabooks/apps/api/.env`](jengabooks/apps/api/.env)

Or better, use the automated script:
```powershell
# This detects the IP and exports the correct DATABASE_URL for the current session
$env:DATABASE_URL = "$(node scripts/wsl-ip.js --export)"
npm run dev
```

---

### 🔐 Demo Credentials

### 🔐 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| **Firm Owner** | `admin@jengabooks.com` | `password123` |

<br />

---

## 🧪 Testing

The project has **234 tests** across **24 test suites**.

### Test Types

| Type | Count | What It Tests |
|------|-------|---------------|
| **Unit** (pure logic) | ~120 | Static methods, DTO validation, calculations, level thresholds, file parsing |
| **Integration** (mocked DB) | ~100 | Services with mocked Prisma: auth, ledger, HITL, reports, reconciliation |
| **E2E** (HTTP + real DB) | 14 | Full request/response cycle: register, login, auth flows |

### Test Coverage by Module

| Module | Tests | Key Features Tested |
|--------|-------|---------------------|
| Auth | 16 | Login, register, refresh, profile, DTO validation |
| Ledger | 34 | Accounts CRUD, journal entries, trial balance, serial numbers, recurring entries, lockdown |
| eTIMS | 22 | Invoices, VAT, KRA PIN validation, submissions, circuit breaker |
| M-Pesa | 75 | CSV parsing, file formats, bank templates, AI agents, auto-post, bulk approve, upload validation |
| HITL | 7 | Create, assign, resolve with XP |
| Reports | 24 | P&L, Balance Sheet, Cash Flow, period comparison, duplicates, share tokens |
| Gamification | 20 | Level calculation, sync streaks, early bird, level-up detection |
| Tenants | 6 | CRUD, member management, invite |
| Wizard | 6 | Progress tracking, step completion |
| AI Batch | 5 | Nightly fraud detection |
| Exception Filter | 6 | Prisma errors, HTTP errors |
| Circuit Breaker | 6 | State transitions, timeout, reset |
| Confidence Tier | 8 | 3-tier confidence logic |
| Reconciliation | 11 | Matching engine (exact/fuzzy), status |
| Workflow | 5 | 5-phase progress calculation |
| **Total** | **234** | |

### Running Tests

```bash
# All unit + integration tests
cd apps/api && npm test

# Watch mode
cd apps/api && npm run test:watch

# With coverage
cd apps/api && npm run test:cov

# Specific module
cd apps/api && npx jest --verbose --testPathPattern="mpesa"

# E2E tests (requires database)
cd apps/api && npx jest --config jest-e2e.config.ts
```

<br />

---

## 🌐 API Reference

All endpoints are prefixed with `/api/v1` and protected with JWT authentication (except login & register).

### 🔑 Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/auth/login` | Sign in with email + password (5 req/min) |
| `POST` | `/api/v1/auth/register` | Create account + company (3 req/min) |
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
| `POST` | `/api/v1/mpesa/import` | Import CSV/XLSX/PDF transactions |
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
| `POST` | `/api/v1/ai/batch/fraud-detection` | Manual fraud batch run |

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

### 📋 Workflow

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/workflow` | Monthly workflow progress (all 5 phases) |

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
| 📚 **Accountant** | Set up Chart of Accounts (5+ accounts) | 25 |
| 📱 **M-Pesa Connected** | M-Pesa transactions exist | 25 |
| 📊 **Data Driven** | Import first M-Pesa CSV | 25 |
| 💰 **First Income** | Record first income | 25 |
| 💳 **First Expense** | Record first expense | 25 |
| 🛡️ **Tax Compliant** | Submit first eTIMS invoice (ACCEPTED) | 50 |
| 👥 **Team Player** | Invite a team member | 25 |
| 📈 **Analyst** | Generate first report (5+ entries) | 25 |
| 🤖 **Trust the AI** | Bulk approve 10+ AI-categorized transactions | 25 |

### Streaks & Bonuses

| Mechanic | Trigger | Reward |
|----------|---------|--------|
| **Sync Streak** | Consecutive days of activity | Badge at 7/30/90 days |
| **Early Bird** | Submit reports before 5th of month | +50 XP |
| **Flawless Finisher** | Complete lockdown with 0 errors | Trophy badge |

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

## 🔧 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `PORT` | ❌ | `3000` | API server port |
| `JWT_SECRET` | ✅ | — | JWT signing secret |
| `REDIS_HOST` | ❌ | `localhost` | Redis host |
| `REDIS_PORT` | ❌ | `6379` | Redis port |
| `DEEPSEEK_API_KEY` | ⚠️ | — | Required for AI features |
| `KRA_API_URL` | ❌ | — | KRA eTIMS API endpoint (mock used if unset) |
| `KRA_CLIENT_ID` | ⚠️ | — | Required for eTIMS |
| `CORS_ORIGIN` | ❌ | `http://localhost:5173` | Allowed CORS origin |

<br />

---

## ☁️ Deployment

### Tier 1 — Single VM (Vultr Johannesburg)

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

### Environment Configuration for Production

```bash
# Required for production
NODE_ENV=production
JWT_SECRET=<strong-random-secret>
DATABASE_URL=postgresql://user:password@vultr-db:5432/jengabooks

# For AI features (optional, degrades gracefully if unset)
DEEPSEEK_API_KEY=sk-your-key
KRA_API_URL=https://kra-api.go.ke/v1
KRA_CLIENT_ID=your-client-id
```

<br />

---

## 📚 Additional Documentation

| Document | Location | Description |
|----------|----------|-------------|
| Audit Report | [`plans/jengabooks-comprehensive-audit.md`](plans/jengabooks-comprehensive-audit.md) | Full project audit with 24 issues |
| Test Strategy | [`plans/jengabooks-test-strategy.md`](plans/jengabooks-test-strategy.md) | 158-test plan across 5 phases |
| Workflow Spec | [`plans/acct-workflow-gap-analysis.md`](plans/acct-workflow-gap-analysis.md) | Kenyan accounting workflow specification |
| Gap Analysis | [`plans/acct-workflow-roadmap.md`](plans/acct-workflow-roadmap.md) | 6-phase implementation roadmap |
| Pricing Spec | [`plans/accontingspecs.md`](plans/accontingspecs.md) | Full accounting feature specification |

<br />

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

**Before submitting:** Run the test suite and ensure all tests pass.
```bash
cd apps/api && npm test
```

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
