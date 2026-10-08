-- =====================================================================
-- Migration: Add image_url to treatment_protocols and configure storage
-- =====================================================================

-- 1. Add image_url and images columns to public.treatment_protocols
ALTER TABLE public.treatment_protocols
ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE public.treatment_protocols
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- 2. Create 'treatments' storage bucket if it does not already exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('treatments', 'treatments', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies to allow public read, insert, and update
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
