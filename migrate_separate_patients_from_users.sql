

-- ── STEP 1: Ensure all columns exist in public.patients ──────────────────────
-- (Safe to run even if columns already exist)
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS residential_address TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Patient';
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS "profilePhotoUrl" TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS total_appointments INTEGER DEFAULT 0;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS total_spent NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ── STEP 2: Update trigger so only super_admins enter public.users ────────────
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF LOWER(COALESCE(NEW.raw_user_meta_data->>'role', '')) = 'super_admin' THEN
    INSERT INTO public.users (id, name, email, role, status)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      NEW.email,
      'super_admin',
      'active'
    )
    ON CONFLICT (id) DO UPDATE
      SET name = COALESCE(EXCLUDED.name, public.users.name),
          role = 'super_admin',
          status = 'active',
          updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ── STEP 3: Remove patient records from public.users ─────────────────────────
DELETE FROM public.users
WHERE LOWER(role) = 'patient' OR role NOT IN ('super_admin');

-- ── STEP 4: Tighten CHECK constraint on public.users ─────────────────────────
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('super_admin'));
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'super_admin';

-- ── STEP 5: RLS Policies ──────────────────────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on public.users" ON public.users;
CREATE POLICY "Allow all on public.users"
  ON public.users FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
