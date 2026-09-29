-- ============================================================
-- BEAUTY OASIS Rx — PATIENTS TABLE & RLS SETUP
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create the patients table if not exists
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT,
  name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  date_of_birth DATE,
  dob DATE,
  residential_address TEXT,
  address TEXT,
  status TEXT DEFAULT 'Active',
  account_status TEXT DEFAULT 'Active',
  role TEXT DEFAULT 'Patient',
  "profilePhotoUrl" TEXT,
  profile_photo_url TEXT,
  avatar TEXT,
  total_appointments INTEGER DEFAULT 0,
  total_spent NUMERIC(10,2) DEFAULT 0,
  last_visit TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ensure all columns exist
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS residential_address TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'Active';
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Patient';
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS "profilePhotoUrl" TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS total_appointments INTEGER DEFAULT 0;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS total_spent NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS last_visit TIMESTAMPTZ;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Unique case-insensitive index on email
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_unique_lower_email ON public.patients (LOWER(TRIM(email)));

-- 5. Row Level Security (RLS)
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon all on patients" ON public.patients;
DROP POLICY IF EXISTS "Allow all on public.patients" ON public.patients;
CREATE POLICY "Allow all on public.patients"
  ON public.patients
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- 6. Permissions
GRANT ALL ON public.patients TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;

-- 7. Supabase Storage bucket for avatars (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public Access avatars" ON storage.objects;
CREATE POLICY "Public Access avatars" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Public Upload avatars" ON storage.objects;
CREATE POLICY "Public Upload avatars" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Public Update avatars" ON storage.objects;
CREATE POLICY "Public Update avatars" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'avatars');

-- 8. Reload Schema Cache
NOTIFY pgrst, 'reload schema';

-- Verification output
SELECT id, full_name, email, phone, status, role, created_at FROM public.patients;
