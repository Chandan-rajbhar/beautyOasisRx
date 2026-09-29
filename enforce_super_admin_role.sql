-- ============================================================
-- BEAUTY OASIS Rx — FIX USERS TABLE & RLS RECURSION MIGRATION
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
--
-- 1. Drops old recursive RLS policies and functions
-- 2. Ensures all required columns exist on public.users
-- 3. Enables clean, non-recursive RLS for public.users
-- 4. Syncs existing Super Admin auth accounts to public.users
-- 5. Updates auth signup trigger for Super Admins only
-- 6. Grants full permissions to authenticated & anon
-- ============================================================

-- ── 1. ENSURE COLUMNS EXIST ON public.users ───────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'super_admin';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ── 2. DROP ALL OLD / RECURSIVE RLS POLICIES & FUNCTIONS ──────
DROP POLICY IF EXISTS "Super admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Super admins can insert users"   ON public.users;
DROP POLICY IF EXISTS "Super admins can update users"   ON public.users;
DROP POLICY IF EXISTS "Super admins can delete users"   ON public.users;
DROP POLICY IF EXISTS "Users can read own profile"      ON public.users;
DROP POLICY IF EXISTS "Users can update own profile"    ON public.users;
DROP POLICY IF EXISTS "Allow all on public.users"       ON public.users;
DROP POLICY IF EXISTS "Allow all access to users"       ON public.users;
DROP POLICY IF EXISTS "Allow authenticated full access to users" ON public.users;
DROP POLICY IF EXISTS "Allow anon read users"           ON public.users;

-- Drop recursive helper function if present
DROP FUNCTION IF EXISTS public.is_super_admin();

-- ── 3. CREATE CLEAN, NON-RECURSIVE RLS POLICY ─────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on public.users"
  ON public.users FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- ── 4. GRANT TABLE & SCHEMA PERMISSIONS ───────────────────────
GRANT ALL ON public.users TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;

-- ── 5. UPDATE TRIGGER: Only insert super_admin into users ─────
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Only super_admin accounts belong in public.users
  IF LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'role', ''))) = 'super_admin' THEN
    INSERT INTO public.users (id, name, email, role, status)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      NEW.email,
      'super_admin',
      'active'
    )
    ON CONFLICT (id) DO UPDATE
      SET
        name       = COALESCE(EXCLUDED.name, public.users.name),
        role       = 'super_admin',
        status     = 'active',
        updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ── 6. SYNC EXISTING SUPER ADMIN AUTH USERS INTO public.users ──
INSERT INTO public.users (id, name, email, role, status, created_at, updated_at)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1)),
  email,
  'super_admin',
  'active',
  created_at,
  NOW()
FROM auth.users
WHERE LOWER(TRIM(email)) = 'admin@beautyoasisrx.com'
   OR LOWER(TRIM(COALESCE(raw_user_meta_data->>'role', ''))) = 'super_admin'
ON CONFLICT (id) DO UPDATE
  SET
    role       = 'super_admin',
    status     = 'active',
    updated_at = NOW();

-- ── 7. CLEANUP: Remove patient records from public.users ───────
DELETE FROM public.users
WHERE LOWER(TRIM(COALESCE(role, ''))) = 'patient'
   OR (
     LOWER(TRIM(COALESCE(role, ''))) != 'super_admin'
     AND NOT LOWER(TRIM(COALESCE(role, ''))) LIKE '%admin%'
   );

-- ── 8. RELOAD SCHEMA CACHE ────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- Verification output
SELECT id, name, email, role, status, created_at FROM public.users;
