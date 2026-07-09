# Compliance Violations Report

**Date:** 2026-07-09
**Auditor:** Compliance Guardian
**Tag Range:** `v1.0.0..HEAD`
**Status:** ❌ BLOCKED — Violations found

---

## Mandate 1: SENTINEL — Anti-Hallucination

### Result: ⚠️ ISSUE FOUND

| Check | Status |
|-------|--------|
| `MISSING_API_DATA` / `MISSING_DATA` | ✅ None found |
| `TODO` / `FIXME` comments | ✅ None found |
| Hardcoded secrets (production code) | ✅ None found (test fixtures only) |
| Invented endpoints | ⚠️ See below |

### Issue #1: Missing API endpoint — `/collab/notifications/count`

**File:** [`apps/web/src/hooks/use-api.ts:264`](jengabooks/apps/web/src/hooks/use-api.ts:264)

The frontend calls `GET /collab/notifications/count` via the [`useUnreadCount`](jengabooks/apps/web/src/hooks/use-api.ts:261-267) hook:

```typescript
queryFn: () => api.get('/collab/notifications/count', { userId: 'me' }),
```

However, the backend controller at [`apps/api/src/modules/collaboration/collaboration.controller.ts`](jengabooks/apps/api/src/modules/collaboration/collaboration.controller.ts) defines only `@Get('notifications')` (line 162) and has **no** `@Get('notifications/count')` handler. This endpoint will return a 404 at runtime.

**Impact:** The notification badge in the header will silently fail to display the unread count.

---

## Mandate 2: TIME-TRAVEL — Temporal Integrity

### Result: ❌ VIOLATIONS FOUND

5 violations of `new Date()` in financial/audit/persistence contexts where DB `NOW()` must be used.

---

### Violation #1: `billing.service.ts` — Trial expiry check

**File:** [`apps/api/src/modules/billing/billing.service.ts:69`](jengabooks/apps/api/src/modules/billing/billing.service.ts:69)

```typescript
new Date(subscription.trialEndsAt) < new Date()
```

**Problem:** Trial expiry comparison uses client-side `new Date()` instead of DB `NOW()`. This is billing/fiscal logic and must use a DB-provided timestamp.

**Context:** The service already has [`getDbNow()`](jengabooks/apps/api/src/modules/billing/billing.service.ts:90) defined and used in `createSubscription()` at line 90, but the `getOrCreateSubscription()` helper on line 69 doesn't use it.

---

### Violation #2: `billing.service.ts` — Cancellation timestamp

**File:** [`apps/api/src/modules/billing/billing.service.ts:152`](jengabooks/apps/api/src/modules/billing/billing.service.ts:152)

```typescript
data: {
  status: 'CANCELLED',
  cancelledAt: new Date(),
},
```

**Problem:** `cancelledAt` is persisted using client-side `new Date()` instead of DB `NOW()`. This timestamp is used in subscription/billing logic and must be DB-sourced.

---

### Violation #3: `audit.service.ts` — Lock-down timestamp

**File:** [`apps/api/src/modules/audit/audit.service.ts:58`](jengabooks/apps/api/src/modules/audit/audit.service.ts:58)

```typescript
lockedAt: new Date(), // DB timestamp for audit trail
```

**Problem:** The comment says "DB timestamp for audit trail" but it's actually client-side `new Date()`. This is an **audit log timestamp** and the rule explicitly prohibits `new Date()` in audit logs. Must use DB `NOW()`.

---

### Violation #4: `audit.service.ts` — Last accessed timestamp

**File:** [`apps/api/src/modules/audit/audit.service.ts:345`](jengabooks/apps/api/src/modules/audit/audit.service.ts:345)

```typescript
data: { lastAccessedAt: new Date() },
```

**Problem:** `lastAccessedAt` is an audit log field persisted with client-side `Date()`. Must use DB `NOW()`.

---

### Violation #5: `lock-down.guard.ts` — Override timestamp

**File:** [`apps/api/src/modules/audit/guards/lock-down.guard.ts:76`](jengabooks/apps/api/src/modules/audit/guards/lock-down.guard.ts:76)

```typescript
overriddenAt: new Date(),
```

**Problem:** Audit override timestamp persisted with client-side `Date()` instead of DB `NOW()`.

---

### Borderline Cases (Warnings, not violations)

| File | Line | Usage | Rationale |
|------|------|-------|-----------|
| [`cashflow.service.ts`](jengabooks/apps/api/src/modules/cashflow/cashflow.service.ts) | 718-876 | `new Date(year, month, day)` for forecast computation | Projection only, not persisted. Uses `getDbNow()` for base reference (line 121). Acceptable. |
| [`whatsapp.service.ts`](jengabooks/apps/api/src/modules/whatsapp/whatsapp.service.ts) | 436 | `new Date().toISOString()` as OCR date fallback | Entry date fallback when OCR cannot extract date. Should buffer with DB time. |
| [`mpesa.service.ts`](jengabooks/apps/api/src/modules/mpesa/mpesa.service.ts) | 811 | `Date.now()` for AI serial number | Serial number generation — not a financial value. Low risk. |
| [`daraja.service.ts`](jengabooks/apps/api/src/modules/mpesa/daraja.service.ts) | 208-210 | `new Date()` for Daraja API timestamp | Communication protocol — explicitly allowed by TIME-TRAVEL rule. |

---

## Mandate 3: SWARM — Domain Boundary

### Result: ✅ NO VIOLATIONS

All modified files are within their respective agents' allowed file patterns based on the module structure.

---

## Mandate 4: FEATURE-CREEP — Zero Scope

### Result: ✅ NO VIOLATIONS

All modified files align with the approved feature set for v2.0.0:
- Practice Hub, Collaboration, Documents, Audit Defense Kit, Cashflow Forecasting, Billing/Subscriptions, Sandbox, WhatsApp, Payroll, Tax/eTIMS, Theme Refinement

---

## Mandate 5: UNIT TEST — Quality Gate

### Result: ⚠️ ISSUES FOUND

| Metric | Value |
|--------|-------|
| Test suites | 38 passed, 2 failed (40 total) |
| Individual tests | 540 passed, 5 failed (545 total) |
| New modules with test files | ✅ All 8 new modules have spec files |

### Failed test suites:

**1. [`auth/auth.service.spec.ts`](jengabooks/apps/api/src/modules/auth/auth.service.spec.ts) — 3 failures**

Root cause: Mock `PrismaService` doesn't define `refreshToken` or `chartOfAccount` models:

- `TypeError: Cannot read properties of undefined (reading 'create')` — `prisma.refreshToken.create` at line 285
- `TypeError: Cannot read properties of undefined (reading 'upsert')` — `tx.chartOfAccount.upsert` at line 151
- `TypeError: Cannot read properties of undefined (reading 'findUnique')` — `prisma.refreshToken.findUnique` at line 193

**2. [`sandbox/sandbox.service.spec.ts`](jengabooks/apps/api/src/modules/sandbox/sandbox.service.spec.ts) — 2 failures**

Root cause: Mock `PrismaService` doesn't define `createMany` on `mpesaTransaction`:

- `TypeError: Cannot read properties of undefined (reading 'createMany')` — `prisma.mpesaTransaction.createMany` at line 558

---

## Mandate 6-8: Other Mandates

| Mandate | Status |
|---------|--------|
| 6. SOCRATIC — Plan Before Code | ✅ N/A (audit phase) |
| 7. GROUNDING — Read Context | ✅ `.project-context.json` and `AGENT-FLOW.md` reviewed |
| 8. COMMIT & DOCUMENT | ⏳ Blocked until violations resolved |

---

## Summary

| Mandate | Result |
|---------|--------|
| 1. SENTINEL — Anti-Hallucination | ⚠️ 1 issue (missing `/collab/notifications/count` endpoint) |
| 2. TIME-TRAVEL — Temporal Integrity | ❌ **5 violations** |
| 3. SWARM — Domain Boundary | ✅ Clean |
| 4. FEATURE-CREEP — Zero Scope | ✅ Clean |
| 5. UNIT TEST — Quality Gate | ⚠️ 2 test suites failing (5 tests) |
| **Overall** | **❌ BLOCKED** |

## Next Steps

1. **Fix TIME-TRAVEL violations** in:
   - [`billing.service.ts`](jengabooks/apps/api/src/modules/billing/billing.service.ts) lines 69, 152 — Replace `new Date()` with `await this.getDbNow()`
   - [`audit.service.ts`](jengabooks/apps/api/src/modules/audit/audit.service.ts) lines 58, 345 — Replace `new Date()` with DB `NOW()` query
   - [`lock-down.guard.ts`](jengabooks/apps/api/src/modules/audit/guards/lock-down.guard.ts) line 76 — Replace `new Date()` with DB `NOW()`

2. **Add missing endpoint** [`/collab/notifications/count`](jengabooks/apps/api/src/modules/collaboration/collaboration.controller.ts) to the collaboration controller, or fix the frontend to use the existing `GET /collab/notifications` with a count response.

3. **Fix test mocks** in:
   - [`auth/auth.service.spec.ts`](jengabooks/apps/api/src/modules/auth/auth.service.spec.ts) — Add `refreshToken` and `chartOfAccount` models to mock PrismaService
   - [`sandbox/sandbox.service.spec.ts`](jengabooks/apps/api/src/modules/sandbox/sandbox.service.spec.ts) — Add `createMany` method to mock `mpesaTransaction`
