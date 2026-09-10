# Jewish PTO Planner

> **Disclaimer:** This is a planning aid, not payroll software or religious advice.
> All defaults are editable examples — they are not claimed to be universal employer
> policy or religious authority.

A web app that helps users plan Jewish holiday observance and discretionary time
off across a configurable horizon (default 3 years, range 1–5) while making
intelligent use of employer vacation benefits.

---

## PTO-Loss Invariant

**Vacation days are never silently forfeited.**

A valid plan guarantees **zero vacation-day loss** at every rollover or
expiration event. Before a rollover cap would discard vacation, the planner
schedules enough eligible usage prior to that boundary to eliminate the loss.

If zero loss is mathematically impossible (e.g., there are not enough eligible
workdays before the cap deadline), the planner returns an explicit **`infeasible`**
result that states the exact projected loss and the blocking constraint.
It never labels such an outcome as a valid optimized plan.

---

## Architecture

```
src/
  domain/
    dates/       Civil-date helpers, workday classification, DST-safe arithmetic
    holidays/    @hebcal/core adapter; canonical holiday normalization
    policy/      PTO bank ledger, accrual/grant/rollover/cap logic
    planner/     Candidate generation, optimizer, validator, explanations
    models.ts    Shared domain types (IsoDate, PTOBankPolicy, EmployerPolicy, …)
  features/
    onboarding/  First-run wizard until required config is complete
    settings/    Employer policy, work calendar, horizon
    planner/     Plan generation, recommendations view
    calendar/    Month-view timeline of all day classifications
    saved-plans/ Named plan snapshots: save, compare, duplicate, delete
  components/    Reusable presentational components (no business logic)
  repositories/  PlannerRepository interface + local-storage adapter (Supabase optional)
  auth/          Optional authentication boundary (Supabase magic link / OAuth)
  lib/           Small framework integrations (Zod helpers, etc.)
```

### Key principles

- **Domain purity.** Domain functions take and return plain typed values — no
  React state, browser APIs, or DB calls. The UI never contains business rules.
- **One work-calendar classifier.** `classifyDay(date, employerPolicy)` is the
  single source of truth for whether a date is a workday, weekend, federal
  holiday, company holiday, or custom closure.
- **Separate banks.** Vacation, heritage, and personal days have independent
  grant/accrual/cap/negative policies and ledgers. Heritage/personal balances
  never affect vacation rollover math.
- **Chronological ledger.** Events are appended in order; entries are never
  mutated. Every event records opening balance, delta, resulting balance, reason,
  source ID, and policy-year ID.
- **Reproducible plan snapshots.** Every saved plan stores the policy, calendar
  config, holiday-rule snapshot, engine version, and generation timestamp.
- **`PlannerRepository` interface.** The local-storage adapter and the optional
  Supabase adapter behave identically to the application.

---

## Stack (planned — no source code exists yet)

| Concern | Choice |
|---|---|
| UI framework | React + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS |
| Hebrew calendar | `@hebcal/core` |
| Schema validation | Zod |
| Unit / component tests | Vitest + React Testing Library |
| Icons | Lucide |
| E2E / a11y | Playwright + axe (added once core is stable) |
| Backend (optional) | Supabase (Auth + Postgres + RLS) |
| Date format | ISO civil dates (`YYYY-MM-DD`) — never UTC timestamps for planning dates |

---

## Setup and Dev Commands

```sh
# Install dependencies
npm install

# Start the dev server (hot module replacement)
npm run dev

# Type-check (strict mode, no emit)
npm run typecheck

# Lint (oxlint)
npm run lint

# Unit and component tests
npm test            # single run
npm run test:watch  # watch mode
npm run test:coverage  # with V8 coverage report

# Build the production bundle (only when needed)
npm run build

# E2E tests (added in a later phase)
# npm run e2e
```

---

## Environment Variables

The app works in **local anonymous mode** (browser storage) with no environment
variables configured. Supabase integration is activated only when all of the
following are present:

```sh
# .env.local (never commit actual values)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

See `.env.example` (added in Phase 1) for variable names.

No service-role key is ever exposed to the browser.

---

## Jewish Holiday Attribution

Jewish holiday data is provided by **[Hebcal](https://www.hebcal.com/)** via the
`@hebcal/core` npm package (MIT license). The planner respects the
**Diaspora / Israel** setting for second festival days. This data is used
for planning assistance only and does not constitute religious authority.

---

## Privacy and Data Deletion

Holiday selections, PTO balances, and planned absences are treated as private
data.

- **Local mode:** all data lives in your browser's `localStorage`. Clear it via
  the in-app "Delete all data" action or through your browser's storage settings.
- **Account mode (Supabase):** a "Delete my account and data" action removes
  your profile, settings, and saved plans from the database. Row Level Security
  ensures no other user can read your records.

The app collects the minimum data needed to generate your plan and does not log
personal calendar or balance content in analytics or error telemetry.

---

## Optimizer Objective Order

The optimizer is deterministic and produces the same plan for unchanged
settings. It selects candidates in this lexicographic priority:

1. **Feasibility** — cover every required observance on a workday; meet minimum
   bank balances.
2. **Minimize vacation forfeited at each rollover** — a valid plan reaches zero
   loss.
3. **Maximize covered optional observances** (weighted by user preference if
   added).
4. **Maximize continuous non-work spans / calendar-adjacent value per PTO day.**
5. **Prefer fewer fragmented blocks** and stable recommendations.

Tie-break: earliest date, then canonical candidate ID.

Every recommended date states *why* it was selected (required observance,
rollover preservation, adjacent extension, optional observance, or lock) and
why any rejected choice could not be added.

**Infeasible results** include the exact projected vacation loss, the rollover
event that would cause it, and the blocking constraints (e.g., no eligible
workdays remain before the cap deadline, or locked days prevent the needed use).

---

## Phase 0 — Starting State and Assumptions

**Repository state at Phase 0:** Empty (no source code, no `package.json`, no tooling).

**Phase 1 status:** ✅ Complete — scaffold, models, schemas, utilities, repository, and 102 tests all passing.

**Assumptions entering Phase 1:**

1. The stack listed above matches `docs/SPEC.md` exactly — no substitutions.
2. Vite will scaffold the project with TypeScript + React template in the repo
   root (`./`).
3. `@hebcal/core` will be installed and its actual published API consulted
   before writing the adapter (no guessing of flag names).
4. Zod will validate all persisted and form data from day one.
5. The planner will use ISO civil dates (`YYYY-MM-DD`) exclusively; UTC
   timestamps are never used for planning logic.
6. User-entered company holidays and closures are authoritative over any
   generated calendar.
7. Supabase integration is entirely optional and never required for the app to
   function.
8. Tests will use fixed fixture dates and an injected clock — never the live
   system date.

**Deferred to Phase 1:** scaffolding, domain models, `@hebcal/core` adapter,
first unit tests, initial Vite + Tailwind + Vitest configuration.

---

## Deliverables Checklist (across all phases)

- [x] Architecture overview + domain invariants *(this file)*
- [x] PTO-loss invariant stated plainly *(this file)*
- [x] Stack choices documented *(this file)*
- [x] Starting-state assumptions recorded *(this file)*
- [x] Setup/dev/test/lint/build commands *(this file, Phase 1)*
- [x] Env variable reference + `.env.example` *(Phase 1)*
- [x] Hebcal attribution *(this file)*
- [x] Privacy statement + data-deletion instructions *(this file)*
- [ ] Sample seed settings/fixtures (Phase 2+)
