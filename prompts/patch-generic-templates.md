# Patch — Remove employer branding, add generic starter templates + fully custom setup

Read the current `docs/SPEC.md` in full before starting. The
"Employer Policy Preset: Citi (US)" section has been **replaced** with a
"Starter Policy Templates (and Fully Custom Setup)" section — this patch
undoes the branded work from `patch-citi-policy.md` and replaces it with
that generic system. The underlying domain mechanisms from that earlier
patch (`carryoverDeadline`, `unpaid`, `isFloatingHoliday`,
`countsTowardVacationLossInvariant`) are correct and stay exactly as they
are — only the branded preset and its UI/copy/fixtures are being removed.

## Why

This app is headed for public release. Shipping one named employer's
specific policy numbers as a default is a liability (the numbers can go
stale or be wrong) and unnecessarily narrows who the app is useful to.
Generic, clearly-illustrative templates plus a first-class custom option
give every user the same value without either problem.

## Task

1. **Remove Citi branding everywhere.** Search the whole repo — source,
   copy/strings, fixtures, tests, README, comments — for "Citi" and any
   Citi-specific numbers presented as defaults (12 named holidays, the
   10-day/80-hour cap, the April 1 deadline, "Heritage Day," "Religious
   observance," "Volunteer Day," the 7-day sick balance) where they appear
   as a *branded, shipped preset*. Confirm none of it remains reachable
   from the running app.
2. **Add the starter-template system** described in `docs/SPEC.md`: at
   least the four templates listed there (simple accrual + cap, annual
   grant with no carryover, two-stage carryover with a use-by deadline,
   unpaid bank with paid substitution), each using generic labels and
   clearly-marked placeholder numbers — never presented as a real
   employer's policy.
3. **Add the fully-custom path**: a blank-slate onboarding flow, using the
   same guided steps as the templates, with every bank starting at
   zero/blank. Make it equally visible in the UI as the templates — a
   peer option, not a secondary "advanced" link.
4. **Update onboarding/settings UI**: replace the old "Load Citi (US)
   preset" action with a template picker (cards or a similar pattern) that
   shows all templates plus "Start from scratch," and make sure the
   generic mechanisms this exercises (two-stage cliff forfeiture, unpaid
   vs. paid holiday-rule ordering, floating-holiday scheduling) are still
   visibly explained to the user in template descriptions.
5. **Update tests and fixtures**: rename/rewrite any test fixtures that
   encoded Citi-specific numbers to use generic placeholder values instead,
   while preserving the *scenarios* they were testing (two-stage
   forfeiture, unpaid-bank tracking, floating-holiday scheduling). Add a
   test for the fully-custom path end to end.
6. **Update the README**: state plainly that no named-employer preset
   ships, describe the starter templates and the custom path, and remove
   any remaining Citi-specific text.

## Exit criteria

- A repo-wide search for "Citi" (case-insensitive) returns no shipped
  app copy, code, fixtures, or README content — only, at most, this
  patch's own history in commit messages.
- All four starter templates and the fully-custom path are selectable
  from onboarding and each produce a working plan.
- Existing tests for the two-stage cliff, unpaid-bank tracking, and
  floating-holiday scheduling still pass, now under generic naming/values.

When exit criteria are met, run every available quality command, fix
failures, and summarize what was removed, what replaced it, and anything
deferred (e.g. additional templates) in the README or a handoff note.
