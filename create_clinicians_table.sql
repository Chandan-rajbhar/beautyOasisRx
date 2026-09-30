-- ============================================================
-- BEAUTY OASIS — CLINICIANS / PROVIDERS SUPABASE MIGRATION
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID extension (if not already)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: clinicians
-- Dedicated table for Medical Staff & Clinical Providers
-- ============================================================
CREATE TABLE IF NOT EXISTS clinicians (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinician_name        TEXT NOT NULL,
  clinical_title        TEXT NOT NULL,
  specialization        TEXT NOT NULL,
  email                 TEXT NOT NULL UNIQUE,
  phone                 TEXT,
  practice_status       TEXT NOT NULL DEFAULT 'Active' CHECK (practice_status IN ('Active', 'Inactive')),
  profile_image_url     TEXT,
  availability_schedule JSONB DEFAULT '{
    "Monday": "09:00 - 17:00",
    "Tuesday": "09:00 - 17:00",
    "Wednesday": "09:00 - 17:00",
    "Thursday": "09:00 - 17:00",
    "Friday": "09:00 - 15:00",
    "Saturday": "Off",
    "Sunday": "Off"
  }'::jsonb,
  biography             TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clinicians_name        ON clinicians(clinician_name);
CREATE INDEX IF NOT EXISTS idx_clinicians_status      ON clinicians(practice_status);
CREATE INDEX IF NOT EXISTS idx_clinicians_email       ON clinicians(email);
CREATE INDEX IF NOT EXISTS idx_clinicians_created_at  ON clinicians(created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Allow anon and authenticated full read/write for Admin Dashboard
-- ============================================================
ALTER TABLE clinicians ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read clinicians" ON clinicians;
CREATE POLICY "Public read clinicians"
  ON clinicians FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow all on clinicians" ON clinicians;
CREATE POLICY "Allow all on clinicians"
  ON clinicians FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- SUPABASE STORAGE BUCKET: clinician-avatars
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('clinician-avatars', 'clinician-avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage object policies
DROP POLICY IF EXISTS "Public access to clinician-avatars" ON storage.objects;
CREATE POLICY "Public access to clinician-avatars"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'clinician-avatars');

DROP POLICY IF EXISTS "Allow upload to clinician-avatars" ON storage.objects;
CREATE POLICY "Allow upload to clinician-avatars"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'clinician-avatars');

DROP POLICY IF EXISTS "Allow update to clinician-avatars" ON storage.objects;
CREATE POLICY "Allow update to clinician-avatars"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'clinician-avatars');

DROP POLICY IF EXISTS "Allow delete from clinician-avatars" ON storage.objects;
CREATE POLICY "Allow delete from clinician-avatars"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'clinician-avatars');
