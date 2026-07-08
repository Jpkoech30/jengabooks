# JengaBooks Agent Flow

## Task 3.1 — Simplify M-Pesa Page (Frontend Web)

**Commit:** [`0b44d20`](jengabooks) — `feat(mpesa): simplify M-Pesa page and add SlideOutPanel component`

### Files Changed
| File | Change | Purpose |
|------|--------|---------|
| [`apps/web/src/pages/mpesa.tsx`](jengabooks/apps/web/src/pages/mpesa.tsx) | Major rewrite | 859 lines added, 230 removed — simplified M-Pesa import page |
| **NEW** [`apps/web/src/components/ui/slide-out-panel.tsx`](jengabooks/apps/web/src/components/ui/slide-out-panel.tsx) | New file | Shared SlideOutPanel component (Task 4.1) |
| **NEW** [`apps/web/src/test/components/slide-out-panel.test.tsx`](jengabooks/apps/web/src/test/components/slide-out-panel.test.tsx) | New file | Tests for SlideOutPanel |

### Changes Summary
1. **Quick Filter Tabs** — "All" | "Unmapped" | "Needs Review" | "Reconciled" with count badges replacing the old "show unmapped only" toggle
2. **Table columns reduced 11→7**: Date, Description, Paid In, Withdrawn, Type, Account, Status (receipt#, customer, phone moved to row expand)
3. **Inline `<select>` categorization → SlideOutPanel** — Click a row to open the panel with full details, categorization dropdown, and actions
4. **Batch actions → floating toolbar** — Appears when items are selected (replaces inline bar inside table)
5. **Row expand** — Click + icon to expand inline showing receipt#, customer name, phone, paybill
6. **Upload area simplified** — Single "Drop CSV/PDF here" zone with animated progress bar
7. **"Delete All" removed** — Too dangerous; replaced with single-delete in SlideOutPanel
8. **SlideOutPanel component** — 40% width desktop/100% mobile, focus trap, Escape/backdrop close, CSS transition animation

### Edge Cases Handled
- Empty table after import: success toast with import stats (imported/auto-categorized counts)
- Large files: Upload progress bar, disabled page navigation during import
- Parse errors: Inline error with specific line number extracted from server message
- Zero transactions total: EmptyState with "Upload CSV" CTA (triggers file upload click)
- Pre-existing TS errors in other files (accounts.tsx, hitl-hub.tsx, workflow.tsx, test files) remain untouched

### Compliance Checks
- **SENTINEL**: No MISSING_API_DATA, TODO, FIXME, invented endpoints, fake response shapes, hardcoded secrets
- **TIME-TRAVEL**: 
  - `new Date(tx.transactionDate).toLocaleDateString()` — display-only formatting (allowed)
  - No `new Date()` or `Date.now()` in financial logic, audit logs, or transaction timestamps
- **FEATURE-CREEP**: Only 3 files modified — all listed in the approved plan
- **48px touch targets**: All interactive elements use `touch-target` class or explicit `min-h-[48px]`
- **Dark mode**: All new UI elements have dark mode variants matching existing design tokens
