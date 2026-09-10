# Phase 4 — Usable application UI

Read `docs/SPEC.md` in full before starting, especially "UX Views" and its
Interaction rules. The domain engine from Phases 1–3 already exists — this
phase is a thin feature layer over it. Do not duplicate engine calculations
in components.

## This phase's task

Build the primary views from `docs/SPEC.md`: dashboard, configuration,
holiday rules, calendar/timeline, recommendations, ledger, and locked-date
interactions (lock/remove + regenerate with explained changes). Follow the
Interaction requirements in the spec: native controls only for constrained
fields, visible assumptions/disclaimer, "dates to request" framing (never
implying employer approval), deliberate empty/loading/validation/
no-recommendation/infeasible states, keyboard operability, visible focus,
semantic headings, contrast-compliant and non-color-only markings.

## Exit criteria

A new user can configure a policy, generate a plan, understand each
recommendation, and inspect its balance effects — without opening dev
tools.

When exit criteria are met, run the relevant checks, fix failures, then
stop. Summarize what's built and anything deferred to Phase 5.
