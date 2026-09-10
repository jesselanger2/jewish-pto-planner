# Phase 6 — Quality, deployment, and documentation

Read `docs/SPEC.md` in full before starting, especially "Final Acceptance
Criteria" and "Deliverables." This is the closing phase — treat the
acceptance criteria list as your checklist.

## This phase's task

Complete accessibility work, error handling, responsive review, dependency/
security review, CI configuration, and deployment configuration. Update the
README with everything listed under "Deliverables" in `docs/SPEC.md`:
architecture overview + invariants, all commands, env variable reference,
Hebcal/Diaspora-Israel attribution, privacy statement + deletion
instructions, and a description of the optimizer objective order and how
infeasibility is reported.

## Exit criteria

All required checks pass in CI, and a new developer can run the app from
the README alone with no undocumented steps.

## Before you finish

Go through every item in `docs/SPEC.md`'s "Final Acceptance Criteria"
(1–12) one by one and confirm each is actually true — don't just assert it.
Review the diff for accidental unrelated changes. Run every available
quality command and fix failures. Summarize implementation decisions,
verification results, and any intentionally deferred scope in the README
or a final handoff note.
