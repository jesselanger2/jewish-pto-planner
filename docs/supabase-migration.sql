-- docs/supabase-migration.sql
--
-- Supabase Postgres migration for Jewish PTO Planner.
-- Run this in the Supabase SQL editor or via `supabase db push`.
--
-- Security model:
--   Every table has RLS enabled. All policies restrict access to
--   auth.uid() = user_id — a user can only read/write their own rows.
--   The service-role key is NEVER used in the browser. All browser-side
--   queries use the anon key, which cannot bypass these policies.

-- ---------------------------------------------------------------------------
-- profiles (optional extended user info — email verified, display name)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: owner read"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: owner insert"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: owner update"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: owner delete"
  ON profiles FOR DELETE
  USING (auth.uid() = id);

-- Auto-create profile on new user signup (no service-role key needed in browser)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ---------------------------------------------------------------------------
-- planner_settings (one row per user — upserted on save)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS planner_settings (
  user_id       UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  settings_json JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE planner_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planner_settings: owner read"
  ON planner_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "planner_settings: owner insert"
  ON planner_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "planner_settings: owner update"
  ON planner_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "planner_settings: owner delete"
  ON planner_settings FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast lookup by owner
CREATE INDEX IF NOT EXISTS planner_settings_user_id_idx ON planner_settings (user_id);

-- ---------------------------------------------------------------------------
-- saved_plans (one row per snapshot, many per user)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS saved_plans (
  id            TEXT NOT NULL,
  user_id       UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  snapshot_json JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

ALTER TABLE saved_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_plans: owner read"
  ON saved_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "saved_plans: owner insert"
  ON saved_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_plans: owner update"
  ON saved_plans FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_plans: owner delete"
  ON saved_plans FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast lookup by owner, newest first
CREATE INDEX IF NOT EXISTS saved_plans_user_id_created_idx
  ON saved_plans (user_id, created_at DESC);
