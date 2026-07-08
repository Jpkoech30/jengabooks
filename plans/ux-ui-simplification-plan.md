# JengaBooks UX/UI Simplification Plan

> **Audience:** SME owners, accountants, firm owners in Kenya
> **Goal:** Reduce cognitive overload, simplify navigation, consolidate dashboards, eliminate table-only interfaces
> **Status:** Planning · **Lead:** 🧠 Lead Architect & Orchestrator

---

## 1. Problems Identified

After auditing all 12 pages and 15+ UI components, these are the sources of "overwhelming":

| # | Problem | Severity | Affected File(s) |
|---|---------|----------|-----------------|
| P1 | **Navigation overload** — 14 nav items in 5 groups. Too many choices. | 🔴 High | [`sidebar.tsx`](apps/web/src/components/layout/sidebar.tsx) |
| P2 | **Header is too busy** — 8 interactive elements (hamburger, title, dark mode, notifications, company switcher, XP badge, user menu). | 🔴 High | [`header.tsx`](apps/web/src/components/layout/header.tsx) |
| P3 | **Dashboard does everything** — 600+ lines, 5 tabs, 7+ API calls, firm + client dual view. | 🔴 High | [`dashboard.tsx`](apps/web/src/pages/dashboard.tsx) |
| P4 | **Every page is a data table** — 8/12 pages center on dense HTML tables with minimal visual hierarchy. | 🟡 Medium | All pages |
| P5 | **M-Pesa 11-column table** — 11 columns + inline `<select>` categorization + batch actions is overwhelming. | 🔴 High | [`mpesa.tsx`](apps/web/src/pages/mpesa.tsx) |
| P6 | **HITL Kanban complexity** — Drag-and-drop, modals, 3-column board, XP, filters. Too much for a review queue. | 🟡 Medium | [`hitl-hub.tsx`](apps/web/src/pages/hitl-hub.tsx) |
| P7 | **Modal-heavy interactions** — CRUD forms in modals break context. 8 pages use modals for primary actions. | 🟡 Medium | Multiple pages |
| P8 | **Inconsistent empty states** — Some show CTAs, others just "no data found." | 🟢 Low | Multiple pages |
| P9 | **No progressive disclosure** — New users see the same complexity as power users. | 🔴 High | All pages |
| P10 | **Gamification/XP badge noise** — XP bar appears in header, dashboard, HITL hub. Distracting for non-gaming users. | 🟢 Low | [`header.tsx`](apps/web/src/components/layout/header.tsx), [`hitl-hub.tsx`](apps/web/src/pages/hitl-hub.tsx) |

---

## 2. Design Principles (Apply to All Pages)

1. **Progressive Disclosure** — Show beginners 3 things, let them grow into advanced features
2. **One Primary Action Per Page** — Every page should answer "what do I do here?"
3. **Reduce Column Count** — Tables should max at 6 columns. Move secondary data to expandable rows
4. **Visual Hierarchy > Data Density** — Use cards, icons, spacing to guide the eye
5. **Consistent Empty States** — Every empty state must offer a CTA or link to help
6. **Remove Redundancy** — XP badge doesn't need to be on every page. Company name doesn't need to be in header AND sidebar

---

## 3. Sub-Tasks (Parallelizable Work)

### 3.1 🎯 Sprint 1: Navigation & Shell (3 days)

#### Task 1.1 — Simplify Sidebar Navigation

**Files:**
- [`sidebar.tsx`](apps/web/src/components/layout/sidebar.tsx)

**Changes:**
- Collapse 5 groups → 3 groups: **MAIN** (Dashboard, Ledger, Accounts), **COMPLIANCE** (eTIMS, M-Pesa, HITL Hub), **SETTINGS** (Team, Settings)
- Move Reports out of sidebar — make it a sub-page of Dashboard or accessible via Dashboard card
- Remove Workflow from sidebar — it's already shown on Dashboard as a wizard
- Reduce from 14 items → 7 items (50% reduction)
- Add collapsible sections with expand/collapse arrows

**Edge cases:**
- Role-based nav: Auditor shouldn't see M-Pesa import
- Mobile: Keep slide-in drawer but with simplified items

**Assigned to:** 🌐 Frontend Web

---

#### Task 1.2 — Declutter Header

**Files:**
- [`header.tsx`](apps/web/src/components/layout/header.tsx)

**Changes:**
- Move XP badge to Settings (Gamification section) — only show on Dashboard as compact bar
- Move dark mode toggle to Settings → Preferences
- Simplify company switcher: just show company name with a dropdown arrow (remove avatar inside avatar)
- Combine user menu + notifications into one profile dropdown
- Reduce from 8 elements → 4: [hamburger + page title] [company switcher] [notifications + profile menu]
- Remove the redundant subtitle line ("JengaBooks" / company name) — already visible in sidebar

**Edge cases:**
- Zero-notification state should not show the bell badge
- Company switcher should degrade gracefully for single-company users (no dropdown, just label)

**Assigned to:** 🌐 Frontend Web

---

#### Task 1.3 — Declutter index.css (Removal)

**Files:**
- [`index.css`](apps/web/src/index.css)

**Changes:**
- Remove the unused `xp-bar-gradient` class (being replaced)
- Remove `@keyframes xpFill` (being replaced)
- Keep `touch-target` utility

**Assigned to:** 🌐 Frontend Web

---

### 3.2 🎯 Sprint 2: Dashboard Simplification (3 days)

#### Task 2.1 — Rewrite Dashboard

**Files:**
- [`dashboard.tsx`](apps/web/src/pages/dashboard.tsx)

**Changes:**
Replace the 600-line monstrosity with:

```
┌─────────────────────────────────────────────────────┐
│  📊 Dashboard                     [📒 Ledger] [📊 Reports] │
│  "Welcome back, [user]! Your business is [healthy]." │
├─────────────────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐               │
│ │💰Income│ │💸Expense│ │📈Net  │ │📱M-Pesa│               │
│ │KES 50K │ │KES 15K│ │KES 35K│ │2 uncleaned│         │
│ └──────┘ └──────┘ └──────┘ └──────┘               │
├─────────────────────────────────────────────────────┤
│ 📋 Month-End Progress   ████████░░ 80%             │
│   Next: Categorize 12 entries →                     │
├─────────────────────────────────────────────────────┤
│ Recent Activity (last 5)                  [View All]│
│  12 Jun   M-Pesa payment from ABC      KES 5,000   │
│  11 Jun   Rent expense                 KES 50,000   │
└─────────────────────────────────────────────────────┘
```

**Specific changes:**
1. **Remove the 5-tab layout** — Show everything on one scrollable page
2. **Replace stats bar with 4 KPI cards** — Income, Expenses, Net Profit, M-Pesa alert count
3. **Always show Month-End Wizard** — Not hidden behind a "Month-End" tab
4. **Compact Recent Activity** — 5 rows, no table markup, just flex items
5. **Remove "Actions" tab** — Quick links are redundant with sidebar
6. **Remove "Health" tab** — Fold health score into Month-End wizard or a badge on KPI cards
7. **Remove "M-Pesa" tab** — Show M-Pesa alert count in KPI cards, link to /mpesa for details
8. **Single API call** — Consolidate 7 API calls into 1 `/dashboard/summary` endpoint (already exists)
9. **Firm Dashboard** — Keep separate but simplify to just client list with health dots

**Edge cases:**
- New user (0 transactions): Show welcome card with "Import M-Pesa" and "Record first transaction" buttons
- API failure: Show skeleton cards, no crash (already handled with catch)
- Firm user: Show FirmDashboard with client health overview, no tabs

**Assigned to:** 🌐 Frontend Web

---

### 3.3 🎯 Sprint 3: Page-by-Page Simplification (runs parallel)

#### Task 3.1 — Simplify M-Pesa Page

**Files:**
- [`mpesa.tsx`](apps/web/src/pages/mpesa.tsx)

**Changes:**
1. **Add Quick Filter Tabs** — "All" | "Unmapped" | "Needs Review" | "Reconciled" at top (replaces the "show unmapped only" toggle)
2. **Reduce table columns from 11 → 7**: Date, Description, Paid In, Withdrawn, Type, Account, Status
3. **Move inline `<select>` categorization → slide-out panel** — Click a row to open a side panel with categorization, details, and actions
4. **Move batch actions → a toolbar** that appears when items are selected (not inline in the table)
5. **Add row expand** — Click a row to see receipt, customer, phone without cluttering the table
6. **Simplify upload area** — Make it a single "Drop CSV/PDF here" zone with progress indicator
7. **Remove "Delete All" button** — Too dangerous. Replace with "Clear Imported Data" in Settings

**Edge cases:**
- Empty table after import: Show success toast + "View imported transactions" CTA
- Large files: Show upload progress bar, disable page navigation during import
- Parse errors: Show inline error with specific line number

**Assigned to:** 🌐 Frontend Web

---

#### Task 3.2 — Simplify HITL Hub

**Files:**
- [`hitl-hub.tsx`](apps/web/src/pages/hitl-hub.tsx)

**Changes:**
1. **Replace Kanban with a sortable table + detail drawer** — Kanban is overkill for < 50 items
2. **Table columns (6)**: Category, Description, Status, Assigned, Confidence, Created
3. **Click row → slide-out detail panel** with resolution options, raw data viewer, AI reasoning
4. **Remove drag-and-drop** — Unnecessary complexity; use status dropdown instead
5. **Simplify filter bar**: Category dropdown + "My Tasks" toggle
6. **Remove XP bar from HITL** — Only show on Dashboard
7. **Simplify resolution modal** — Reduce 3-button choice to a single "Resolve" button with a dropdown for action type

**Edge cases:**
- Zero tasks: Show empty state with "All clear! No items need review" + confetti animation
- High-confidence items: Auto-hide behind "Show resolved" filter

**Assigned to:** 🌐 Frontend Web

---

#### Task 3.3 — Simplify Ledger Page

**Files:**
- [`ledger.tsx`](apps/web/src/pages/ledger.tsx)

**Changes:**
1. **Reduce table columns from 8 → 6**: Date, Description, Account, Debit, Credit, Confidence
2. **Move "Posted By" and "Actions" → row expand** — Click row to see posted by, edit, delete
3. **Add visual row grouping** — Color-code by account type (green = income, red = expense)
4. **Simplify filters** — Remove date range from top; add a "Filter" button that opens a slide-out
5. **Move "New Entry" button → always visible floating action button (FAB)** — No more nested dropdowns
6. **Simplify pagination** — "Load More" button instead of numbered pages for < 1000 entries

**Edge cases:**
- Zero entries: Show "Record your first transaction" with link to M-Pesa import
- Large datasets: Virtual scrolling for > 1000 entries
- Delete: Inline confirmation instead of browser `window.confirm()`

**Assigned to:** 🌐 Frontend Web

---

#### Task 3.4 — Standardize Reports Page

**Files:**
- [`reports.tsx`](apps/web/src/pages/reports.tsx)

**Changes:**
1. **Keep the category grid** — It's actually well-designed
2. **Add visual "report preview" cards** — Show a mini chart or summary when a report is generated (instead of raw numbers)
3. **Simplify date range picker** — Use a prebuilt date range component instead of two separate date inputs
4. **Remove "Coming Soon" badges for non-implemented reports** — Either implement them or hide them
5. **Add "Generate & Download" one-click flow** — Skip the intermediate "Result" card, go straight to download

**Assigned to:** 🌐 Frontend Web

---

#### Task 3.5 — Clean Up Settings Page

**Files:**
- [`settings.tsx`](apps/web/src/pages/settings.tsx)

**Changes:**
1. **Move "Create Company" to a separate page or modal** — Don't mix company creation with settings
2. **Add tabbed layout** — Profile | Preferences | Billing | Danger Zone
3. **Move dark mode toggle here from header** — User preference, not page-level control
4. **Move gamification toggle here from header** — User preference
5. **Add "Clear All Imported Data" danger zone** (replaces M-Pesa "Delete All")

**Assigned to:** 🌐 Frontend Web

---

#### Task 3.6 — Polish Remaining Pages

**Files:**
- [`accounts.tsx`](apps/web/src/pages/accounts.tsx)
- [`etims.tsx`](apps/web/src/pages/etims.tsx)
- [`team.tsx`](apps/web/src/pages/team.tsx)
- [`workflow.tsx`](apps/web/src/pages/workflow.tsx)

**Changes:**
1. **Accounts**: Add expandable/collapsible tree view (improve visual hierarchy)
2. **eTIMS**: Add a "Quick Create" template for common invoice types
3. **Team**: Show team member status (online/offline) using socket connection
4. **Workflow**: Add month selector to view past months' progress

**Assigned to:** 🌐 Frontend Web

---

### 3.4 🎯 Sprint 4: Shared Components & Patterns (2 days)

#### Task 4.1 — Build Shared Slide-Out Panel Component

**Files:** NEW [`components/ui/slide-out-panel.tsx`](apps/web/src/components/ui/slide-out-panel.tsx)

**Why:** Replace modals with slide-out panels for detail views. Modals break context (user can't see the list while editing). Slide-out panels keep the parent visible.

**Spec:**
- Slides in from the right
- Overlays at 40% width on desktop, 100% on mobile
- Close on backdrop click, Escape key
- Contains: Header (title + close), Scrollable body, Optional footer
- 48px touch targets
- Focus trap inside panel
- Animate with CSS transition (`translate-x`)

**Assigned to:** 🌐 Frontend Web

---

#### Task 4.2 — Build Empty State Component Enhancement

**Files:**
- [`components/ui/empty-state.tsx`](apps/web/src/components/ui/empty-state.tsx)

**Changes:**
- Add `action` prop (already partially exists) — every empty state MUST have a CTA button
- Add `animation` prop for celebratory empty states (🎉 confetti for HITL "all clear")
- Add contextual help link — "Learn more about [feature]"
- Standardize icon sizes and spacing

**Assigned to:** 🌐 Frontend Web

---

#### Task 4.3 — Build Compact XP Bar Component

**Files:**
- [`components/ui/xp-bar.tsx`](apps/web/src/components/ui/xp-bar.tsx)

**Changes:**
- Create a smaller, less prominent variant: `variant="compact"` (just level number + thin bar)
- Create `variant="inline"` (level number only, no bar, shows on hover)

**Assigned to:** 🌐 Frontend Web

---

## 4. API Contract Changes

**No new API endpoints needed.** All changes are frontend-only. The existing `/dashboard/summary` endpoint already consolidates the data needed.

## 5. Database Schema Changes

**None.** All changes are purely UX/UI.

## 6. Implementation Order & Dependencies

```
Sprint 1: Navigation & Shell (3 days)
├── Task 1.1: Simplify Sidebar         ← No deps
├── Task 1.2: Declutter Header         ← No deps
└── Task 1.3: Clean up index.css       ← No deps

Sprint 2: Dashboard (3 days)
└── Task 2.1: Rewrite Dashboard        ← Depends on Sprint 1 (new header/sidebar)

Sprint 3: Page Simplifications (4 days, parallel)
├── Task 3.1: Simplify M-Pesa           ← Depends on Task 4.1 (slide-out panel)
├── Task 3.2: Simplify HITL Hub         ← Depends on Task 4.1 (slide-out panel)
├── Task 3.3: Simplify Ledger           ← Depends on Task 4.1 (slide-out panel)
├── Task 3.4: Standardize Reports       ← No deps
├── Task 3.5: Clean Up Settings         ← No deps
└── Task 3.6: Polish remaining pages    ← No deps

Sprint 4: Shared Components (2 days, can run parallel to Sprint 3)
├── Task 4.1: Slide-out panel           ← No deps
├── Task 4.2: Enhanced empty states     ← No deps
└── Task 4.3: Compact XP bar            ← No deps

Total: ~8-10 working days
```

## 7. Parallel Execution Matrix

| Tasks | Parallel? | Reason |
|-------|-----------|--------|
| 1.1 + 1.2 + 1.3 | ✅ Yes | Different files, no conflicts |
| 2.1 alone | ❌ Sequential | Depends on 1.1, 1.2 |
| 3.1 + 3.2 + 3.3 | ✅ Yes | Different files, use same new patterns |
| 3.1 + 4.1 | ❌ Sequential | 3.1 needs slide-out panel from 4.1 |
| 3.2 + 4.1 | ❌ Sequential | 3.2 needs slide-out panel from 4.1 |
| 3.3 + 4.1 | ❌ Sequential | 3.3 needs slide-out panel from 4.1 |
| 3.4 + 3.5 + 3.6 | ✅ Yes | No shared dependencies |
| 4.1 + 4.2 + 4.3 | ✅ Yes | Independent components |

## 8. Quality Gates

### 8.1 Before Marking Complete

- [ ] Every empty state has a CTA button
- [ ] No page has more than 7 table columns
- [ ] No page exceeds 400 lines
- [ ] Every interactive element has 48px minimum touch target
- [ ] Slide-out panel has focus trap + Escape key
- [ ] All existing tests pass
- [ ] New tests for slide-out panel, compact XP bar
- [ ] SENTINEL check: no `MISSING_API_DATA`, `TODO`, `FIXME`, fake endpoints, hardcoded secrets
- [ ] TIME-TRAVEL check: no `new Date()` in financial logic (display only)
- [ ] FEATURE-CREEP check: only files listed in this plan were modified

### 8.2 Test Requirements

- [`slide-out-panel.test.tsx`](apps/web/src/test/components/slide-out-panel.test.tsx) — Open/close, focus trap, Escape key, backdrop click
- [`dashboard.test.tsx`](apps/web/src/test/Dashboard.test.tsx) — Already exists, must still pass
- Manual QA: Verify each page loads without console errors

## 9. Files Changed Summary

| File | Change Type | Sprint |
|------|-------------|--------|
| [`apps/web/src/components/layout/sidebar.tsx`](apps/web/src/components/layout/sidebar.tsx) | Major rewrite | 1 |
| [`apps/web/src/components/layout/header.tsx`](apps/web/src/components/layout/header.tsx) | Major rewrite | 1 |
| [`apps/web/src/index.css`](apps/web/src/index.css) | Minor cleanup | 1 |
| [`apps/web/src/pages/dashboard.tsx`](apps/web/src/pages/dashboard.tsx) | Major rewrite | 2 |
| [`apps/web/src/pages/mpesa.tsx`](apps/web/src/pages/mpesa.tsx) | Major rewrite | 3 |
| [`apps/web/src/pages/hitl-hub.tsx`](apps/web/src/pages/hitl-hub.tsx) | Major rewrite | 3 |
| [`apps/web/src/pages/ledger.tsx`](apps/web/src/pages/ledger.tsx) | Moderate rewrite | 3 |
| [`apps/web/src/pages/reports.tsx`](apps/web/src/pages/reports.tsx) | Moderate rewrite | 3 |
| [`apps/web/src/pages/settings.tsx`](apps/web/src/pages/settings.tsx) | Moderate rewrite | 3 |
| [`apps/web/src/pages/accounts.tsx`](apps/web/src/pages/accounts.tsx) | Minor polish | 3 |
| [`apps/web/src/pages/etims.tsx`](apps/web/src/pages/etims.tsx) | Minor polish | 3 |
| [`apps/web/src/pages/team.tsx`](apps/web/src/pages/team.tsx) | Minor polish | 3 |
| [`apps/web/src/pages/workflow.tsx`](apps/web/src/pages/workflow.tsx) | Minor polish | 3 |
| **NEW** [`apps/web/src/components/ui/slide-out-panel.tsx`](apps/web/src/components/ui/slide-out-panel.tsx) | New file | 4 |
| [`apps/web/src/components/ui/empty-state.tsx`](apps/web/src/components/ui/empty-state.tsx) | Enhancement | 4 |
| [`apps/web/src/components/ui/xp-bar.tsx`](apps/web/src/components/ui/xp-bar.tsx) | Enhancement | 4 |

## 10. Rollback Plan

If any change causes regressions:
1. Each sprint is independently revertible via `git revert <commit-range>`
2. Component changes (Sprint 4) don't affect page logic — can be rolled back independently
3. Critical path: Dashboard Sprint 2 depends on Sprint 1. If Sprint 1 breaks, Dashboard will need rework
4. Tag each sprint commit with `ux-simplification-sprint-<n>` for easy identification

---

**End of Plan**
