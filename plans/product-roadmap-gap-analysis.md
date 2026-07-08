# JengaBooks Product Roadmap — Gap Analysis v1.0

> **Based on:** Product Design Specification (July 2026)  
> **Current state:** v1.0.0 (tagged) on `working` branch  
> **Mission:** Give Jane (Kenyan accountant) back 20 hours/week  
> **Lead:** 🧠 Lead Architect & Orchestrator

---

## 1. Current vs. Target — Module Coverage

| Module | Feature | Current State | Status |
|--------|---------|---------------|:------:|
| **4.1** | Executive Dashboard | KPI cards + Month-End wizard + Recent Activity | 🟡 Partial |
| **4.2** | "Plain English" Toggle | ❌ Not built | 🔴 Gap |
| **4.3** | One-Click Invoicing | Basic eTIMS invoice creation | 🟡 Partial |
| **4.4** | AI Expense Categorization | M-Pesa categorization + AI agents exist | 🟡 Partial |
| **4.5** | WhatsApp Receipt Capture | ❌ Not built | 🔴 Gap |
| **4.6** | Predictive Cash Flow Alerts | ❌ Not built | 🔴 Gap |
| **5.1** | Practice Hub Portfolio View | Firm Dashboard with client list | 🟡 Partial |
| **5.2** | Bulk Transaction Processing | M-Pesa batch-categorize exists | 🟡 Partial |
| **5.3** | Smart Reconciliation Engine | HITL Hub + AI reconciliation agent | 🟡 Partial |
| **5.4** | Advanced Lock-Down Periods | ❌ Not built | 🔴 Gap |
| **5.5** | White-Label Reporting Suite | Reports page with P&L, Balance Sheet, etc. | 🟡 Partial |
| **5.6** | Client Task Automation Engine | ❌ Not built | 🔴 Gap |
| **6.1** | Transaction-Level Communication | ❌ Not built | 🔴 Gap |
| **6.2** | Client Document Portal | ❌ Not built | 🔴 Gap |
| **6.3** | Multi-Currency & Multi-Entity | Multi-entity switching exists; multi-currency ❌ | 🟡 Partial |
| **6.4** | Robust Audit Trail | Audit trail report exists (basic) | 🟡 Partial |
| **6.5** | Temporary External Access | ❌ Not built | 🔴 Gap |
| **7.1** | eTIMS OSCU Integration | Invoice create + submit to KRA | 🟡 Partial |
| **7.2** | M-Pesa / Airtel Auto-Sync | M-Pesa CSV/PDF import + categorize | 🟡 Partial |
| **7.3** | Automated Payroll & Statutory | ❌ Not built | 🔴 Gap |
| **7.4** | KRA Audit Defense Kit | ❌ Not built | 🔴 Gap |
| **8.1** | Rock-Solid Bank Feeds | Statement upload + M-Pesa parser | 🟡 Partial |
| **8.2** | Integration Stability & Data Trust | ❌ Not built | 🔴 Gap |
| **8.3** | Granular Role-Based Permissions | RBAC exists in `packages/shared` | 🟡 Partial |
| **8.4** | Disaster Recovery | Docker compose, no geo-redundancy | 🟡 Partial |
| **8.5** | Transparent Pricing | ❌ Not built (no billing) | 🔴 Gap |
| **8.6** | World-Class Customer Support | ❌ Not built (no support system) | 🔴 Gap |
| **9.1** | SME Owner Onboarding | Wizard exists on Dashboard | 🟡 Partial |
| **9.2** | Accountant Onboarding | ❌ Not built | 🔴 Gap |
| **9.3** | Training Mode / Sandbox | ❌ Not built | 🔴 Gap |

---

## 2. Priority Matrix

Scored by: **Impact on Jane's 20-hours/week goal** × **Development effort** × **Compliance risk**

| Priority | Feature | Impact | Effort | Compliance | Score |
|:--------:|---------|:------:|:------:|:----------:|:-----:|
| **P0** | eTIMS OSCU (auto-retry, validation codes) | 10 | 3 | 10 (KRA mandate) | **23** |
| **P0** | M-Pesa auto-sync (API, not CSV) | 10 | 4 | 8 | **22** |
| **P0** | Payroll + statutory deductions | 9 | 5 | 10 (KRA mandate) | **24** |
| **P1** | Smart Reconciliation (auto-match invoices) | 10 | 3 | 6 | **19** |
| **P1** | Practice Hub (full portfolio view) | 9 | 3 | 4 | **16** |
| **P1** | Client Task Automation Engine | 9 | 4 | 4 | **17** |
| **P1** | KRA Audit Defense Kit | 8 | 4 | 8 | **20** |
| **P1** | Bulk Transaction Processing (cross-client) | 8 | 3 | 4 | **15** |
| **P2** | WhatsApp Receipt Capture | 7 | 5 | 3 | **15** |
| **P2** | "Plain English" Toggle | 6 | 2 | 2 | **10** |
| **P2** | Transaction-Level Communication | 7 | 4 | 3 | **14** |
| **P2** | Client Document Portal | 7 | 5 | 3 | **15** |
| **P2** | Multi-Currency Support | 5 | 4 | 4 | **13** |
| **P2** | Advanced Lock-Down Periods | 6 | 3 | 5 | **14** |
| **P3** | Predictive Cash Flow Alerts | 5 | 4 | 2 | **11** |
| **P3** | White-Label Reporting (polish) | 5 | 2 | 2 | **9** |
| **P3** | Disaster Recovery (geo-redundancy) | 4 | 4 | 4 | **12** |
| **P3** | Transparent Pricing / Billing | 4 | 3 | 2 | **9** |
| **P4** | Customer Support System | 3 | 4 | 1 | **8** |
| **P4** | Sandbox / Training Mode | 3 | 3 | 1 | **7** |
| **P4** | Temporary External Access | 2 | 2 | 2 | **6** |

> **Scoring:** Impact (1-10) + Effort inverted (1=hard, 5=easy) + Compliance risk (1-10)

---

## 3. Sprint Roadmap (Next 6 Months)

### Sprint 5: Compliance Core (Weeks 1-3)
**Target:** P0 items — KRA compliance features

| Task | Agent | Est. Cost |
|------|-------|:---------:|
| eTIMS auto-retry with exponential backoff | ⚙️ Backend | KES 3 |
| eTIMS validation code display on invoices | 🌐 Frontend | KES 2 |
| Supplier PIN validation (real-time KRA check) | ⚙️ Backend | KES 4 |
| VAT auto-calculation from ledger | ⚙️ Backend | KES 3 |
| VAT filing prep (pre-populated forms) | 🌐 Frontend + ⚙️ Backend | KES 5 |
| **Total** | | **KES 17** |

### Sprint 6: Payroll Engine (Weeks 4-6)
**Target:** P0 item — Full payroll processing

| Task | Agent | Est. Cost |
|------|-------|:---------:|
| Payroll DB schema (employees, salary, deductions) | 🗄️ Database | KES 2 |
| PAYE calculation (KRA API integration) | ⚙️ Backend | KES 5 |
| NHIF/NSSF/Housing Levy auto-calculation | ⚙️ Backend | KES 3 |
| Payslip generation (English + Swahili) | 🌐 Frontend | KES 4 |
| Statutory filing (PAYE, NHIF, NSSF) | ⚙️ Backend | KES 5 |
| Payroll UI (employee mgmt, payslips) | 🌐 Frontend | KES 6 |
| **Total** | | **KES 25** |

### Sprint 7: M-Pesa Direct API (Weeks 7-8)
**Target:** P0 item — Real M-Pesa API integration

| Task | Agent | Est. Cost |
|------|-------|:---------:|
| M-Pesa API integration (Safaricom Daraja) | ⚙️ Backend | KES 5 |
| Auto-match against open invoices | ⚙️ Backend | KES 4 |
| Real-time sync (not CSV upload) | ⚙️ Backend | KES 3 |
| M-Pesa auto-reconciliation UI | 🌐 Frontend | KES 3 |
| **Total** | | **KES 15** |

### Sprint 8: Practice Hub (Weeks 9-10)
**Target:** P1 items — Accountant productivity

| Task | Agent | Est. Cost |
|------|-------|:---------:|
| Full portfolio view (all clients spreadsheet) | 🌐 Frontend | KES 4 |
| Bulk cross-client actions | ⚙️ Backend | KES 4 |
| Red flag auto-alerts | ⚙️ Backend | KES 3 |
| Client health scoring (Green/Yellow/Red) | 🌐 Frontend | KES 2 |
| **Total** | | **KES 13** |

### Sprint 9: Collaboration Layer (Weeks 11-13)
**Target:** P1/P2 items — Communication + document portal

| Task | Agent | Est. Cost |
|------|-------|:---------:|
| Transaction-level comments/chat | 🗄️ DB + ⚙️ Backend | KES 5 |
| Client document portal | 🌐 Frontend + ⚙️ Backend | KES 8 |
| Task engine (auto-generate tasks) | ⚙️ Backend | KES 4 |
| Notification system (email + SMS) | ⚙️ Backend | KES 3 |
| **Total** | | **KES 20** |

### Sprint 10: Audit & Compliance (Weeks 14-16)
**Target:** P1 items — KRA audit defense

| Task | Agent | Est. Cost |
|------|-------|:---------:|
| KRA Audit Defense Kit | 🌐 Frontend + ⚙️ Backend | KES 6 |
| Advanced lock-down periods | 🗄️ DB + ⚙️ Backend | KES 4 |
| Audit trail polish (immutable log) | ⚙️ Backend | KES 3 |
| External temporary access | 🌐 Frontend + ⚙️ Backend | KES 4 |
| **Total** | | **KES 17** |

### Sprint 11: Platform Polish (Weeks 17-18)
**Target:** P2/P3 items — UX polish + mobile

| Task | Agent | Est. Cost |
|------|-------|:---------:|
| "Plain English" toggle | 🌐 Frontend | KES 3 |
| Swahili language support | 🌐 Frontend | KES 5 |
| WhatsApp receipt capture | 🌐 Mobile + ⚙️ Backend | KES 6 |
| Predictive cash flow alerts | ⚙️ Backend + 🤖 AI | KES 5 |
| **Total** | | **KES 19** |

### Sprint 12: Commercial Launch (Weeks 19-20)
**Target:** P3/P4 items — Go-to-market readiness

| Task | Agent | Est. Cost |
|------|-------|:---------:|
| Billing system + pricing tiers | ⚙️ Backend + 🌐 Frontend | KES 5 |
| Customer support system | 🌐 Frontend | KES 4 |
| Sandbox/training mode | 🌐 Frontend + ⚙️ Backend | KES 5 |
| Disaster recovery (geo-redundancy) | 🚀 DevOps | KES 6 |
| **Total** | | **KES 20** |

---

## 4. Architecture Impact Assessment

### 4.1 New Backend Modules Required

| Module | Controller | Endpoints | Priority |
|--------|-----------|-----------|:--------:|
| **Payroll** | `payroll.controller.ts` | `/api/v1/payroll/*` | P0 |
| **Collaboration** | `collaboration.controller.ts` | `/api/v1/collab/*` | P1 |
| **Billing** | `billing.controller.ts` | `/api/v1/billing/*` | P3 |
| **Support** | `support.controller.ts` | `/api/v1/support/*` | P4 |
| **WhatsApp** | `whatsapp.controller.ts` | `/api/v1/whatsapp/*` | P2 |

### 4.2 New Database Tables Required

| Table | Purpose | Sprint |
|-------|---------|:------:|
| `Employee` | Payroll employee records | 6 |
| `SalaryStructure` | Salary, benefits, deductions | 6 |
| `PayrollRun` | Monthly payroll execution | 6 |
| `StatutoryFiling` | KRA statutory submission records | 6 |
| `MpesaWebhook` | Daraja API webhook events | 7 |
| `Comment` | Transaction-level communication | 9 |
| `ClientTask` | Auto-generated client tasks | 9 |
| `AuditLock` | Lock-down period configurations | 10 |
| `ExternalAccess` | Temporary access grants | 10 |
| `Subscription` | Billing subscriptions | 12 |

### 4.3 New External Integrations

| Integration | Type | Sprint |
|-------------|------|:------:|
| Safaricom Daraja API | REST (M-Pesa) | 7 |
| Airtel Money API | REST | 7 |
| KRA iTax API | SOAP/REST | 5 |
| KRA PIN validation | REST | 5 |
| WhatsApp Business API | REST | 11 |
| Central Bank of Kenya FX rates | REST | 11 |

---

## 5. Current Strengths (Keep As-Is)

These areas are already competitive and need only maintenance:

| Area | Why It's Good |
|------|---------------|
| **UX/UI Simplification** | Sidebar (7 items), header (4 elements), single-scroll dashboard |
| **Color Theme** | WCAG AA compliant, 3 semantic accent colors, kenya-gray neutral scale |
| **API Contract Alignment** | All 25+ frontend endpoints match backend (verified Sprint 0) |
| **SlideOutPanel** | Replaces modals for detail views, used by M-Pesa/HITL/Ledger |
| **Enhanced EmptyStates** | Every empty state has CTA + help link |
| **Test Coverage** | 299/302 tests passing, 18 M-Pesa service tests |

---

## 6. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|:----------:|:------:|------------|
| KRA eTIMS API changes without notice | High | High | Circuit breaker + mock mode (existing) |
| M-Pesa Daraja API latency/unavailability | Medium | High | Queue + retry mechanism (planned Sprint 7) |
| Payroll tax bracket changes mid-year | Medium | Medium | KRA API integration auto-updates (Sprint 6) |
| Data sovereignty requirements | Low | High | Kenya-primary backup (Sprint 12) |
| Browser cookie restrictions | Medium | Medium | httpOnly cookies already implemented |
| Scope creep during implementation | High | Medium | Strict P0-first prioritization |

---

## 7. Total Estimated Cost

| Sprint | Focus | Est. Cost (KES) |
|:------:|-------|:---------------:|
| 5 | Compliance Core | KES 17 |
| 6 | Payroll Engine | KES 25 |
| 7 | M-Pesa Direct API | KES 15 |
| 8 | Practice Hub | KES 13 |
| 9 | Collaboration Layer | KES 20 |
| 10 | Audit & Compliance | KES 17 |
| 11 | Platform Polish | KES 19 |
| 12 | Commercial Launch | KES 20 |
| **Total** | **8 sprints / 20 weeks** | **~KES 146** |

> At 135 KES/USD: ~$1.08 total AI compute cost. Human developer time is separate.

---

**End of Roadmap — Commit to `working` branch**
