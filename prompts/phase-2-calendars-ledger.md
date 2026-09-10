# Phase 2 — Calendars and policy ledger

Read `docs/SPEC.md` in full before starting, especially "Calendar and
Holiday Rules" and "PTO Ledger and Hard Constraints." Stay inside this
phase's scope — no optimizer/planner and no UI screens beyond what's needed
to exercise the engine in tests yet.

## This phase's task

- Implement `classifyDay(date, employerPolicy)` and workday classification:
  configurable weekends, opt-in US federal holidays with observed-day
  handling, company/custom closures as authoritative overrides.
- Build the `@hebcal/core` adapter module per the spec: canonical
  `holidayId`s, Diaspora/Israel handling, the full holiday mapping list,
  boundary buffer on the requested range.
- Implement the PTO bank ledger: chronological event processing, accruals,
  grants, rollovers/expirations, separate banks, the "never mutate a past
  entry" rule.

## Exit criteria

- Tests prove correct day classifications and balances across a multi-year
  horizon.
- Tests cover a non-January policy year.
- Tests cover negative-balance rules (both allowed and disallowed cases).

When exit criteria are met, run the relevant checks, fix failures, then
stop. Summarize what's implemented, what's tested, and anything deferred
to Phase 3.
