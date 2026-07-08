# Theme Refresh Plan — Fix Color Clashes

> **Goal:** Eliminate color clashes, improve WCAG AA compliance, create visual hierarchy
> **Files:** [`tailwind.config.ts`](jengabooks/apps/web/tailwind.config.ts), [`theme.ts`](jengabooks/packages/shared/src/theme.ts), all `.tsx` files
> **Est. cost:** ~KES 2.70 (all Frontend Web work)

---

## 1. Identified Color Clashes

| # | Issue | Current | Problem | WCAG AA? |
|---|-------|---------|---------|:--------:|
| C1 | **Sidebar nav text** | `text-kenya-green-100 (#CCE1D5)` on `bg-kenya-green-500 (#0A5C36)` | Contrast ratio ~2.3:1 — text is illegible | ❌ FAIL |
| C2 | **Amber text on white** | `text-kenya-amber-500 (#E8A317)` on white | Contrast ratio ~1.8:1 — XP level, credit amounts unreadable | ❌ FAIL |
| C3 | **kenya-red flat color** | `kenya-red: #BB1E10` used as `kenya-red-500` in some files | Tailwind class `kenya-red-500` doesn't resolve — broken styles | ❌ BROKEN |
| C4 | **Mixed color palettes** | Uses both `kenya-green-*` and Tailwind default `green-*`, `red-*`, `blue-*`, `amber-*` | Inconsistent — 5 competing accent colors | ⚠️ Issue |
| C5 | **kenya-green-200 borders** | `border-kenya-green-200 (#99C3AB)` for card borders | Too light, indistinguishable from gray — weak visual hierarchy | ⚠️ Issue |
| C6 | **Heading color too dark** | `text-kenya-green-900 (#032E17)` for all headings | Almost black — loses the green brand identity | ⚠️ Issue |
| C7 | **Debit/Credit row colors** | Green bg on debit rows, amber text on credit | Green+amber together is a near-complementary clash — visually jarring | ❌ FAIL |
| C8 | **5 badge colors** | Green, amber, red, blue, purple for status badges | Too many competing colors — users can't distinguish meaning | ⚠️ Issue |

---

## 2. Proposed Palette Changes

### 2.1 🟢 Primary: Darken & Widen

```
kenya-green-500: #0A5C36 → #0D6B3E  (slightly lighter for sidebar bg)
kenya-green-700: #064523 → #0A4D2E  (for sidebar text)
kenya-green-900: #032E17 → #0A3B1F  (for headings — visible green tint)
```

### 2.2 🟡 Secondary: Darken for Readability

```
kenya-amber-500: #E8A317 → #C98A0C  (current 600, darker for text-on-white)
kenya-amber-400: #F5AF30 → #E8A317  (current 500, for badges/highlights)
```

### 2.3 🔴 Error: Add Full Scale

```
kenya-red:       #BB1E10 → (keep as flat)
kenya-red-50:    #FEF2F2  (NEW)
kenya-red-100:   #FEE2E2  (NEW)
kenya-red-200:   #FECACA  (NEW)
kenya-red-300:   #FCA5A5  (NEW)
kenya-red-400:   #F87171  (NEW)
kenya-red-500:   #BB1E10  (current flat)
kenya-red-600:   #991A0D  (NEW)
kenya-red-700:   #7A140A  (NEW)
```

### 2.4 🔵 Standardize Semantic Colors

```
Information:   #3B82F6 → #2563EB  (Tailwind blue-600)
Success:       #0A7D3C → #059669  (Tailwind emerald-600)
Warning:       #D97706 → #D97706  (keep, Tailwind amber-600)  
Error:         #BB1E10 → (kenya-red-500)
```

### 2.5 Add Neutral Gray Scale

```
kenya-gray-50:  #F9FAFB
kenya-gray-100: #F3F4F6
kenya-gray-200: #E5E7EB
kenya-gray-300: #D1D5DB
kenya-gray-400: #9CA3AF
kenya-gray-500: #6B7280
kenya-gray-600: #4B5563
kenya-gray-700: #374151
kenya-gray-800: #1F2937
kenya-gray-900: #111827
```

---

## 3. Specific Fixes by Component

### 3.1 Sidebar (`sidebar.tsx`)
```
bg:     kenya-green-500 (#0A5C36 → keep, iconic brand color)
text:   kenya-green-100 → white (#FFFFFF) for nav items  [FIX C1]
subtext: kenya-green-200 → kenya-green-100 (#CCE1D5)    [FIX C1]
active: bg-white/20 → bg-white/25 text-white
hover:  hover:bg-white/10 → hover:bg-white/15
```

### 3.2 Header (`header.tsx`)
```
Reduce green tint: border-kenya-green-100 → border-kenya-gray-200
Page title: text-kenya-green-900 → text-kenya-gray-900
```

### 3.3 Dashboard (`dashboard.tsx`)
```
KPI Income card:   bg-green-100 → bg-emerald-50   (softer)
KPI Expense card:  bg-red-100 → bg-red-50          (softer)
KPI Net card:      bg-blue-100 → bg-blue-50        (softer)
KPI M-Pesa card:   bg-amber-100 → bg-amber-50      (softer)
```

### 3.4 Ledger (`ledger.tsx`)
```
Debit row bg:  bg-green-50/60 → bg-emerald-50/40  (softer green tint) [FIX C7]
Credit row bg: bg-red-50/60 → bg-red-50/40         (softer red tint)
Amount text:   text-kenya-green-700 → text-emerald-700
Credit text:   text-kenya-amber-600 → text-amber-700 (darker amber)  [FIX C2]
```

### 3.5 Reports (`reports.tsx`)
```
Standardize category accents to 3 colors max:
  financial: green
  tax: amber  
  accounting/audit: blue (merge accounting + audit)
Remove the 4th accent color (red) — merge into blue 
```

### 3.6 Badge Colors (all files)
```
Reduce from 5 badge colors → 3:
  success: emerald-600 (#059669)
  warning: amber-600  (#D97706)
  error:   red-600    (#DC2626)
Remove blue and purple badges — use neutral for info
```

### 3.7 Forms & Inputs (`input.tsx`, `select.tsx`)
```
kenya-red-500 → red-500 for error borders
(Tailwind's red scale is already well-tested for WCAG)
```

### 3.8 Global Card Borders
```
border-kenya-green-100 → border-kenya-gray-200   [FIX C5]
border-kenya-green-200 → border-kenya-gray-300
```

---

## 4. Implementation Order

```
Phase 1: Theme Config (1 task)
├── Update tailwind.config.ts with new palette
├── Update packages/shared/src/theme.ts
└── Commit

Phase 2: High-Impact Fixes (2 tasks, parallel)
├── Fix Sidebar contrast (sidebar.tsx)          ← Highest priority
└── Fix Header + global card borders            ← High priority

Phase 3: Page-by-Page (3 tasks, parallel)
├── Dashboard KPI cards
├── Ledger row colors + amounts
├── Reports accent standardization

Phase 4: Component Polish (1 task)
├── Badge colors (3 instead of 5)
├── Form input error colors
└── Button tertiary colors
```

## 5. WCAG AA Compliance Targets

| Element | Min Contrast | Target Ratio |
|---------|:-----------:|:------------:|
| Normal text (<18px) | 4.5:1 | ≥4.5:1 |
| Large text (≥18px bold, ≥24px) | 3:1 | ≥3.5:1 |
| UI components (borders, icons) | 3:1 | ≥3:1 |
| Disabled text | 3:1 | ≥3:1 |

## 6. Files Changed

| File | Phase | Change Type |
|------|-------|-------------|
| [`apps/web/tailwind.config.ts`](jengabooks/apps/web/tailwind.config.ts) | 1 | Major update |
| [`packages/shared/src/theme.ts`](jengabooks/packages/shared/src/theme.ts) | 1 | Major update |
| [`apps/web/src/components/layout/sidebar.tsx`](jengabooks/apps/web/src/components/layout/sidebar.tsx) | 2 | Text colors |
| [`apps/web/src/components/layout/header.tsx`](jengabooks/apps/web/src/components/layout/header.tsx) | 2 | Border + text |
| [`apps/web/src/pages/dashboard.tsx`](jengabooks/apps/web/src/pages/dashboard.tsx) | 3 | KPI card bg |
| [`apps/web/src/pages/ledger.tsx`](jengabooks/apps/web/src/pages/ledger.tsx) | 3 | Row colors + amounts |
| [`apps/web/src/pages/reports.tsx`](jengabooks/apps/web/src/pages/reports.tsx) | 3 | Category accents |
| [`apps/web/src/components/ui/badge.tsx`](jengabooks/apps/web/src/components/ui/badge.tsx) | 4 | Color values |
| [`apps/web/src/components/ui/button.tsx`](jengabooks/apps/web/src/components/ui/button.tsx) | 4 | Tertiary colors |
| [`apps/web/src/components/ui/input.tsx`](jengabooks/apps/web/src/components/ui/input.tsx) | 4 | Error colors |
| [`apps/web/src/components/ui/select.tsx`](jengabooks/apps/web/src/components/ui/select.tsx) | 4 | Error colors |
| [`apps/web/src/components/ui/empty-state.tsx`](jengabooks/apps/web/src/components/ui/empty-state.tsx) | 4 | Link color |
| [`apps/web/src/components/ui/toast.tsx`](jengabooks/apps/web/src/components/ui/toast.tsx) | 4 | Border colors |
| All other `.tsx` files | 2-4 | `kenya-green-100`→`kenya-gray-200`, `kenya-amber-500`→`kenya-amber-600` |

## 7. Edge Cases

1. **Dark mode**: Every color change must have a dark mode equivalent. Test `bg-kenya-gray-200` in dark mode maps to `dark:bg-kenya-gray-800`.
2. **Existing tests**: Color-only changes shouldn't break tests, but visual snapshots might need updating.
3. **kenya-red-500 doesn't exist**: Files referencing `kenya-red-500` are currently broken — adding the full scale fixes this.
4. **Backward compatibility**: Old color classes (`kenya-green-100` etc.) must still work for any code not in this plan.
