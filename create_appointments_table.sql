-- ============================================================
-- BEAUTY OASIS Rx — APPOINTMENTS TABLE & RLS SETUP
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- (Be sure to select all lines and run the entire script!)
-- ============================================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create appointments table if not exists
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT,
  client_id TEXT,
  treatment_protocol_id TEXT,
  service_id TEXT,
  clinician_id TEXT,
  provider_id TEXT,
  patient_name TEXT,
  client_name TEXT,
  patient_email TEXT,
  client_email TEXT,
  patient_phone TEXT,
  client_phone TEXT,
  protocol_title TEXT,
  service_name TEXT,
  clinician_name TEXT,
  provider_name TEXT,
  appointment_date TEXT,
  date TEXT,
  appointment_time TEXT,
  time TEXT,
  start_time TEXT,
  end_time TEXT,
  duration TEXT DEFAULT '60 Mins',
  status TEXT NOT NULL DEFAULT 'Confirmed',
  payment_status TEXT NOT NULL DEFAULT 'Pending',
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Ensure all columns exist in case table was partially created
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS patient_id TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS treatment_protocol_id TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS service_id TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS clinician_id TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS provider_id TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS patient_name TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS patient_email TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS client_email TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS patient_phone TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS client_phone TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS protocol_title TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS service_name TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS clinician_name TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS provider_name TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS appointment_date TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS appointment_time TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS time TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS start_time TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS end_time TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS duration TEXT DEFAULT '60 Mins';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Confirmed';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Pending';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_clinician_id ON public.appointments(clinician_id);
CREATE INDEX IF NOT EXISTS idx_appointments_protocol_id ON public.appointments(treatment_protocol_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_payment_status ON public.appointments(payment_status);
CREATE INDEX IF NOT EXISTS idx_appointments_created_at ON public.appointments(created_at DESC);

-- 5. Row Level Security (RLS)
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on public.appointments" ON public.appointments;
CREATE POLICY "Allow all on public.appointments"
  ON public.appointments FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- 6. Permissions
GRANT ALL ON public.appointments TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;

-- 7. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
