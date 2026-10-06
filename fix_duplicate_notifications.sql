-- ============================================================
-- BEAUTY OASIS Rx — FIX DUPLICATE NOTIFICATIONS & NEW PATIENT ALERTS
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- 
-- 1. Cleans up existing duplicate notifications in public.notifications
-- 2. Creates a UNIQUE index on (type, reference_id) to prevent duplicate rows
-- 3. Adds/updates idempotent database triggers for:
--    - Appointments (trg_notify_new_appointment)
--    - Orders (trg_notify_new_order)
--    - Payments (trg_notify_new_payment)
--    - Inquiries (trg_notify_new_inquiry)
--    - Patients (trg_notify_new_patient) -> creates 1 new-patient notification
-- 4. Ensures realtime publication is active
-- ============================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Ensure public.notifications table exists with all standard columns
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

-- 3. CLEAN UP EXISTING DUPLICATE NOTIFICATIONS
-- Keep only the single most recent notification per (type, reference_id)
WITH ranked_reference_dupes AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY LOWER(type), LOWER(TRIM(reference_id)) 
           ORDER BY is_read ASC, created_at DESC, id DESC
         ) AS rn
  FROM public.notifications
  WHERE reference_id IS NOT NULL AND TRIM(reference_id) <> ''
)
DELETE FROM public.notifications
WHERE id IN (
  SELECT id FROM ranked_reference_dupes WHERE rn > 1
);

-- Also clean up duplicate text records without reference_id
WITH ranked_content_dupes AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY LOWER(type), LOWER(TRIM(title)), LOWER(TRIM(message))
           ORDER BY is_read ASC, created_at DESC, id DESC
         ) AS rn
  FROM public.notifications
  WHERE reference_id IS NULL OR TRIM(reference_id) = ''
)
DELETE FROM public.notifications
WHERE id IN (
  SELECT id FROM ranked_content_dupes WHERE rn > 1
);

-- 4. CREATE UNIQUE INDEX ON (type, reference_id)
-- Guarantees the database itself strictly prohibits duplicate notifications per event
DROP INDEX IF EXISTS public.uq_notifications_type_reference;
CREATE UNIQUE INDEX uq_notifications_type_reference
ON public.notifications (LOWER(type), LOWER(TRIM(reference_id)))
WHERE reference_id IS NOT NULL AND TRIM(reference_id) <> '';

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_reference_id ON public.notifications(reference_id);
CREATE INDEX IF NOT EXISTS idx_notifications_patient_id ON public.notifications(patient_id);

-- 5. RLS POLICIES FOR NOTIFICATIONS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on public.notifications" ON public.notifications;
CREATE POLICY "Allow all on public.notifications"
  ON public.notifications FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.notifications TO authenticated, anon, service_role;

-- ============================================================
-- 6. IDEMPOTENT DATABASE TRIGGERS (Strictly 1 Notification per Event)
-- ============================================================

-- 6.1 APPOINTMENT NOTIFICATION TRIGGER
CREATE OR REPLACE FUNCTION public.fn_notify_on_appointment_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_json JSONB;
  v_id TEXT;
  v_patient_id TEXT;
BEGIN
  v_json := to_jsonb(NEW);
  v_id := COALESCE(v_json->>'id', NEW.id::text);
  v_patient_id := COALESCE(v_json->>'patient_id', v_json->>'client_id');

  -- Deduplication check
  IF v_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.notifications 
    WHERE LOWER(type) = 'appointment' 
      AND LOWER(TRIM(reference_id)) = LOWER(TRIM(v_id))
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    title,
    message,
    type,
    category,
    reference_id,
    patient_id,
    is_read,
    created_at
  ) VALUES (
    'New Appointment: ' || COALESCE(v_json->>'protocol_title', v_json->>'service_name', 'Treatment Session'),
    COALESCE(v_json->>'patient_name', v_json->>'client_name', 'Patient') || ' booked for ' || COALESCE(v_json->>'appointment_date', v_json->>'date', 'upcoming') || COALESCE(' at ' || COALESCE(v_json->>'appointment_time', v_json->>'time'), '') || '.',
    'appointment',
    'appointment',
    v_id,
    CASE WHEN v_patient_id ~ '^[0-9a-fA-F-]{36}$' THEN v_patient_id::uuid ELSE NULL END,
    false,
    NOW()
  )
  ON CONFLICT (LOWER(type), LOWER(TRIM(reference_id))) WHERE reference_id IS NOT NULL AND TRIM(reference_id) <> '' DO NOTHING;

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


-- 6.2 ONLINE ORDER NOTIFICATION TRIGGER
CREATE OR REPLACE FUNCTION public.fn_notify_on_order_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_json JSONB;
  v_ref_id TEXT;
BEGIN
  v_json := to_jsonb(NEW);
  v_ref_id := COALESCE(v_json->>'order_number', v_json->>'order_id', v_json->>'id', NEW.id::text);

  IF v_ref_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.notifications 
    WHERE LOWER(type) = 'order' 
      AND LOWER(TRIM(reference_id)) = LOWER(TRIM(v_ref_id))
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    title,
    message,
    type,
    category,
    reference_id,
    is_read,
    created_at
  ) VALUES (
    'New Online Order: #' || v_ref_id,
    COALESCE(v_json->>'customer_name', v_json->>'client_name', v_json->>'patient_name', 'Client') || ' placed an order totaling $' || COALESCE(v_json->>'total_amount', v_json->>'total', '0.00') || '.',
    'order',
    'order',
    v_ref_id,
    false,
    NOW()
  )
  ON CONFLICT (LOWER(type), LOWER(TRIM(reference_id))) WHERE reference_id IS NOT NULL AND TRIM(reference_id) <> '' DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    DROP TRIGGER IF EXISTS trg_notify_new_order ON public.orders;
    CREATE TRIGGER trg_notify_new_order
      AFTER INSERT ON public.orders
      FOR EACH ROW
      EXECUTE FUNCTION public.fn_notify_on_order_insert();
  END IF;
END $$;


-- 6.3 PAYMENT CONFIRMATION NOTIFICATION TRIGGER
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

  -- 1. Deduplication check: if notification already exists for this payment reference_id, exit
  IF v_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.notifications 
    WHERE LOWER(type) = 'payment' 
      AND LOWER(TRIM(reference_id)) = LOWER(TRIM(v_id))
  ) THEN
    RETURN NEW;
  END IF;

  -- 2. Resolve Amount dynamically:
  v_raw_amount := NULLIF(COALESCE(
    CASE WHEN NEW.total_amount IS NOT NULL AND NEW.total_amount > 0 THEN NEW.total_amount ELSE NULL END,
    CASE WHEN NEW.amount IS NOT NULL AND NEW.amount > 0 THEN NEW.amount ELSE NULL END,
    CASE WHEN NEW.raw_subtotal IS NOT NULL AND NEW.raw_subtotal > 0 THEN NEW.raw_subtotal ELSE NULL END
  ), 0);

  -- Fallback to parent order if order_id exists and amount not found
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

  -- Fallback to parent appointment if appointment_id exists and amount not found
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

  -- 3. Resolve Currency Code & Symbol
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

  -- 4. Format Amount dynamically to 2 decimal places
  v_formatted_amount := v_curr_symbol || TRIM(TO_CHAR(v_final_amount, 'FM999,999,990.00'));

  -- 5. Resolve Customer Name
  v_customer_name := COALESCE(
    NULLIF(TRIM(NEW.customer_name), ''),
    NULLIF(TRIM(NEW.client_name), ''),
    (SELECT COALESCE(NULLIF(TRIM(o.customer_name), ''), NULLIF(TRIM(o.client_name), '')) FROM public.orders o WHERE (o.id = NEW.order_id OR o.order_number = NEW.order_id) LIMIT 1),
    (SELECT COALESCE(NULLIF(TRIM(a.patient_name), ''), NULLIF(TRIM(a.client_name), '')) FROM public.appointments a WHERE a.id = NEW.appointment_id LIMIT 1),
    'Patient'
  );

  v_title := 'Payment Confirmed (' || v_formatted_amount || ')';
  v_message := 'Payment of ' || v_formatted_amount || ' confirmed for ' || v_customer_name || '.';

  -- 6. Insert Notification
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


-- 6.4 INQUIRY NOTIFICATION TRIGGER
CREATE OR REPLACE FUNCTION public.fn_notify_on_inquiry_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_json JSONB;
  v_ref_id TEXT;
BEGIN
  v_json := to_jsonb(NEW);
  v_ref_id := COALESCE(v_json->>'ticket_id', v_json->>'id', NEW.id::text);

  IF v_ref_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.notifications 
    WHERE LOWER(type) = 'inquiry' 
      AND LOWER(TRIM(reference_id)) = LOWER(TRIM(v_ref_id))
  ) THEN
    RETURN NEW;
  END IF;

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
    v_ref_id,
    false,
    NOW()
  )
  ON CONFLICT (LOWER(type), LOWER(TRIM(reference_id))) WHERE reference_id IS NOT NULL AND TRIM(reference_id) <> '' DO NOTHING;

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


-- 6.5 NEW PATIENT ACCOUNT CREATION NOTIFICATION TRIGGER
CREATE OR REPLACE FUNCTION public.fn_notify_on_patient_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_json JSONB;
  v_patient_id TEXT;
  v_name TEXT;
BEGIN
  v_json := to_jsonb(NEW);
  v_patient_id := COALESCE(v_json->>'id', NEW.id::text);
  v_name := COALESCE(v_json->>'full_name', v_json->>'name', 'New Patient');

  -- Deduplication check: only 1 notification per patient account
  IF v_patient_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.notifications 
    WHERE LOWER(type) IN ('patient', 'client') 
      AND LOWER(TRIM(reference_id)) = LOWER(TRIM(v_patient_id))
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    title,
    message,
    type,
    category,
    reference_id,
    patient_id,
    is_read,
    created_at
  ) VALUES (
    'New Patient Registration',
    v_name || ' registered a new patient account.',
    'patient',
    'patient',
    v_patient_id,
    CASE WHEN v_patient_id ~ '^[0-9a-fA-F-]{36}$' THEN v_patient_id::uuid ELSE NULL END,
    false,
    NOW()
  )
  ON CONFLICT (LOWER(type), LOWER(TRIM(reference_id))) WHERE reference_id IS NOT NULL AND TRIM(reference_id) <> '' DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'patients') THEN
    DROP TRIGGER IF EXISTS trg_notify_new_patient ON public.patients;
    CREATE TRIGGER trg_notify_new_patient
      AFTER INSERT ON public.patients
      FOR EACH ROW
      EXECUTE FUNCTION public.fn_notify_on_patient_insert();
  END IF;
END $$;


-- 6.6 AUTH.USERS TRIGGER ENFORCEMENT
-- If a patient signs up through Supabase auth with role 'patient', ensure a public.patients row exists
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role TEXT;
  v_name TEXT;
BEGIN
  v_role := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', ''));
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  IF v_role = 'super_admin' THEN
    INSERT INTO public.users (id, name, email, role, status)
    VALUES (NEW.id, v_name, NEW.email, 'super_admin', 'active')
    ON CONFLICT (id) DO UPDATE
      SET name = COALESCE(EXCLUDED.name, public.users.name),
          role = 'super_admin',
          status = 'active',
          updated_at = NOW();
  ELSIF v_role = 'patient' THEN
    INSERT INTO public.patients (id, full_name, name, email, role, status)
    VALUES (NEW.id, v_name, v_name, NEW.email, 'Patient', 'Active')
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


-- 7. ENABLE REALTIME REPLICATION
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


-- 8. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

-- Verification output: list non-duplicate notifications
SELECT id, title, type, reference_id, is_read, created_at
FROM public.notifications
ORDER BY created_at DESC
LIMIT 10;
