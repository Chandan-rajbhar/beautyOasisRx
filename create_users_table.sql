-- ============================================================
-- BEAUTY OASIS Rx — USERS TABLE + RLS MIGRATION
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- This replaces the old admin_users table approach.
-- Users are managed via Supabase Auth + a public.users profile table.
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: public.users
-- Linked to auth.users via id (UUID)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'patient'
                CHECK (role IN ('super_admin', 'patient')),
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'inactive')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups & unique lower email enforcement
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_unique_lower_email ON public.users (LOWER(TRIM(email)));
CREATE INDEX IF NOT EXISTS idx_users_email  ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role   ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_users_updated_at ON public.users;
CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- AUTO-INSERT PROFILE ON AUTH SIGNUP TRIGGER
-- When a new auth user is created, automatically insert a
-- corresponding profile row in public.users.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
    'active'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Super admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Super admins can insert users"  ON public.users;
DROP POLICY IF EXISTS "Super admins can update users"  ON public.users;
DROP POLICY IF EXISTS "Super admins can delete users"  ON public.users;
DROP POLICY IF EXISTS "Users can read own profile"     ON public.users;
DROP POLICY IF EXISTS "Users can update own profile"   ON public.users;

-- Helper function: check if caller is a super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'super_admin' AND status = 'active'
  );
$$;

-- ── READ ────────────────────────────────────────────────────
-- Super admins: read ALL users
CREATE POLICY "Super admins can read all users"
  ON public.users FOR SELECT
  USING (public.is_super_admin());

-- Any authenticated user: read their own row only
CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- ── INSERT ──────────────────────────────────────────────────
-- Only super admins can insert new profile rows (or trigger auto-insert)
CREATE POLICY "Super admins can insert users"
  ON public.users FOR INSERT
  WITH CHECK (public.is_super_admin() OR auth.uid() = id);

-- ── UPDATE ──────────────────────────────────────────────────
-- Super admins: update any user row
CREATE POLICY "Super admins can update users"
  ON public.users FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Users: update their own profile (limited fields — enforced by app logic)
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── DELETE ──────────────────────────────────────────────────
-- Only super admins can delete user profiles
CREATE POLICY "Super admins can delete users"
  ON public.users FOR DELETE
  USING (public.is_super_admin());

-- ============================================================
-- SEED: Initial Super Admin
-- Replace with your actual Supabase Auth user UUID after
-- creating the auth user via: Supabase Dashboard → Auth → Users
-- ============================================================
-- INSERT INTO public.users (id, name, email, role, status)
-- VALUES (
--   '<YOUR_AUTH_USER_UUID>',
--   'Dr. Alistair Vance, MD',
--   'admin@beautyoasisrx.com',
--   'super_admin',
--   'active'
-- )
-- ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- GRANT permissions to service_role for admin operations
-- ============================================================
GRANT ALL ON public.users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT ON public.users TO anon;

-- ============================================================
-- DONE
-- ============================================================
-- Next steps:
-- 1. Run this SQL in Supabase Dashboard → SQL Editor
-- 2. Create your first Super Admin user via:
--    Supabase Dashboard → Authentication → Users → Add User
-- 3. The trigger will auto-insert the profile row.
--    Update the role to 'super_admin' manually or via:
--    UPDATE public.users SET role = 'super_admin' WHERE email = 'your@email.com';
-- 4. Update your .env with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
-- ============================================================
