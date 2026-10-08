-- ============================================================
-- BEAUTY OASIS Rx — CLEAN DATABASE SETUP SCRIPT
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- (No static treatment protocols inserted — ready for real data)
-- ============================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- 2. Create CATEGORIES Table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist in case table was partially created
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Row Level Security (RLS) for categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on public.categories" ON public.categories;
CREATE POLICY "Allow all on public.categories"
  ON public.categories FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.categories TO authenticated, anon, service_role;

-- Seed default clinical categories
INSERT INTO public.categories (name)
VALUES
  ('Skin Rejuvenation'),
  ('Anti-Ageing'),
  ('Laser & IPL'),
  ('Body Contouring'),
  ('Injectables & Fillers'),
  ('Acne & Scarring'),
  ('Men''s Aesthetics')
ON CONFLICT (name) DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- 3. Create DURATIONS Table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.durations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT NOT NULL UNIQUE,
  minutes     INT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist
ALTER TABLE public.durations ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE public.durations ADD COLUMN IF NOT EXISTS minutes INT;
ALTER TABLE public.durations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.durations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Row Level Security (RLS) for durations
ALTER TABLE public.durations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on public.durations" ON public.durations;
CREATE POLICY "Allow all on public.durations"
  ON public.durations FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.durations TO authenticated, anon, service_role;

-- Seed default clinical durations
INSERT INTO public.durations (label, minutes)
VALUES
  ('15 Mins', 15),
  ('30 Mins', 30),
  ('45 Mins', 45),
  ('60 Mins', 60),
  ('75 Mins', 75),
  ('90 Mins', 90),
  ('120 Mins', 120)
ON CONFLICT (label) DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- 4. Create TREATMENT_PROTOCOLS Table (NO STATIC DATA)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.treatment_protocols (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_title        TEXT NOT NULL,
  category_id           UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  category              TEXT NOT NULL DEFAULT 'Skin Rejuvenation',
  price                 NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration              TEXT NOT NULL DEFAULT '60 Mins',
  status                TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  appointment_date      TEXT,
  appointment_time      TEXT,
  tagline               TEXT,
  clinical_description  TEXT,
  image_url             TEXT,
  images                JSONB DEFAULT '[]'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all required columns exist in case table was partially created
ALTER TABLE public.treatment_protocols ADD COLUMN IF NOT EXISTS protocol_title TEXT;
ALTER TABLE public.treatment_protocols ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE public.treatment_protocols ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.treatment_protocols ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.treatment_protocols ADD COLUMN IF NOT EXISTS duration TEXT DEFAULT '60 Mins';
ALTER TABLE public.treatment_protocols ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.treatment_protocols ADD COLUMN IF NOT EXISTS appointment_date TEXT;
ALTER TABLE public.treatment_protocols ADD COLUMN IF NOT EXISTS appointment_time TEXT;
ALTER TABLE public.treatment_protocols ADD COLUMN IF NOT EXISTS tagline TEXT;
ALTER TABLE public.treatment_protocols ADD COLUMN IF NOT EXISTS clinical_description TEXT;
ALTER TABLE public.treatment_protocols ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.treatment_protocols ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.treatment_protocols ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.treatment_protocols ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_treatment_protocols_title      ON public.treatment_protocols(protocol_title);
CREATE INDEX IF NOT EXISTS idx_treatment_protocols_category   ON public.treatment_protocols(category);
CREATE INDEX IF NOT EXISTS idx_treatment_protocols_status     ON public.treatment_protocols(status);
CREATE INDEX IF NOT EXISTS idx_treatment_protocols_created_at ON public.treatment_protocols(created_at DESC);

-- Row Level Security (RLS) for treatment_protocols
ALTER TABLE public.treatment_protocols ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on public.treatment_protocols" ON public.treatment_protocols;
CREATE POLICY "Allow all on public.treatment_protocols"
  ON public.treatment_protocols FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.treatment_protocols TO authenticated, anon, service_role;

-- ─────────────────────────────────────────────────────────────
-- 5. STORAGE BUCKET: treatments
-- ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('treatments', 'treatments', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access Treatments'
  ) THEN
    CREATE POLICY "Public Access Treatments" ON storage.objects
      FOR SELECT TO public USING (bucket_id = 'treatments');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Insert Treatments'
  ) THEN
    CREATE POLICY "Public Insert Treatments" ON storage.objects
      FOR INSERT TO public WITH CHECK (bucket_id = 'treatments');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Update Treatments'
  ) THEN
    CREATE POLICY "Public Update Treatments" ON storage.objects
      FOR UPDATE TO public USING (bucket_id = 'treatments');
  END IF;
END $$;
