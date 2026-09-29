-- ============================================================
-- BEAUTY OASIS Rx — FIX LOGIN, CONFIRM USERS & SET SUPER ADMIN
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- 1. Auto-confirm all unconfirmed users in Supabase Auth
-- (This fixes the "Email not confirmed" error so you can log in immediately)
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email_confirmed_at IS NULL;

-- 2. Ensure all existing user profiles have role = 'super_admin' and status = 'active'
UPDATE public.users
SET
  role = 'super_admin',
  status = 'active',
  updated_at = NOW();

-- 3. If any auth.users are missing from public.users, create their profile rows
INSERT INTO public.users (id, name, email, role, status)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  au.email,
  'super_admin',
  'active'
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO UPDATE
  SET role = 'super_admin', status = 'active', updated_at = NOW();

-- 4. Update the trigger so EVERY future signup is automatically super_admin
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 5. Fix RLS policies so users can read and update their own profile seamlessly
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Super admins can read all users" ON public.users;
CREATE POLICY "Super admins can read all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'super_admin' AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Allow user insert own profile" ON public.users;
CREATE POLICY "Allow user insert own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Done!
SELECT id, email, role, status FROM public.users;
