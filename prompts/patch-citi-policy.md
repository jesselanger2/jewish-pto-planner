# Patch — Integrate the real Citi (US) Time Off Policy

> **Superseded.** This patch was applied, but the app is now going public
> and this branded preset has been removed in favor of generic starter
> templates. See `patch-generic-templates.md` instead. Kept here only as a
> record of what was originally built and then undone.

Read the current `docs/SPEC.md` in full before starting — it has just been
updated with a new "Employer Policy Preset: Citi (US)" section and revised
bank types, ledger rules, and optimizer rules. This patch retrofits the
work from Phases 1–4 to match. Do this before starting Phase 5.

## Why this patch exists

The original spec used generic, placeholder bank names (`vacation`,
`heritage`, `personal`). The user's actual employer policy is more
specific and must be modeled precisely, not approximated:

- Vacation forfeits in **two stages**: any balance over a 10-day (80-hour)
  cap is forfeited at the policy-year boundary, and the 10 days that do
  carry over must separately be used by **April 1** or they're forfeited
  too. These are two distinct dated events, not one deadline.
- **Religious observance** is its own unpaid bank (up to 10 days/year, no
  carryover) that can optionally be swapped for a paid vacation day — this
  is a real user choice, never a silent default.
- **Heritage Day** is a floating paid holiday the user schedules
  themselves, not a fixed calendar date.
- **Volunteer Day** (1/year) and **sick/unplanned time off** (7/year) exist
  but sick/unplanned time is out of scope for a planner that schedules time
  in advance — it must never be treated as schedulable PTO.

## Task

1. **Domain model** (`domain/models.ts` or equivalent): update to the
   `BankId`, `PTOBankPolicy`, `EmployerPolicy`, and `HolidayRule` shapes now
   in `docs/SPEC.md`'s Domain Data Model section — add `carryoverDeadline`,
   `unpaid`, `isFloatingHoliday`, and `countsTowardVacationLossInvariant`.
   Migrate any existing stored settings/fixtures that used the old
   `'personal'` bank id.
2. **Ledger** (`domain/policy/`): implement the two-stage forfeiture — the
   year-end cap cliff and the separate `carryoverDeadline` cliff — as two
   distinct, dated ledger events that don't double-forfeit the same days.
   Add support for `unpaid` banks (a booking against an unpaid bank
   consumes bank balance but has no pay implication) and
   `isFloatingHoliday` banks (a fixed grant the user schedules on any date
   they choose, not tied to a fixed calendar date).
3. **Optimizer/validator** (`domain/planner/`): generate rollover-protection
   demand for *both* cliffs on a two-stage bank, not one combined deadline.
   Scope the zero-loss invariant to banks with
   `countsTowardVacationLossInvariant` (vacation only, by default) —
   forfeiture on heritage/religious-observance/volunteer banks at year end
   is expected and should surface as an advisory note, not an `infeasible`
   result. When a holiday rule's `preferredBankOrder` puts an unpaid bank
   ahead of a paid one, honor that order exactly.
4. **Citi (US) preset**: add a built-in, selectable preset that populates
   the 12 holidays (with the Markets-employee variant as a toggle), the
   two-stage vacation carryover, the religious-observance bank, Heritage
   Day, Volunteer Day, and the read-only sick/unplanned balance, exactly as
   described in `docs/SPEC.md`. Show its source and a last-verified date in
   the settings UI, with a note to check Citi's HR Help Center for updates
   — never present it as the only or authoritative policy.
5. **Settings UI** (built in Phase 4): add a "Load Citi (US) preset" action;
   add an onboarding/settings prompt to schedule Heritage Day when it's
   unscheduled for the current policy year; surface the sick/unplanned
   balance as clearly read-only and excluded from planning; make the
   unpaid-vs-paid choice for religious observance an explicit, visible
   setting rather than a hidden default.
6. **Tests**: add the Citi-preset cases listed in `docs/SPEC.md`'s Testing
   Strategy — the two forfeiture events staying distinct, floating Heritage
   Day scheduling (including "unscheduled this year"), unpaid tracking with
   and without substitution, and confirming the optimizer never touches the
   sick/unplanned balance.

## Exit criteria

- All Phase 1–4 tests still pass after the migration; new Citi-preset
  tests pass.
- Loading the Citi preset and generating a plan shows correct two-stage
  vacation forfeiture warnings when balances are pushed toward either
  cliff, in a fixture designed to trigger both.
- Switching a holiday rule's `preferredBankOrder` between unpaid-first and
  paid-first visibly changes which bank a booking draws from.

When exit criteria are met, run every available quality command, fix
failures, and summarize what changed, what you migrated, and any Citi
policy details you deliberately left out of scope (e.g. state-mandated
carryover exceptions) in the README or a handoff note.
