-- ============================================================
-- BEAUTY OASIS Rx — APPOINTMENT TIMES TABLE & RLS SETUP
-- Run this in your Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. Enable UUID generation if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create appointment_times table (starts completely empty, no static seed)
CREATE TABLE IF NOT EXISTS public.appointment_times (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_time  TEXT NOT NULL UNIQUE,
  status            TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointment_times_updated_at ON public.appointment_times;
CREATE TRIGGER trg_appointment_times_updated_at
  BEFORE UPDATE ON public.appointment_times
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.appointment_times ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on public.appointment_times" ON public.appointment_times;
CREATE POLICY "Allow all on public.appointment_times"
  ON public.appointment_times FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- 5. Permissions
GRANT ALL ON public.appointment_times TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;

-- 6. Reload Schema Cache
NOTIFY pgrst, 'reload schema';

