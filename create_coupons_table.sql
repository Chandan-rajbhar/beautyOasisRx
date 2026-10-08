-- ============================================================
-- BEAUTY OASIS Rx — COUPONS TABLE SETUP
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create COUPONS Table
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  coupon_code TEXT,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2),
  discount_percent NUMERIC(10,2),
  min_order_amount NUMERIC(10,2) DEFAULT 0,
  min_spend NUMERIC(10,2) DEFAULT 0,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  max_uses INTEGER,
  times_used INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active',
  start_date TIMESTAMPTZ DEFAULT NOW(),
  expiry_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all columns exist in case table was partially created
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'percentage';
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2);
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(10,2);
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS min_spend NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS usage_limit INTEGER;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS max_uses INTEGER;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS times_used INTEGER DEFAULT 0;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMPTZ;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Enable Row Level Security (RLS)
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Clean and idempotent all-access RLS Policy for dashboard management
DROP POLICY IF EXISTS "Allow all on public.coupons" ON public.coupons;
DROP POLICY IF EXISTS "Allow anon read coupons" ON public.coupons;
DROP POLICY IF EXISTS "Allow anon insert coupons" ON public.coupons;
DROP POLICY IF EXISTS "Allow anon update coupons" ON public.coupons;
DROP POLICY IF EXISTS "Allow anon delete coupons" ON public.coupons;

CREATE POLICY "Allow all on public.coupons"
  ON public.coupons FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.coupons TO authenticated, anon, service_role;
