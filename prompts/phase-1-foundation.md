# Phase 1 — Foundation and schemas

Read `docs/SPEC.md` in full before starting, especially the Stack,
Architecture, and Domain Data Model sections. Stay inside this phase's
scope — no calendar logic, no Hebcal, no planner/optimizer yet.

## This phase's task

- Set up TypeScript strict mode, Tailwind, and test tooling (Vitest, React
  Testing Library). Add routing only if it clearly helps the product.
- Add the domain models and Zod schemas from `docs/SPEC.md`'s Domain Data
  Model section.
- Add ISO-date utilities (civil dates only — no UTC round-tripping).
- Add a versioned local repository storage implementation
  (`PlannerRepository` interface, local-storage adapter) that can save and
  restore settings, validated with Zod and able to migrate/reset corrupt
  records safely.

## Exit criteria

- Schemas and date helpers have unit tests.
- Local settings can be saved and restored through the repository
  interface.

When exit criteria are met, run type check, lint, and tests, fix failures,
then stop. Summarize what you built, what you tested, and any assumptions
you documented in the README, per `docs/SPEC.md`'s Working Rules.
