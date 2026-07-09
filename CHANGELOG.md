# Changelog

## v1.0.2 (2026-07-09)

### 🧭 Navigation
- Added missing sidebar links: Reports, Workflow, Help & Support
- Fixed broken /profile link in profile dropdown (now redirects to /settings)

### ✨ Page Transitions
- Added CSS fadeIn animation on route change (200ms ease-out)
- Improved PageLoading component with animated SVG spinner
- Respects prefers-reduced-motion for accessibility

### 🔄 Client Switching
- Fixed initViewModeFromUrl() never being called on app bootstrap
- Default view-mode changed to firm for safer initial state
- View-mode now resets to firm on company switch (clears activeClient)
- Scoped queryClient.invalidateQueries() to prevent auth cache blasts
- Sidebar brand subtitle shows Firm Overview in firm mode

### 🧪 Testing
- Added window.matchMedia mock for Dashboard test suite
- Frontend tests: 39/39 passing
- API tests: 548/548 passing

## v1.0.1 (2026-07-09)

### 🛡️ Security
- Upgraded vitest to ^3.1.2 (fixes CRITICAL RCE, CVSS 9.8)
- Removed hardcoded JWT fallback secret from audit.module.ts
- Replaced SQL injection vector ($executeRawUnsafe) with parameterized queries
- Replaced hardcoded WhatsApp verify token with env var
- Removed dev JWT secret from .env.example
- Parameterized statement-timeout interceptor query

### 🧪 Compliance
- Added GET /collab/notifications/count endpoint
- Fixed 5 TIME-TRAVEL (new Date()) violations — all now use DB NOW()
- Updated violations-report.md to PASS status

### 🗄️ Database
- Verified payroll schema: Employee, SalaryStructure, PayrollRun, PayrollEntry models
- Added jest-e2e.config.ts for consistent E2E test execution

### 🧪 Testing
- Fixed 10 test failures (mock setup gaps, UI selector fixes)
- Full suite: 548/548 API tests, 33/33 frontend tests
