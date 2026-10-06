-- ============================================================
-- BEAUTY OASIS Rx — NOTIFICATIONS TABLE, RLS, REALTIME & DYNAMIC GENERATION
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- 1. Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'appointment',
  category TEXT NOT NULL DEFAULT 'appointment',
  reference_id TEXT,
  patient_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  user_id UUID,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Safely ensure all required columns exist (idempotent for existing tables)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'appointment';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'appointment';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS reference_id TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS patient_id UUID;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Performance Indexes for quick filtering, sorting and realtime lookups
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON public.notifications(category);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_patient_id ON public.notifications(patient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_reference_id ON public.notifications(reference_id);

-- 5. Row Level Security (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on public.notifications" ON public.notifications;
CREATE POLICY "Allow all on public.notifications"
  ON public.notifications FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- 6. Enable Realtime Replication for notifications table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;

-- 7. Permissions
GRANT ALL ON public.notifications TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;

-- 8. DYNAMIC NOTIFICATIONS POPULATION FROM LIVE DATABASE TABLES
-- Uses to_jsonb() to access columns safely without compile-time column-name errors
DO $$
BEGIN
  -- 8.1 Dynamically import notifications from public.appointments (if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'appointments') THEN
    INSERT INTO public.notifications (
      title,
      message,
      type,
      category,
      reference_id,
      is_read,
      created_at
    )
    SELECT
      'New Appointment: ' || COALESCE(to_jsonb(a)->>'protocol_title', to_jsonb(a)->>'service_name', 'Treatment Session'),
      COALESCE(to_jsonb(a)->>'patient_name', to_jsonb(a)->>'client_name', 'Patient') || ' scheduled for ' || COALESCE(to_jsonb(a)->>'appointment_date', to_jsonb(a)->>'date', 'upcoming date') || COALESCE(' at ' || COALESCE(to_jsonb(a)->>'appointment_time', to_jsonb(a)->>'time'), '') || '.',
      'appointment',
      'appointment',
      to_jsonb(a)->>'id',
      false,
      COALESCE(NULLIF(to_jsonb(a)->>'created_at', '')::timestamptz, NOW())
    FROM public.appointments a
    WHERE to_jsonb(a)->>'id' IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n WHERE n.reference_id = to_jsonb(a)->>'id'
      )
    ORDER BY COALESCE(NULLIF(to_jsonb(a)->>'created_at', '')::timestamptz, NOW()) DESC
    LIMIT 5;
  END IF;

  -- 8.2 Dynamically import notifications from public.orders (if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    INSERT INTO public.notifications (
      title,
      message,
      type,
      category,
      reference_id,
      is_read,
      created_at
    )
    SELECT
      'New Online Order: #' || COALESCE(to_jsonb(o)->>'order_number', to_jsonb(o)->>'order_id', to_jsonb(o)->>'id'),
      COALESCE(to_jsonb(o)->>'customer_name', to_jsonb(o)->>'client_name', to_jsonb(o)->>'patient_name', 'Client') || ' placed an order totaling $' || COALESCE(to_jsonb(o)->>'total_amount', to_jsonb(o)->>'total', '0.00') || '.',
      'order',
      'order',
      COALESCE(to_jsonb(o)->>'order_number', to_jsonb(o)->>'order_id', to_jsonb(o)->>'id'),
      false,
      COALESCE(NULLIF(to_jsonb(o)->>'created_at', '')::timestamptz, NOW())
    FROM public.orders o
    WHERE COALESCE(to_jsonb(o)->>'order_number', to_jsonb(o)->>'order_id', to_jsonb(o)->>'id') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n 
        WHERE n.reference_id = COALESCE(to_jsonb(o)->>'order_number', to_jsonb(o)->>'order_id', to_jsonb(o)->>'id')
      )
    ORDER BY COALESCE(NULLIF(to_jsonb(o)->>'created_at', '')::timestamptz, NOW()) DESC
    LIMIT 5;
  END IF;

  -- 8.3 Dynamically import notifications from public.payments (if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
    INSERT INTO public.notifications (
      title,
      message,
      type,
      category,
      reference_id,
      is_read,
      created_at
    )
    SELECT
      'Payment Confirmed (' ||
        CASE UPPER(TRIM(COALESCE(to_jsonb(p)->>'currency', 'USD')))
          WHEN 'GBP' THEN '£'
          WHEN 'EUR' THEN '€'
          WHEN 'INR' THEN '₹'
          ELSE '$'
        END || TRIM(TO_CHAR(COALESCE(NULLIF((to_jsonb(p)->>'total_amount')::numeric, 0), NULLIF((to_jsonb(p)->>'amount')::numeric, 0), 0), 'FM999,999,990.00')) || ')',
      'Payment of ' ||
        CASE UPPER(TRIM(COALESCE(to_jsonb(p)->>'currency', 'USD')))
          WHEN 'GBP' THEN '£'
          WHEN 'EUR' THEN '€'
          WHEN 'INR' THEN '₹'
          ELSE '$'
        END || TRIM(TO_CHAR(COALESCE(NULLIF((to_jsonb(p)->>'total_amount')::numeric, 0), NULLIF((to_jsonb(p)->>'amount')::numeric, 0), 0), 'FM999,999,990.00')) ||
        ' confirmed for ' || COALESCE(NULLIF(TRIM(to_jsonb(p)->>'customer_name'), ''), NULLIF(TRIM(to_jsonb(p)->>'client_name'), ''), NULLIF(TRIM(to_jsonb(p)->>'patient_name'), ''), 'Client') || '.',
      'payment',
      'payment',
      to_jsonb(p)->>'id',
      false,
      COALESCE(NULLIF(to_jsonb(p)->>'created_at', '')::timestamptz, NOW())
    FROM public.payments p
    WHERE to_jsonb(p)->>'id' IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n WHERE n.reference_id = to_jsonb(p)->>'id'
      )
    ORDER BY COALESCE(NULLIF(to_jsonb(p)->>'created_at', '')::timestamptz, NOW()) DESC
    LIMIT 5;
  END IF;

  -- 8.4 Dynamically import notifications from public.inquiries (if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inquiries') THEN
    INSERT INTO public.notifications (
      title,
      message,
      type,
      category,
      reference_id,
      is_read,
      created_at
    )
    SELECT
      'New Client Inquiry (' || COALESCE(to_jsonb(i)->>'ticket_id', 'Ticket') || ')',
      COALESCE(to_jsonb(i)->>'name', 'Client') || ' submitted inquiry regarding: ' || COALESCE(to_jsonb(i)->>'subject', 'Consultation') || '.',
      'inquiry',
      'inquiry',
      COALESCE(to_jsonb(i)->>'ticket_id', to_jsonb(i)->>'id'),
      false,
      COALESCE(NULLIF(to_jsonb(i)->>'created_at', '')::timestamptz, NOW())
    FROM public.inquiries i
    WHERE COALESCE(to_jsonb(i)->>'ticket_id', to_jsonb(i)->>'id') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n 
        WHERE n.reference_id = COALESCE(to_jsonb(i)->>'ticket_id', to_jsonb(i)->>'id')
      )
    ORDER BY COALESCE(NULLIF(to_jsonb(i)->>'created_at', '')::timestamptz, NOW()) DESC
    LIMIT 5;
  END IF;

  -- 8.5 Dynamically import notifications from public.patients (if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'patients') THEN
    INSERT INTO public.notifications (
      title,
      message,
      type,
      category,
      reference_id,
      patient_id,
      is_read,
      created_at
    )
    SELECT
      'New Patient Registration',
      COALESCE(to_jsonb(pt)->>'full_name', to_jsonb(pt)->>'name', 'New patient') || ' registered and completed online profile.',
      'patient',
      'patient',
      to_jsonb(pt)->>'id',
      CASE WHEN (to_jsonb(pt)->>'id') ~ '^[0-9a-fA-F-]{36}$' THEN (to_jsonb(pt)->>'id')::uuid ELSE NULL END,
      true,
      COALESCE(NULLIF(to_jsonb(pt)->>'created_at', '')::timestamptz, NOW())
    FROM public.patients pt
    WHERE to_jsonb(pt)->>'id' IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n WHERE n.reference_id = to_jsonb(pt)->>'id'
      )
    ORDER BY COALESCE(NULLIF(to_jsonb(pt)->>'created_at', '')::timestamptz, NOW()) DESC
    LIMIT 5;
  END IF;
END $$;

-- 9. AUTOMATIC REAL-TIME DATABASE TRIGGERS
-- Automatically creates a notification in real-time when a new inquiry, appointment, payment, or order is inserted!

-- 9.1 Inquiry Trigger
CREATE OR REPLACE FUNCTION public.fn_notify_on_inquiry_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_json JSONB;
BEGIN
  v_json := to_jsonb(NEW);
  INSERT INTO public.notifications (
    title,
    message,
    type,
    category,
    reference_id,
    is_read,
    created_at
  ) VALUES (
    'New Client Inquiry (' || COALESCE(v_json->>'ticket_id', 'Ticket') || ')',
    COALESCE(v_json->>'name', 'Client') || ' submitted inquiry regarding: ' || COALESCE(v_json->>'subject', 'Consultation') || '.',
    'inquiry',
    'inquiry',
    COALESCE(v_json->>'ticket_id', v_json->>'id'),
    false,
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inquiries') THEN
    DROP TRIGGER IF EXISTS trg_notify_new_inquiry ON public.inquiries;
    CREATE TRIGGER trg_notify_new_inquiry
      AFTER INSERT ON public.inquiries
      FOR EACH ROW
      EXECUTE FUNCTION public.fn_notify_on_inquiry_insert();
  END IF;
END $$;

-- 9.2 Appointment Trigger
CREATE OR REPLACE FUNCTION public.fn_notify_on_appointment_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_json JSONB;
BEGIN
  v_json := to_jsonb(NEW);
  INSERT INTO public.notifications (
    title,
    message,
    type,
    category,
    reference_id,
    is_read,
    created_at
  ) VALUES (
    'New Appointment: ' || COALESCE(v_json->>'protocol_title', v_json->>'service_name', 'Treatment Session'),
    COALESCE(v_json->>'patient_name', v_json->>'client_name', 'Patient') || ' booked for ' || COALESCE(v_json->>'appointment_date', v_json->>'date', 'upcoming') || COALESCE(' at ' || COALESCE(v_json->>'appointment_time', v_json->>'time'), '') || '.',
    'appointment',
    'appointment',
    v_json->>'id',
    false,
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'appointments') THEN
    DROP TRIGGER IF EXISTS trg_notify_new_appointment ON public.appointments;
    CREATE TRIGGER trg_notify_new_appointment
      AFTER INSERT ON public.appointments
      FOR EACH ROW
      EXECUTE FUNCTION public.fn_notify_on_appointment_insert();
  END IF;
END $$;

-- 9.3 Payment Trigger
CREATE OR REPLACE FUNCTION public.fn_notify_on_payment_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_json JSONB;
  v_id TEXT;
  v_raw_amount NUMERIC;
  v_order_amount NUMERIC;
  v_appt_amount NUMERIC;
  v_final_amount NUMERIC;
  v_curr_code TEXT;
  v_curr_symbol TEXT;
  v_customer_name TEXT;
  v_title TEXT;
  v_message TEXT;
  v_formatted_amount TEXT;
BEGIN
  v_json := to_jsonb(NEW);
  v_id := COALESCE(v_json->>'id', NEW.id::text);

  IF v_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.notifications 
    WHERE LOWER(type) = 'payment' 
      AND LOWER(TRIM(reference_id)) = LOWER(TRIM(v_id))
  ) THEN
    RETURN NEW;
  END IF;

  v_raw_amount := NULLIF(COALESCE(
    CASE WHEN NEW.total_amount IS NOT NULL AND NEW.total_amount > 0 THEN NEW.total_amount ELSE NULL END,
    CASE WHEN NEW.amount IS NOT NULL AND NEW.amount > 0 THEN NEW.amount ELSE NULL END,
    CASE WHEN NEW.raw_subtotal IS NOT NULL AND NEW.raw_subtotal > 0 THEN NEW.raw_subtotal ELSE NULL END
  ), 0);

  IF (v_raw_amount IS NULL OR v_raw_amount = 0) AND NEW.order_id IS NOT NULL AND TRIM(NEW.order_id) <> '' THEN
    SELECT COALESCE(
      NULLIF(o.total_amount, 0),
      NULLIF(o.total, 0),
      NULLIF(o.subtotal, 0)
    )
    INTO v_order_amount
    FROM public.orders o
    WHERE o.id::text = NEW.order_id OR (o.invoice_number IS NOT NULL AND o.invoice_number = NEW.order_id)
    LIMIT 1;

    IF v_order_amount IS NOT NULL AND v_order_amount > 0 THEN
      v_raw_amount := v_order_amount;
    END IF;
  END IF;

  IF (v_raw_amount IS NULL OR v_raw_amount = 0) AND NEW.appointment_id IS NOT NULL THEN
    SELECT COALESCE(
      NULLIF(a.amount, 0),
      NULLIF(a.price, 0)
    )
    INTO v_appt_amount
    FROM public.appointments a
    WHERE a.id = NEW.appointment_id
    LIMIT 1;

    IF v_appt_amount IS NOT NULL AND v_appt_amount > 0 THEN
      v_raw_amount := v_appt_amount;
    END IF;
  END IF;

  v_final_amount := COALESCE(v_raw_amount, NEW.total_amount, NEW.amount, 0);

  v_curr_code := UPPER(TRIM(COALESCE(
    NULLIF(NEW.currency, ''),
    (SELECT o.currency FROM public.orders o WHERE (o.id = NEW.order_id OR o.order_number = NEW.order_id) LIMIT 1),
    'USD'
  )));

  CASE v_curr_code
    WHEN 'GBP' THEN v_curr_symbol := '£';
    WHEN 'EUR' THEN v_curr_symbol := '€';
    WHEN 'INR' THEN v_curr_symbol := '₹';
    WHEN 'CAD' THEN v_curr_symbol := '$';
    WHEN 'AUD' THEN v_curr_symbol := '$';
    WHEN 'USD' THEN v_curr_symbol := '$';
    ELSE v_curr_symbol := '$';
  END CASE;

  v_formatted_amount := v_curr_symbol || TRIM(TO_CHAR(v_final_amount, 'FM999,999,990.00'));

  v_customer_name := COALESCE(
    NULLIF(TRIM(NEW.customer_name), ''),
    NULLIF(TRIM(NEW.client_name), ''),
    (SELECT COALESCE(NULLIF(TRIM(o.customer_name), ''), NULLIF(TRIM(o.client_name), '')) FROM public.orders o WHERE (o.id = NEW.order_id OR o.order_number = NEW.order_id) LIMIT 1),
    (SELECT COALESCE(NULLIF(TRIM(a.patient_name), ''), NULLIF(TRIM(a.client_name), '')) FROM public.appointments a WHERE a.id = NEW.appointment_id LIMIT 1),
    'Patient'
  );

  v_title := 'Payment Confirmed (' || v_formatted_amount || ')';
  v_message := 'Payment of ' || v_formatted_amount || ' confirmed for ' || v_customer_name || '.';

  INSERT INTO public.notifications (
    title,
    message,
    type,
    category,
    reference_id,
    is_read,
    created_at
  ) VALUES (
    v_title,
    v_message,
    'payment',
    'payment',
    v_id,
    false,
    NOW()
  )
  ON CONFLICT (LOWER(type), LOWER(TRIM(reference_id))) 
  WHERE reference_id IS NOT NULL AND TRIM(reference_id) <> '' 
  DO UPDATE SET
    title = EXCLUDED.title,
    message = EXCLUDED.message,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
    DROP TRIGGER IF EXISTS trg_notify_new_payment ON public.payments;
    CREATE TRIGGER trg_notify_new_payment
      AFTER INSERT ON public.payments
      FOR EACH ROW
      EXECUTE FUNCTION public.fn_notify_on_payment_insert();
  END IF;
END $$;

-- 10. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
