-- ============================================================
-- BEAUTY OASIS Rx — ADD PROFILE PHOTO COLUMNS TO PUBLIC.USERS
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Add profile_photo_url and avatar columns to public.users if they don't already exist
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS avatar TEXT;

-- Reload PostgREST schema cache so the API immediately recognizes the new columns
NOTIFY pgrst, 'reload schema';
