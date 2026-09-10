# Phase 3 — Planner and independent validator

Read `docs/SPEC.md` in full before starting, especially "Optimizer" and the
zero-vacation-loss invariant under "PTO Ledger and Hard Constraints." This
is the highest-risk phase — do not relax or approximate the zero-loss rule
for convenience.

## This phase's task

- Implement the full planning pipeline from `docs/SPEC.md`'s Optimizer
  section: candidate generation, staged/lexicographic selection, required
  coverage, rollover-protection demand, zero-loss rollover protection,
  human-readable explanations for each recommendation and each rejection.
- Implement a separate ledger-replay validator that independently confirms
  the chosen plan — it is the final authority, even over the solver.
- Build representative fixtures: normal case, negative-balance case,
  rollover-cap case, Diaspora vs. Israel, and at least one genuinely
  infeasible case.

## Exit criteria

- A three-year plan is deterministic (same settings → same plan).
- Every valid fixture shows zero vacation forfeiture.
- Every infeasible fixture returns an explicit `infeasible` result with
  projected loss and causes — never mislabeled as valid.

When exit criteria are met, run the relevant checks, fix failures, then
stop. Summarize the selection method you used, why, and anything deferred
to Phase 4.
