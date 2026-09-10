# Phase 0 — Inspect and establish the baseline

Read `docs/SPEC.md` in full before doing anything else. It is the
persistent spec for this whole project and governs every phase, including
this one. Do not implement features from later phases yet.

## This phase's task

Inspect the repository and run its existing checks (build, lint, type
check, tests — whatever is configured). Do not delete unrelated files or
user changes. Write or update a concise README section describing:

- The intended architecture (summarize from `docs/SPEC.md`).
- Setup/dev/test/lint/build commands as they exist today.
- Key assumptions you're making about the starting state of the repo.
- The PTO-loss invariant, stated plainly, so it's visible from the README
  alone.

If the repo is empty, note that and record the stack choices from
`docs/SPEC.md` as the plan going forward.

## Exit criteria

- Existing checks still pass (or their absence is explicitly noted).
- Selected stack and assumptions are documented in the README.

When exit criteria are met, stop. Summarize what you found, what you wrote,
and anything you deferred to Phase 1.
