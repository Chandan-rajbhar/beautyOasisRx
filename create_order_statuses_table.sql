-- ============================================================
-- BEAUTY OASIS RX — ORDER STATUSES TABLE & RLS SETUP
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.order_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  color TEXT DEFAULT '#1e5aa8',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.order_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on public.order_statuses" ON public.order_statuses;
CREATE POLICY "Allow all on public.order_statuses"
  ON public.order_statuses
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.order_statuses TO authenticated, anon, service_role;

-- Seed default statuses if not existing
INSERT INTO public.order_statuses (name, key, description, is_active, display_order, color)
VALUES
  ('Pending', 'Pending', 'Order created and awaiting initial validation.', TRUE, 1, '#ca8a04'),
  ('Confirmed', 'Confirmed', 'Compounding and prescription fulfillment in progress.', TRUE, 2, '#d97706'),
  ('Placed', 'Placed', 'Order officially placed by patient or clinical coordinator.', TRUE, 3, '#0284c7'),
  ('Ordered', 'Ordered', 'Order transmitted to clinical apothecary or manufacturer.', TRUE, 4, '#1e5aa8'),
  ('Ready for Pickup', 'Ready for Pickup', 'Apothecary package ready at Allen clinic concierge desk.', TRUE, 5, '#0891b2'),
  ('Fulfilled', 'Fulfilled', 'Order delivered, picked up, or fulfilled successfully.', TRUE, 6, '#15803d'),
  ('Cancelled', 'Cancelled', 'Order cancelled and voided.', TRUE, 7, '#dc2626')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  color = EXCLUDED.color;

-- Clean up old/removed statuses if they were previously created
DELETE FROM public.order_statuses 
WHERE key ILIKE '%Preparation%' 
   OR name ILIKE '%Preparation%'
   OR key ILIKE '%Waiting for Frame%'
   OR name ILIKE '%Waiting for Frame%';

-- Update all existing orders in Supabase from 'Confirmed / In Preparation' to 'Confirmed'
UPDATE public.orders 
SET order_status = 'Confirmed' 
WHERE order_status ILIKE '%Preparation%';

NOTIFY pgrst, 'reload schema';
