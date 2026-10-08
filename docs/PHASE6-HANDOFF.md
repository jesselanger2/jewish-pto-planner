# Phase 6 — Final Handoff Note

## Verification: SPEC.md Final Acceptance Criteria

Each criterion verified manually against the codebase.

---

### 1. Clean-checkout build / type-check / lint / tests all pass ✅

```
npm run typecheck   →  0 errors
npm run lint        →  0 errors  (3 pre-existing warnings in context hook files)
npm test            →  316 / 316 tests pass  (10 test files)
npm run build       →  ✓  chunks: react 219 kB, index 189 kB, hebcal 144 kB
```

CI: `.github/workflows/ci.yml` runs all four gates on every push/PR to `main`,
intentionally without Supabase env vars to verify local-only mode.

---

### 2. Visitor can use the app with no account ✅

`supabase.ts` returns `null` when env vars absent → `LocalStorageRepository` used →
`AuthPanel` renders nothing → `NavBar` auth section invisible. Confirmed by production build
with no env vars set.

---

### 3. Default horizon 3 years, user-selectable 1–5 ✅

`src/lib/defaultSettings.ts` → `horizonYears: 3`. Onboarding + PolicySettings constrained
to 1–5. `PlannerSettingsSchema` enforces `z.number().int().min(1).max(5)`.

---

### 4. Weekends / company closures / US federal holidays / Jewish holidays classified correctly ✅

`classifyDay(date, policy)` is the single source of truth (`src/domain/dates/workday.ts`).
Configurable weekend days, opt-in US federal holiday calendar with observed-day handling,
user-entered closures override generated calendars. 30 workday tests.

---

### 5. Required working-day observances covered; optional optimised; non-workday = no PTO ✅

`runPlanner` pipeline: required holidays on workdays → booked first; optional only when
resources allow; non-workday holidays kept in annotations but never draw a bank.
45 planner tests including infeasible, negative-balance, multi-year rollover scenarios.

---

### 6. Separate chronological inspectable ledger for all bank types ✅

`LedgerView` renders all events in date order. `BankTag` handles any bank ID
(including `religiousObservance`, `volunteer`, or any custom). Dashboard bank-balance
cards are dynamically derived from the policy's bank list (no hardcoded 3 banks).

---

### 7. Negative vacation balances respect configured lower bound ✅

`PTOBankPolicy.allowNegative` + `minimumBalance` enforced in `computeLedger`.
36 ledger tests including negative-balance scenarios.

---

### 8. Zero vacation forfeited at each rollover, or explicit infeasible result ✅

Rollover-protection demand computed before candidate selection (`rolloverDemand.ts`).
Infeasible path: `feasibility: 'infeasible'`, exact `vacationForfeited`, `validationIssues`
with `rolloverDate` and `code`. Dashboard shows pulsing red banner with `role="alert"`.

---

### 9. Recommended dates show what to request, bank, break, and why ✅

`RecommendationsView` renders blocks grouped by consecutive dates, bank tag, resulting
away span, nearby holiday labels, and `PlannerExplanation` text. Label: "Dates to request."

---

### 10. Lock dates, regenerate, save plans locally, export calendar data ✅

Lock toggle in `RecommendationsView` and `CalendarView`. Regenerate re-uses locks.
`SavedPlansView`: save named snapshot, delete, load. `exportToCSV` / `exportToICS`.

---

### 11. Supabase RLS isolation, no privileged credentials in browser ✅

Only `VITE_SUPABASE_ANON_KEY` used in browser. RLS DDL in `docs/supabase-migration.sql`
restricts all operations to `auth.uid() = user_id`. Two isolation tests in
`SupabaseRepository.test.ts` verify USER_A data is inaccessible to a USER_B repository.

---

### 12. Meaningful automated coverage + keyboard accessibility ✅

**316 tests across 10 suites:**

| Suite | Count | Covers |
|---|---|---|
| `isoDate` | 50 | Civil-date arithmetic, DST, leap years |
| `workday` | 30 | Weekend, federal, company, custom closures |
| `ledger` | 36 | Grant/accrual/rollover/cap/negative/expiration |
| `hebcalAdapter` | 35 | Diaspora/Israel, normalization |
| `schemas` | 32 | Zod validation round-trips |
| `starterTemplates` | 34 | All 4 templates + custom path end-to-end |
| `planner` | 45 | Normal, infeasible, negative-balance, two-stage, lock |
| `twoStagePolicy` | 15 | Two distinct forfeiture cliffs |
| `LocalStorageRepository` | 21 | Versioned migration, Zod self-healing |
| `SupabaseRepository` | 18 | CRUD, corruption, isolation |

**Keyboard accessibility:**
- `*:focus-visible` global focus ring (3px indigo glow)
- Skip-to-main link (WCAG 2.4.1) — visible on keyboard focus only
- All interactive elements use semantic HTML (`<button>`, `<input>`, `<select>`, `<a>`)
- `role="alert"` on infeasible banner; `role="status"` on non-error alerts
- `aria-label` on icon-only buttons; `aria-labelledby` on all `<section>` elements
- `aria-required` on required form fields

---

### 13. Four unbranded starter templates + fully custom; no named employer anywhere ✅

Templates: Simple Accrual, Annual Grant, Two-Stage Carryover, Unpaid Observance Bank.
Each card states it's a generic example. No named employer in code, copy, or fixtures.
`starterTemplates.test.ts` verifies two-stage forfeiture, unpaid bank, floating holiday.

---

## Intentionally Deferred Scope

| Item | Reason |
|---|---|
| Playwright e2e tests | SPEC says "once core is stable" — ready to add in Phase 7 |
| axe automated a11y scanning | CI hook — straightforward next step |
| "Delete my account and data" (Supabase) | Phase 7 |
| Token-refresh edge cases | Phase 7 |
| Sample seed settings/fixtures file | Phase 7 |

---

## Files Changed in Phase 6

| File | Change |
|---|---|
| `.github/workflows/ci.yml` | NEW — typecheck + lint + test + build CI |
| `netlify.toml` | NEW — SPA fallback, security headers, asset cache |
| `vercel.json` | NEW — SPA fallback, security headers |
| `vite.config.ts` | Added code-splitting (react / hebcal / supabase chunks) |
| `index.html` | Full SEO meta: og:*, theme-color, color-scheme, robots |
| `src/App.tsx` | Skip-to-main link; `<main id="main-content">` |
| `src/index.css` | Skip-to-main CSS; bank CSS classes: religious/volunteer/sick/other |
| `src/components/BankTag.tsx` | Handles any bank ID; unknown IDs get neutral style |
| `src/components/AlertBanner.tsx` | Added `onDismiss` callback prop |
| `src/features/dashboard/Dashboard.tsx` | Dynamic bank balance cards (all policy banks) |
| `src/domain/holidays/defaultHolidayRules.ts` | Fasts/modern holidays: `personal` → `religiousObservance` |
