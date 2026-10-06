-- ============================================================
-- BEAUTY OASIS Rx — ACTIVITY LOGS TABLE, RLS & REALTIME
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- 1. Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create activity_logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'appointment',
  entity_id TEXT,
  user_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Safely ensure all required columns exist (idempotent)
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS entity_type TEXT DEFAULT 'appointment';
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.activity_logs (action);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
DROP POLICY IF EXISTS "Allow anon read activity_logs" ON public.activity_logs;
CREATE POLICY "Allow anon read activity_logs" ON public.activity_logs
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow anon insert activity_logs" ON public.activity_logs;
CREATE POLICY "Allow anon insert activity_logs" ON public.activity_logs
  FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update activity_logs" ON public.activity_logs;
CREATE POLICY "Allow anon update activity_logs" ON public.activity_logs
  FOR UPDATE TO public USING (true);

DROP POLICY IF EXISTS "Allow anon delete activity_logs" ON public.activity_logs;
CREATE POLICY "Allow anon delete activity_logs" ON public.activity_logs
  FOR DELETE TO public USING (true);

-- 7. Enable Realtime Replication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  WHEN undefined_object THEN
    NULL;
  END;
END $$;

-- 8. Backfill initial historical activity from existing practice records
DO $$
BEGIN
  -- Backfill from appointments (up to 15 recent)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'appointments') THEN
    INSERT INTO public.activity_logs (action, description, entity_type, entity_id, created_at)
    SELECT
      'appointment_scheduled',
      'Appointment scheduled for ' || COALESCE(to_jsonb(a)->>'patient_name', to_jsonb(a)->>'client_name', 'Patient') || ' (' || COALESCE(to_jsonb(a)->>'protocol_title', to_jsonb(a)->>'service_name', 'Treatment Protocol') || ')',
      'appointment',
      to_jsonb(a)->>'id',
      COALESCE(NULLIF(to_jsonb(a)->>'created_at', '')::timestamptz, NOW())
    FROM public.appointments a
    WHERE to_jsonb(a)->>'id' IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.activity_logs al
        WHERE al.entity_id = to_jsonb(a)->>'id' AND al.entity_type = 'appointment'
      )
    ORDER BY COALESCE(NULLIF(to_jsonb(a)->>'created_at', '')::timestamptz, NOW()) DESC
    LIMIT 15;
  END IF;

  -- Backfill from patients / clients (up to 10 recent)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'patients') THEN
    INSERT INTO public.activity_logs (action, description, entity_type, entity_id, created_at)
    SELECT
      'patient_registered',
      'New patient registered: ' || COALESCE(to_jsonb(p)->>'name', to_jsonb(p)->>'full_name', 'New Patient'),
      'patient',
      to_jsonb(p)->>'id',
      COALESCE(NULLIF(to_jsonb(p)->>'created_at', '')::timestamptz, NOW())
    FROM public.patients p
    WHERE to_jsonb(p)->>'id' IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.activity_logs al
        WHERE al.entity_id = to_jsonb(p)->>'id' AND al.entity_type = 'patient'
      )
    ORDER BY COALESCE(NULLIF(to_jsonb(p)->>'created_at', '')::timestamptz, NOW()) DESC
    LIMIT 10;
  END IF;

  -- Backfill from payments (up to 10 recent)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
    INSERT INTO public.activity_logs (action, description, entity_type, entity_id, created_at)
    SELECT
      'payment_received',
      'Payment of $' || COALESCE(to_jsonb(pm)->>'amount', to_jsonb(pm)->>'total_amount', '0') || ' processed (' || COALESCE(to_jsonb(pm)->>'status', to_jsonb(pm)->>'payment_status', 'Paid') || ')',
      'payment',
      to_jsonb(pm)->>'id',
      COALESCE(NULLIF(to_jsonb(pm)->>'created_at', '')::timestamptz, NOW())
    FROM public.payments pm
    WHERE to_jsonb(pm)->>'id' IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.activity_logs al
        WHERE al.entity_id = to_jsonb(pm)->>'id' AND al.entity_type = 'payment'
      )
    ORDER BY COALESCE(NULLIF(to_jsonb(pm)->>'created_at', '')::timestamptz, NOW()) DESC
    LIMIT 10;
  END IF;

  -- Backfill from orders (up to 10 recent)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    INSERT INTO public.activity_logs (action, description, entity_type, entity_id, created_at)
    SELECT
      'order_placed',
      'Apothecary order #' || COALESCE(to_jsonb(o)->>'order_number', to_jsonb(o)->>'id', 'Order') || ' placed',
      'order',
      to_jsonb(o)->>'id',
      COALESCE(NULLIF(to_jsonb(o)->>'created_at', '')::timestamptz, NOW())
    FROM public.orders o
    WHERE to_jsonb(o)->>'id' IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.activity_logs al
        WHERE al.entity_id = to_jsonb(o)->>'id' AND al.entity_type = 'order'
      )
    ORDER BY COALESCE(NULLIF(to_jsonb(o)->>'created_at', '')::timestamptz, NOW()) DESC
    LIMIT 10;
  END IF;
END $$;

-- 9. Automatic Triggers for Real-time Activity Logging
-- Trigger function for appointment events
CREATE OR REPLACE FUNCTION public.fn_log_appointment_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.activity_logs (action, description, entity_type, entity_id, metadata, created_at)
    VALUES (
      'appointment_scheduled',
      'Appointment scheduled for ' || COALESCE(NEW.patient_name, NEW.client_name, 'Patient') || ' (' || COALESCE(NEW.protocol_title, NEW.service_name, 'Treatment') || ')',
      'appointment',
      NEW.id::TEXT,
      jsonb_build_object('status', NEW.status, 'date', COALESCE(NEW.appointment_date, NEW.date)),
      NOW()
    );
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
      INSERT INTO public.activity_logs (action, description, entity_type, entity_id, metadata, created_at)
      VALUES (
        'appointment_status_changed',
        'Appointment for ' || COALESCE(NEW.patient_name, NEW.client_name, 'Patient') || ' status updated to ' || NEW.status,
        'appointment',
        NEW.id::TEXT,
        jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status),
        NOW()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for patient registrations
CREATE OR REPLACE FUNCTION public.fn_log_patient_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.activity_logs (action, description, entity_type, entity_id, metadata, created_at)
    VALUES (
      'patient_registered',
      'New patient registered: ' || COALESCE(NEW.name, NEW.full_name, 'New Patient'),
      'patient',
      NEW.id::TEXT,
      jsonb_build_object('email', NEW.email),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for payments
CREATE OR REPLACE FUNCTION public.fn_log_payment_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.activity_logs (action, description, entity_type, entity_id, metadata, created_at)
    VALUES (
      'payment_received',
      'Payment of $' || COALESCE(NEW.amount::TEXT, NEW.total_amount::TEXT, '0') || ' processed (' || COALESCE(NEW.status, NEW.payment_status, 'Paid') || ')',
      'payment',
      NEW.id::TEXT,
      jsonb_build_object('status', COALESCE(NEW.status, NEW.payment_status)),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind triggers safely if tables exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'appointments') THEN
    DROP TRIGGER IF EXISTS trg_log_appointment_activity ON public.appointments;
    CREATE TRIGGER trg_log_appointment_activity
      AFTER INSERT OR UPDATE ON public.appointments
      FOR EACH ROW EXECUTE FUNCTION public.fn_log_appointment_activity();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'patients') THEN
    DROP TRIGGER IF EXISTS trg_log_patient_activity ON public.patients;
    CREATE TRIGGER trg_log_patient_activity
      AFTER INSERT ON public.patients
      FOR EACH ROW EXECUTE FUNCTION public.fn_log_patient_activity();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
    DROP TRIGGER IF EXISTS trg_log_payment_activity ON public.payments;
    CREATE TRIGGER trg_log_payment_activity
      AFTER INSERT ON public.payments
      FOR EACH ROW EXECUTE FUNCTION public.fn_log_payment_activity();
  END IF;
END $$;
