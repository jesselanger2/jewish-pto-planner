# Jewish PTO Planner — Engineering Spec

This is the persistent reference for the whole build. It does not change
between phases. Each phase prompt tells Copilot to read this file first.
Commit this file to the repo at `docs/SPEC.md` before Phase 0.

## Product Goal

Help a user plan Jewish holiday observance and discretionary time off across
a default three-year horizon (user-configurable 1–5 years) while using
employer vacation benefits intelligently. The planner must produce:

- Required time-off dates for the user's chosen observance rules.
- Recommended PTO dates and contiguous breaks that maximize useful time away.
- A transparent running ledger for vacation, heritage, religious-observance,
  and volunteer-day banks.
- A warning when a plan is infeasible or violates a policy limit.
- **The non-negotiable invariant:** vacation days are never silently
  forfeited to an annual rollover cap. A valid plan has zero preventable
  vacation-day loss at every rollover event. If zero loss is impossible,
  the planner must return an explicit `infeasible` result with the exact
  projected loss and the blocking cause — never a plan silently mislabeled
  as valid.

This is a planning aid, not payroll software or religious advice. Say so in
the app and docs.

## Non-negotiable Working Rules (apply in every phase)

1. Build a real app to a working, tested, deployable state — not a mockup.
2. Make reasonable product/technical decisions without repeatedly asking
   questions; document assumptions in the README; use conservative,
   user-editable defaults.
3. Work in small coherent commits. Run relevant tests after each change and
   fix failures before moving on.
4. Keep the PTO domain engine pure, deterministic, timezone-safe, and
   independent of React, storage, auth, and rendering. UI code must never
   contain business rules.
5. Never fabricate religious or employer policy as universal — only
   well-labeled, user-editable defaults.
6. Never display a plan as valid if hard constraints aren't satisfied.
   Explain precisely why and what caused it.

## Stack

- React, TypeScript, Vite, Tailwind CSS.
- `@hebcal/core` for Hebrew calendar / Jewish holidays.
- Vitest + React Testing Library for unit/component tests.
- Zod for all persisted/form data validation.
- Civil ISO dates (`YYYY-MM-DD`) as the domain date type — never round-trip
  planning dates through UTC timestamps.
- Lucide icons where useful.
- Playwright + axe if the repo already supports browser tests; otherwise
  add a small high-value e2e suite only once the core is stable.
- No backend by default. Add Supabase (Auth + Postgres + RLS) only when it's
  needed for accounts/cross-device saved plans, and the app must still work
  in local anonymous mode (browser storage) when hosted credentials are
  absent, through the same repository interface.

## Architecture

```text
src/
  domain/
    dates/                 Civil-date, workday, and calendar helpers
    holidays/               Hebcal adapter and canonical holiday mapping
    policy/                 PTO policy, accrual, rollover, bank ledger
    planner/                Candidate generation, optimizer, validator, explanations
    models.ts               Shared domain types
  features/
    onboarding/  settings/  planner/  calendar/  saved-plans/
  components/               Reusable presentational components only
  repositories/             Local and hosted persistence adapters
  auth/                     Optional authentication boundary
  lib/                      Small framework integrations
```

Principles:
- Domain functions take/return plain typed values — no React state, browser
  APIs, or DB calls.
- `PlannerRepository` interface: local storage and Supabase adapters behave
  identically to the app.
- Every saved plan stores a reproducible snapshot: policy, calendar config,
  holiday-rule snapshot, engine version, generation timestamp.
- Any privileged DB operation lives behind a server/Supabase policy, never
  a client-side secret.
- One authoritative work-calendar classifier used by every UI and engine
  decision.

## Domain Data Model

```ts
type IsoDate = string; // validated YYYY-MM-DD, local civil date
type DayUnits = number; // integer days in v1

type ObservanceLevel = 'required' | 'optional' | 'ignore';
type HolidayLocation = 'diaspora' | 'israel';
type AccrualCadence = 'annual' | 'monthly' | 'per-pay-period';
type DayClassification =
  | 'workday' | 'weekend' | 'company-holiday'
  | 'federal-holiday' | 'custom-closure';

type BankId = 'vacation' | 'heritage' | 'religiousObservance' | 'volunteer' | string;

interface PTOBankPolicy {
  id: BankId;
  label: string;
  annualGrant: DayUnits;
  grantDate?: { month: number; day: number };
  accrualCadence?: AccrualCadence;
  accrualAmount?: DayUnits;
  carryoverCap?: DayUnits | null; // null = unlimited
  carryoverDeadline?: { month: number; day: number } | null;
  // Second forfeiture cliff, distinct from the year-end cap: days that
  // survived the cap must still be used by this date or they're lost too
  // (e.g. an April 1 deadline on a carried-over vacation balance).
  expiresAtYearEnd?: boolean;
  allowNegative?: boolean;
  minimumBalance?: DayUnits;
  unpaid?: boolean; // true for banks (e.g. religious observance) that don't draw pay
  isFloatingHoliday?: boolean; // true for a fixed paid day the user schedules
  // themselves rather than accrues (e.g. Heritage Day)
  countsTowardVacationLossInvariant?: boolean; // default true only for 'vacation'
}

interface EmployerPolicy {
  policyYearStart: { month: number; day: number };
  banks: PTOBankPolicy[];
  startingBalances: Record<BankId, DayUnits>;
  weekendDays: number[]; // 0-6, default Sat/Sun
  useUSFederalHolidays: boolean;
  companyHolidays: Array<{ date: IsoDate; label: string }>;
  customClosures: Array<{ date: IsoDate; label: string }>;
  bookingLeadTimeDays?: number;
}

interface JewishCalendarSettings {
  location: HolidayLocation;
  timezone: string;
  includeModernHolidays: boolean;
}

interface HolidayRule {
  holidayId: string; // canonical app id, not raw display text
  observance: ObservanceLevel;
  preferredBankOrder: BankId[];
  // Order matters for unpaid banks: e.g. ['religiousObservance', 'vacation']
  // defaults to unpaid time to preserve vacation; the reverse defaults to a
  // paid day. Never pick a default silently — surface the choice.
}

interface PlannerSettings {
  horizonStart: IsoDate;
  horizonYears: number; // default 3, range 1-5
  jewishCalendar: JewishCalendarSettings;
  employerPolicy: EmployerPolicy;
  holidayRules: HolidayRule[];
  lockedTimeOff: Array<{ date: IsoDate; bankId: string; reason: string }>;
}
```

Also model: normalized holiday occurrence, daily ledger event, time-off
booking, candidate break, planner objective score, explanation, validation
issue, and an immutable `PlanSnapshot`.

Keep banks separate — heritage, religious-observance, and volunteer days
must never count against vacation rollover math. Each bank has its own
grant/accrual/cap/negative/unpaid policy and starting balance; the UI must
make the difference visible.

## Calendar and Holiday Rules

**Work calendar:** `classifyDay(date, employerPolicy)` returns the
authoritative classification + reason. PTO is only consumed on a workday.
Weekends/federal/company/custom-closure days never consume a bank (v1).
Configurable weekend days (default Sat/Sun). Opt-in US federal holiday
calendar with correct observed-day handling, isolated and tested across
representative years — never assume every user is in the US. User-entered
company holidays/closures are authoritative over generated calendars. Use
the user's IANA timezone for display and Hebrew-calendar context; never let
a UTC conversion shift a civil date.

**Jewish holidays via `@hebcal/core`,** through one adapter module (read the
installed package's actual API/types, don't guess flag names):
1. Request the full horizon plus a small boundary buffer.
2. Respect Diaspora/Israel setting for second festival days.
3. Normalize to a canonical `holidayId`, Hebrew + localized names, civil
   ISO date, source metadata.
4. Map individually: Rosh Hashanah I/II, Yom Kippur, Sukkot I/II, Shemini
   Atzeret, Simchat Torah, Pesach I/II/VII/VIII, Shavuot I/II, plus fast
   days/modern holidays only when the user enables them.
5. Non-workday holidays stay visible but marked as consuming no PTO.

Starter profile (editable, not claimed universal): Rosh Hashanah I/II, Yom
Kippur, Sukkot I, Shemini Atzeret, Simchat Torah, Pesach I/VII, Shavuot I
default `required`; second days default `optional` where appropriate.

Required = must be covered by a booking whenever it's a workday. Optional =
selected only when it improves the plan and resources allow. Ignore = shown
only if the user opts in, never consumes a bank.

## Starter Policy Templates (and Fully Custom Setup)

No named-employer preset ships in the public build. Employer policies
vary and change over time, and shipping one company's specific numbers
under its name risks being wrong, stale, or mistaken for an official or
endorsed source — a bigger liability than it's worth for a public app.
Instead, onboarding offers a small set of **unbranded, illustrative**
starter templates plus an equally prominent **fully custom** path.

Ship at least these four templates, each demonstrating a distinct
combination of mechanisms already in the Domain Data Model — every number
in them is a clearly-labeled placeholder the user is expected to edit, not
presented as anyone's real policy:

- **Simple accrual with a rollover cap** — monthly accrual into one
  vacation bank, a single forfeiture cliff at the policy-year boundary
  (`carryoverCap` set, no `carryoverDeadline`).
- **Annual grant, no carryover** — a lump annual grant,
  `expiresAtYearEnd: true`, no accrual math.
- **Two-stage carryover with a use-by deadline** — `carryoverCap` plus a
  separate `carryoverDeadline`: a capped amount survives the year boundary
  but must be used by a second date or it's forfeited too.
- **Unpaid observance bank with paid substitution** — a second `unpaid`
  bank alongside vacation, with a `preferredBankOrder` choice on holiday
  rules so the user can see and toggle unpaid-first vs. paid-first
  behavior.
- Optionally, a **floating-holiday** template (`isFloatingHoliday`) if not
  already covered by one of the above.

Each template's card states plainly that it's a generic example, not a
specific employer's actual policy, and the onboarding flow requires the
user to confirm or edit every number before a plan is generated from it.

**Start from scratch:** a fully custom path with no prefilled numbers —
the same guided, field-by-field onboarding steps as the templates, but
every bank starts blank/zero and the user builds their own policy directly
from the Domain Data Model primitives. This must be a first-class, equally
visible option next to the templates, never a buried "advanced" toggle.

Whichever path a user starts from, their own edited settings persist
locally via the existing `PlannerRepository` — there's no separate code
path for "a real employer's policy" beyond a user filling in the custom
(or template) form themselves, the same as anyone else would.

## PTO Ledger and Hard Constraints

Chronological ledger (not yearly subtraction), documented deterministic
order: opening balances → accrual/grant events → approved/locked bookings →
required + chosen recommended bookings → policy-year rollover/expiration.
Every event records opening balance, delta, resulting balance, reason,
source ID, policy-year ID. Never mutate a previous entry.

Hard constraints for a valid plan:
- Every required holiday on a workday is covered or already a non-workday.
- No booking lands on a non-workday unless it's a flagged historical/locked
  record.
- A bank balance never falls below its configured minimum, anywhere in the
  ledger. Negative vacation only when configured, with an explicit minimum.
- Rollovers happen on the actual policy-year boundary, not always Jan 1.
- A bank may define a `carryoverDeadline` distinct from the year-end cliff
  (e.g. a second use-it-or-lose-it window on a carried-over vacation
  balance, as in the "two-stage carryover" starter template). Track both
  cliffs as separate, dated forfeiture events in the ledger, in date order
  — protecting the first does not automatically protect the second.
- **Zero loss at every rollover/expiration event, for banks with
  `countsTowardVacationLossInvariant` (default true only for `vacation`).**
  Before a cap or carryover deadline would discard vacation, the plan must
  schedule enough eligible usage before that boundary to eliminate the
  pending loss. Forfeiture of a non-invariant bank (heritage, religious
  observance, volunteer) at year end is expected behavior — surface it only
  as an advisory "use it or lose it" note, never as a hard-failure
  `infeasible` result.
- If zero loss on an invariant bank is mathematically impossible: return
  `infeasible`, keep the exact projected loss as a validation issue,
  explain the blocking constraints/dates, and never label the output an
  optimized valid plan.

Using PTO for a worthwhile break is not "loss." Only PTO erased by a cap or
expiration is the prohibited loss — the planner should use otherwise-
expiring PTO on eligible workdays (preferring valuable breaks) before the
deadline.

## Optimizer

Deterministic, default 3-year / user-configurable 1–5-year horizon. No
brute-force subset search.

Pipeline: normalize settings + generate calendar/holiday occurrences →
reserve/validate locked time off → mandatory demand from required holidays
on workdays → rollover-protection demand (exact vacation days needed before
each boundary, net of known requirements/accruals/bookings) → generate
eligible candidate PTO blocks (around weekends/closures/required/optional
holidays, each recording consumed workdays, resulting away-span, bank
choices, holiday labels, deadlines) → select candidates under chronological
ledger constraints, required absences + zero-loss rollover first, then
optional/discretionary → independently validate by replaying the full
ledger (the validator is final authority even with a solver) → return
bookings, day-by-day annotations, ledger, explanations, score, infeasibility
diagnostics.

Selection method: a bounded, deterministic, testable/explainable approach —
a small encapsulated MIP with a transparent fallback, or a custom staged
DP/bounded search. Never hide constraints in opaque UI ranking code.

For a bank with a two-stage cliff (a `carryoverCap` and a separate
`carryoverDeadline`, as in the "two-stage carryover" starter template),
generate two distinct
rollover-protection demands — one dated at the year-end cap, one at the
carryover deadline — rather than one combined deadline; satisfying the
later one does not imply the earlier one was satisfied. When a holiday
rule's `preferredBankOrder` puts an unpaid bank ahead of a paid one, the
optimizer must honor that order exactly and never silently substitute a
paid day the user didn't ask for.

Lexicographic objective order:
1. Feasibility: required absences + minimum balances.
2. Minimize vacation forfeited at each rollover — a valid plan reaches zero.
3. Maximize covered optional observances (weighted by preference if added).
4. Maximize continuous non-work spans / calendar-adjacent value per PTO day.
5. Prefer fewer fragmented blocks, stable recommendations.

Tie-break deterministically: earliest date, then canonical candidate ID.
Re-running unchanged settings must yield the same plan. Expose why each date
was selected (required / rollover preservation / adjacent extension /
optional / lock) and why a requested choice couldn't be added.

## UX Views (build as a planning tool, not a marketing site)

- **Planner dashboard:** horizon selector, plan health, balances, rollover
  status, next required dates.
- **Calendar/timeline:** month view, non-workdays/holidays/required/
  optional/planned/recommended all distinct, readable without color alone.
- **Recommendations:** PTO blocks — dates, bank used, resulting break,
  nearby holidays/weekends, plain-language reason.
- **Policy & work calendar settings:** accrual/grant, rollover caps,
  negative minimum, bank settings, weekend pattern, federal holiday toggle,
  company closures, horizon.
- **Holiday rules:** searchable list, required/optional/ignore per holiday,
  Diaspora/Israel prominent.
- **Ledger:** inspectable chronological table — grants, bookings,
  rollovers, balances, any projected loss/constraint failure.
- **Saved plans:** named snapshots, compare to current settings, duplicate/
  delete only the current user's plans.

Interaction rules: onboarding only until required config is complete, with
a seeded editable example profile; native controls + labels + validation
(no free text for constrained fields); lock/remove + regenerate with
preserved locks and explained changes; visible assumptions/disclaimer near
results; never imply employer approval — label as "dates to request,"
support CSV/ICS export; deliberate empty/loading/validation/no-recommendation
/infeasible states, with no-loss infeasibility impossible to miss;
responsive, keyboard-operable, visible focus states, semantic headings,
contrast-compliant, and never color-only for charts/calendar marks.

## Persistence and Authentication

`PlannerRepository` interface: profile, settings, saved plans, exports.
Start with a versioned, Zod-validated local-storage adapter that migrates
or safely resets corrupt records.

Add Supabase only when env vars are configured: email magic link and/or a
mainstream OAuth provider; `profiles`/`planner_settings`/`saved_plans`
tables with UUID ownership + timestamps; policy/plan snapshots as validated
JSONB where practical, indexed by owner + timestamp; migrations + Row Level
Security on every select/insert/update/delete restricted to
`auth.uid() = user_id`; no service-role key in the browser, secrets out of
source control, `.env.example` with variable names only; local mode stays
available for visitors, and local plans never silently upload.

## Validation, Privacy, Security

Zod-validate all form/persisted/network data; reject invalid dates,
duplicate closures, impossible grant dates, non-integer day values (v1),
unsupported horizon lengths, disallowed negative minimums. Render user
strings as text only (no raw HTML injection); strict import/export
parsing. Treat holiday selections, balances, and planned absences as
private data — minimum collection, visible delete-data action in both local
and account mode. Least-privilege DB policies; never log personal calendar/
balance content in analytics or error telemetry. Secure deploy defaults:
HTTPS, env-based config, dependency audit, documented local dev setup.

## Testing Strategy

Unit: civil-date arithmetic across DST/leap years; workday classification
(configurable weekends, federal/company/custom); Hebcal adapter
normalization incl. Diaspora/Israel second-day differences; required vs
optional vs ignored holidays on workdays/non-workdays; grant cadences (or
explicit rejection of unsupported ones); rollover caps at arbitrary
boundaries; negative-balance behavior; separate-bank accounting + preferred
order; ledger replay/ordering/invariants; zero-loss rollover planning
including forced discretionary PTO before a cap; infeasible scenarios
(insufficient workdays, locked days blocking needed use, required time off
exceeding the negative minimum); optimizer determinism/tie-breaking.

Integration/UI: full first-run config → plan; editing a holiday rule and
regenerating required bookings; locking a recommendation triggers
re-planning + explanation; invalid input blocked with accessible errors;
local persistence restores settings/plans; authenticated users can't read
another user's records; keyboard nav + automated a11y tooling + manual
smoke review.

Use fixed fixture dates and injected clock/calendar dependencies — tests
never depend on the current date. Include at least one horizon spanning
multiple policy rollovers.

Starter templates: monthly vacation accrual; a year-end cap forfeiture and
a separate carryover-deadline forfeiture as two distinct events that don't
double-count the same days; floating-holiday scheduling (including the
unscheduled-this-year case); unpaid-bank tracking with and without paid
substitution. Also test the fully-custom path end to end: a blank policy
through onboarding to a generated plan.

## Deliverables (update the README with)

Architecture overview + domain invariants; setup/dev/test/lint/build/deploy
commands; env variable reference + safe local-mode behavior; Hebcal
attribution + Diaspora/Israel note; a concise privacy statement + data
deletion instructions; a description of the optimizer objective order and
how infeasible results are reported. Include sample seed settings/fixtures
without hard-coding one person's religious practice or employer policy as
universal. Document plainly that no named-employer preset ships — starter
templates are generic, illustrative examples only, and the README should
say so explicitly alongside the fully-custom setup option.

## Final Acceptance Criteria

1. Clean-checkout build/type-check/lint/tests all pass.
2. A visitor can use the app with no account: configure a policy, choose
   Diaspora/Israel, set each holiday's observance, generate a plan.
3. Default horizon 3 years, user-selectable 1–5.
4. Weekends, company closures, enabled US federal holidays, and Jewish
   holidays are correctly treated as non-working or PTO-consuming per the
   user's rules.
5. Required working-day observances are covered; optional ones optimized
   only when feasible; non-workday observances consume no PTO.
6. Vacation/heritage/religious-observance/volunteer balances tracked
   separately in a chronological inspectable ledger.
7. Negative vacation balances work only within the configured lower bound.
8. Every valid plan has zero vacation forfeited at each rollover/expiration
   event, or an explicit infeasible result with projected loss + causes.
9. Recommended dates show what to request, bank used, resulting break, and
   why.
10. Users can lock dates, regenerate safely, save plans locally, export
    calendar data.
11. Hosted authenticated persistence (when configured) enforces per-user
    RLS isolation and never exposes privileged credentials to the browser.
12. Core engine has meaningful automated coverage for holiday, ledger,
    rollover, negative-balance, and infeasibility edge cases; primary flows
    are keyboard-accessible.
13. At least four unbranded starter templates and a fully custom setup
    path are all functional and equally reachable from onboarding; no
    named employer appears anywhere in shipped code, copy, or fixtures.
    The two-stage forfeiture mechanism, unpaid-bank tracking with paid
    substitution, and floating-holiday scheduling are each demonstrated by
    at least one template and covered by tests.

Before finishing any phase: review the diff for unrelated changes, run
every available quality command, fix failures, and summarize decisions,
verification results, and deferred scope in the README or handoff notes.
