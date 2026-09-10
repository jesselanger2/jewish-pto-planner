# Phase 5 — Save, export, and accounts

Read `docs/SPEC.md` in full before starting, especially "Persistence and
Authentication" and "Validation, Privacy, Security." Local-only usage must
keep working throughout this phase.

## This phase's task

- Add named plan snapshots, CSV export, and `.ics` calendar export.
- Finish the local persistence experience (versioned, Zod-validated,
  self-healing on corruption).
- Add Supabase authentication and RLS-backed persistence, but only when
  credentials are present in the environment; local-only fallback must
  keep working when they're absent. Follow the spec's table/RLS/secret-
  handling requirements exactly — no service-role key in the browser, RLS
  on every table restricted to `auth.uid() = user_id`.

## Exit criteria

- No account is required to plan locally.
- Signed-in users can save private settings/plans across sessions.
- No cross-user data access is possible (verify with a test where
  supported).

When exit criteria are met, run the relevant checks, fix failures, then
stop. Summarize what's built, how you verified isolation, and anything
deferred to Phase 6.
