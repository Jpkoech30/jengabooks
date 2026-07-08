# Dev Test Infrastructure Plan

> **Status:** Ready  
> **Branch:** `working` (checked out from `main@v1.0.0`)  
> **Date:** 2026-07-08

---

## 1. Infrastructure Status

| Service | Host | Port | Status | Notes |
|---------|------|------|--------|-------|
| PostgreSQL 18.4 | `192.168.1.180` | 5432 | ✅ Running | WSL Ubuntu-26.04, database `jengabooks` |
| Redis 7 | `192.168.1.180` | 6379 | ✅ Running | Active 5h 42min, AOF enabled, 9.4MB memory |
| API Server | `localhost` | 3001 | ⬜ Not started | Will start on port 3001 |
| Web Dev Server | `localhost` | 5173 | ⬜ Not started | Vite dev server |

### Connection Detail
- **DATABASE_URL**: `postgresql://postgres:postgres@192.168.1.180:5432/jengabooks?schema=public&sslmode=disable`
- **Redis**: Host `192.168.1.180`, Port `6379`
- **localhost port-forwarding**: ❌ Not configured — all connections go via WSL static IP

---

## 2. Test Configuration

### 2.1 Existing Test Setup

| Config | Value |
|--------|-------|
| Framework | Jest 29 + ts-jest |
| Root dir | `apps/api/src` |
| Test pattern | `*.spec.ts` |
| Coverage dir | `apps/api/coverage` |
| Total tests | 302 (299 pass, 3 pre-existing auth failures) |
| Test env | `node` (no browser) |

### 2.2 Test Categories

| Category | Count | Pass | Fail | Key Files |
|----------|-------|------|------|-----------|
| Auth | 12 | 9 | 3 | `auth.service.spec.ts`, `login.dto.spec.ts` |
| Ledger | 28 | 28 | 0 | `ledger.service.spec.ts`, `adjusting-entries.spec.ts` |
| M-Pesa | 18 | 18 | 0 | `mpesa.service.spec.ts`, `file-parser.spec.ts` |
| eTIMS | 8 | 8 | 0 | `etims.service.spec.ts`, `pin-validation.spec.ts` |
| Reports | 12 | 12 | 0 | `reports.service.spec.ts`, `reporting-qa.spec.ts` |
| HITL | 6 | 6 | 0 | `hitl.service.spec.ts` |
| AI | 28 | 28 | 0 | `ai.service.spec.ts`, `batch.service.spec.ts` |
| Gamification | 16 | 16 | 0 | `gamification.service.spec.ts` |
| Tenants | 8 | 8 | 0 | `tenants.service.spec.ts` |
| Wizard | 6 | 6 | 0 | `wizard.service.spec.ts` |
| Workflow | 4 | 4 | 0 | `workflow.spec.ts` |
| Statements | 28 | 28 | 0 | `*-parser.spec.ts`, `parser-registry.spec.ts` |
| Other | 128 | 128 | 0 | Filters, guards, interceptors, queues |

### 2.3 3 Pre-Existing Test Failures

These are in Auth module (`auth.e2e-spec.ts`) and are **NOT caused by UX changes**:
- They relate to JWT token/refresh token flow in E2E context
- Require a running database with seed data to pass
- Can be fixed by running tests with `--runInBand` after seeding

---

## 3. How to Start Both Servers

### Option A: Quick Start (already on `working` branch)
```powershell
# Just run both servers
cd jengabooks
npm run dev
```
This starts both API (port 3001) and Web (port 5173) via Turborepo.

### Option B: Separate Terminals
```powershell
# Terminal 1: API only
cd jengabooks
npm run dev:api

# Terminal 2: Web only
cd jengabooks
npm run dev:web
```

### Option C: Full Infrastructure Check + Start
```powershell
cd jengabooks
.\scripts\dev.ps1
```

---

## 4. How to Run Tests

```powershell
# Run all tests (from jengabooks root)
cd apps/api && npx jest

# Run with coverage
cd apps/api && npx jest --coverage

# Run specific test file
cd apps/api && npx jest --testPathPattern="mpesa.service"

# Run tests in band (for E2E tests that need DB)
cd apps/api && npx jest --runInBand

# Watch mode (during development)
cd apps/api && npx jest --watch
```

---

## 5. Persona-Based Test Scenarios

### Persona 1: SME Owner (default role)
1. Login → Dashboard loads with KPI cards
2. Navigate to M-Pesa → Upload CSV/PDF
3. View transactions in simplified table
4. Click a row → SlideOutPanel with categorization
5. View Ledger → See entries with green/red row grouping
6. Navigate to Reports → Generate Profit & Loss
7. Click "Generate & Download" → CSV downloads

### Persona 2: Accountant / Firm Owner
1. Login → See Firm Dashboard with client list
2. Click a client → Switch to client view
3. Navigate to HITL Hub → See task table, filter by "My Tasks"
4. Click a task → SlideOutPanel → Resolve with action dropdown
5. Navigate to Team → See members with online indicators

### Persona 3: New User (zero data)
1. Register → See welcome card with CTAs
2. See EmptyState on M-Pesa → "Upload CSV" CTA
3. See EmptyState on Ledger → "Record your first transaction"
4. See Enhanced EmptyState with confetti on empty HITL Hub

---

## 6. QA Test Checklist

- [ ] **API health**: `GET /api/v1/health` returns 200
- [ ] **Redis health**: `GET /api/v1/health/redis` returns `{ status: 'up' }`
- [ ] **Login flow**: POST `/auth/login` returns httpOnly cookie
- [ ] **Dashboard**: GET `/dashboard/summary` returns entries + gamification + health
- [ ] **M-Pesa import**: POST `/mpesa/import` with CSV creates transactions
- [ ] **M-Pesa categorize**: PATCH `/mpesa/transactions/:id/categorize` updates account
- [ ] **M-Pesa batch**: POST `/mpesa/transactions/batch-categorize` processes multiple
- [ ] **M-Pesa delete all**: DELETE `/mpesa` clears all (from Settings)
- [ ] **HITL list**: GET `/hitl` returns paginated tasks
- [ ] **HITL resolve**: POST `/hitl/:id/resolve` updates status
- [ ] **Ledger entries**: GET `/ledger/entries?page=1` returns paginated data
- [ ] **Reports**: GET `/reports/profit-loss` returns financial data
- [ ] **All slide-out panels**: Open/close, Escape key, backdrop click, focus trap
- [ ] **All empty states**: Verify each has a CTA button
- [ ] **Mobile responsive**: Check at 375px width (iPhone SE)
- [ ] **Dark mode**: Toggle in Settings → Preferences, verify all pages
