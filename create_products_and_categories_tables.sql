-- ============================================================
-- BEAUTY OASIS Rx — PRODUCTS & CATEGORIES TABLES SETUP
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create CATEGORIES Table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Non-recursive RLS for categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on public.categories" ON public.categories;
CREATE POLICY "Allow all on public.categories"
  ON public.categories FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.categories TO authenticated, anon, service_role;

-- Default Categories Seed
INSERT INTO public.categories (name)
VALUES
  ('Serums & Actives'),
  ('Cleansers & Tonics'),
  ('Creams & Balms'),
  ('Sun Protection'),
  ('Treatment Kits')
ON CONFLICT (name) DO NOTHING;


-- 3. Create PRODUCTS Table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Serums & Actives',
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  sku TEXT NOT NULL UNIQUE,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  original_price NUMERIC(10,2),
  stock INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'In Stock',
  subtitle TEXT,
  description TEXT,
  image TEXT,
  image_url TEXT,
  badge TEXT,
  badge_color TEXT,
  ingredients TEXT,
  usage TEXT,
  usage_instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all product columns exist
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS subtitle TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Serums & Actives';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id UUID;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'In Stock';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Non-recursive RLS for products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on public.products" ON public.products;
CREATE POLICY "Allow all on public.products"
  ON public.products FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.products TO authenticated, anon, service_role;

-- 4. Storage Bucket for Products
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public Access products" ON storage.objects;
CREATE POLICY "Public Access products" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'products');

DROP POLICY IF EXISTS "Public Upload products" ON storage.objects;
CREATE POLICY "Public Upload products" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'products');

DROP POLICY IF EXISTS "Public Update products" ON storage.objects;
CREATE POLICY "Public Update products" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'products');

-- 5. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
