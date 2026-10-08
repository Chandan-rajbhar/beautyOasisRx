-- ============================================================
-- BEAUTY OASIS Rx — COMPLETE DASHBOARD SETUP SQL SCRIPT
-- Paste and run this in: Supabase Dashboard → SQL Editor → Run
-- Sets up all 6 dashboard tables, RLS policies, realtime & triggers.
-- ============================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE 1: PATIENTS (Total Patients / Clients Metric)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  date_of_birth TEXT,
  dob TEXT,
  residential_address TEXT,
  address TEXT,
  status TEXT DEFAULT 'Active',
  account_status TEXT DEFAULT 'Active',
  role TEXT DEFAULT 'Patient',
  profile_photo_url TEXT,
  avatar TEXT,
  total_spent NUMERIC(10,2) DEFAULT 0,
  allergies TEXT,
  skin_type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all columns exist if table was already partially created
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS date_of_birth TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS dob TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS residential_address TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'Active';
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Patient';
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS total_spent NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS allergies TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS skin_type TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Enable RLS & Policies for patients
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read patients" ON public.patients;
CREATE POLICY "Allow anon read patients" ON public.patients FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow anon insert patients" ON public.patients;
CREATE POLICY "Allow anon insert patients" ON public.patients FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon update patients" ON public.patients;
CREATE POLICY "Allow anon update patients" ON public.patients FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "Allow anon delete patients" ON public.patients;
CREATE POLICY "Allow anon delete patients" ON public.patients FOR DELETE TO public USING (true);


-- ============================================================
-- TABLE 2: APPOINTMENTS (Today's & Total Upcoming Appointments)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT,
  client_id TEXT,
  patient_name TEXT,
  client_name TEXT,
  patient_email TEXT,
  client_email TEXT,
  patient_phone TEXT,
  client_phone TEXT,
  protocol_title TEXT,
  service_name TEXT,
  clinician_name TEXT,
  provider_name TEXT,
  appointment_date TEXT,
  date TEXT,
  appointment_time TEXT,
  time TEXT,
  duration TEXT DEFAULT '60 Mins',
  status TEXT NOT NULL DEFAULT 'Confirmed',
  payment_status TEXT NOT NULL DEFAULT 'Pending',
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all columns exist
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS patient_id TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS patient_name TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS patient_email TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS client_email TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS protocol_title TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS service_name TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS clinician_name TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS provider_name TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS appointment_date TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS appointment_time TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS time TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Confirmed';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Pending';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- Enable RLS & Policies for appointments
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read appointments" ON public.appointments;
CREATE POLICY "Allow anon read appointments" ON public.appointments FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow anon insert appointments" ON public.appointments;
CREATE POLICY "Allow anon insert appointments" ON public.appointments FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon update appointments" ON public.appointments;
CREATE POLICY "Allow anon update appointments" ON public.appointments FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "Allow anon delete appointments" ON public.appointments;
CREATE POLICY "Allow anon delete appointments" ON public.appointments FOR DELETE TO public USING (true);


-- ============================================================
-- TABLE 3: PAYMENTS (Total Revenue & Revenue Overview Chart)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID,
  client_name TEXT,
  appointment_id UUID,
  order_id UUID,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  method TEXT DEFAULT 'Credit Card',
  payment_method TEXT,
  status TEXT DEFAULT 'Paid',
  reference TEXT,
  description TEXT,
  receipt_url TEXT,
  date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS client_id UUID;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS appointment_id UUID;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS order_id UUID;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS method TEXT DEFAULT 'Credit Card';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Paid';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ DEFAULT NOW();

-- Enable RLS & Policies for payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read payments" ON public.payments;
CREATE POLICY "Allow anon read payments" ON public.payments FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow anon insert payments" ON public.payments;
CREATE POLICY "Allow anon insert payments" ON public.payments FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon update payments" ON public.payments;
CREATE POLICY "Allow anon update payments" ON public.payments FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "Allow anon delete payments" ON public.payments;
CREATE POLICY "Allow anon delete payments" ON public.payments FOR DELETE TO public USING (true);


-- ============================================================
-- TABLE 4: TREATMENT_PROTOCOLS (Active Treatments Metric)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.treatment_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_title TEXT,
  title TEXT,
  name TEXT,
  category TEXT DEFAULT 'Facial Aesthetics',
  duration TEXT DEFAULT '60 Mins',
  price NUMERIC(10,2) DEFAULT 0,
  numeric_price NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'Active',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist
ALTER TABLE public.treatment_protocols ADD COLUMN IF NOT EXISTS protocol_title TEXT;
ALTER TABLE public.treatment_protocols ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.treatment_protocols ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.treatment_protocols ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Facial Aesthetics';
ALTER TABLE public.treatment_protocols ADD COLUMN IF NOT EXISTS duration TEXT DEFAULT '60 Mins';
ALTER TABLE public.treatment_protocols ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.treatment_protocols ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';

-- Enable RLS & Policies for treatment_protocols
ALTER TABLE public.treatment_protocols ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read treatment_protocols" ON public.treatment_protocols;
CREATE POLICY "Allow anon read treatment_protocols" ON public.treatment_protocols FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow anon insert treatment_protocols" ON public.treatment_protocols;
CREATE POLICY "Allow anon insert treatment_protocols" ON public.treatment_protocols FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon update treatment_protocols" ON public.treatment_protocols;
CREATE POLICY "Allow anon update treatment_protocols" ON public.treatment_protocols FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "Allow anon delete treatment_protocols" ON public.treatment_protocols;
CREATE POLICY "Allow anon delete treatment_protocols" ON public.treatment_protocols FOR DELETE TO public USING (true);


-- ============================================================
-- TABLE 5: ORDERS (Total Orders Metric)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID,
  patient_id UUID,
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  total_amount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) DEFAULT 0,
  order_status TEXT DEFAULT 'Completed',
  payment_status TEXT DEFAULT 'Paid',
  shipping_address TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  invoice_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS client_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS patient_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS client_email TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_status TEXT DEFAULT 'Completed';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Paid';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tax NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Credit Card';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_address TEXT DEFAULT 'Clinic Pickup (Allen, TX)';

-- Enable RLS & Policies for orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read orders" ON public.orders;
CREATE POLICY "Allow anon read orders" ON public.orders FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow anon insert orders" ON public.orders;
CREATE POLICY "Allow anon insert orders" ON public.orders FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon update orders" ON public.orders;
CREATE POLICY "Allow anon update orders" ON public.orders FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "Allow anon delete orders" ON public.orders;
CREATE POLICY "Allow anon delete orders" ON public.orders FOR DELETE TO public USING (true);


-- ============================================================
-- TABLE 6: ACTIVITY_LOGS (Recent Activity Audit Feed)
-- ============================================================
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

-- Ensure columns exist
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS entity_type TEXT DEFAULT 'appointment';
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs (entity_type, entity_id);

-- Enable RLS & Policies for activity_logs
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read activity_logs" ON public.activity_logs;
CREATE POLICY "Allow anon read activity_logs" ON public.activity_logs FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow anon insert activity_logs" ON public.activity_logs;
CREATE POLICY "Allow anon insert activity_logs" ON public.activity_logs FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon update activity_logs" ON public.activity_logs;
CREATE POLICY "Allow anon update activity_logs" ON public.activity_logs FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "Allow anon delete activity_logs" ON public.activity_logs;
CREATE POLICY "Allow anon delete activity_logs" ON public.activity_logs FOR DELETE TO public USING (true);


-- ============================================================
-- 7. ENABLE REALTIME REPLICATION (Instant Updates in UI)
-- ============================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.patients;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;


-- ============================================================
-- 8. AUTOMATIC RECENT ACTIVITY TRIGGERS
-- Logs an activity event whenever appointments/patients/payments are created
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_log_appointment_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.activity_logs (action, description, entity_type, entity_id, created_at)
  VALUES (
    'appointment_booked',
    'New appointment scheduled for ' || COALESCE(NEW.patient_name, NEW.client_name, 'Patient') || ' (' || COALESCE(NEW.protocol_title, NEW.service_name, 'Treatment') || ')',
    'appointment',
    NEW.id::text,
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_appointment ON public.appointments;
CREATE TRIGGER trg_log_appointment
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_log_appointment_activity();

CREATE OR REPLACE FUNCTION public.fn_log_patient_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.activity_logs (action, description, entity_type, entity_id, created_at)
  VALUES (
    'patient_registered',
    'New patient registered: ' || COALESCE(NEW.full_name, NEW.name, 'Patient'),
    'patient',
    NEW.id::text,
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_patient ON public.patients;
CREATE TRIGGER trg_log_patient
  AFTER INSERT ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_log_patient_activity();

CREATE OR REPLACE FUNCTION public.fn_log_payment_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.activity_logs (action, description, entity_type, entity_id, created_at)
  VALUES (
    'payment_received',
    'Payment of $' || COALESCE(NEW.amount::text, '0.00') || ' settled for ' || COALESCE(NEW.client_name, 'Patient'),
    'payment',
    NEW.id::text,
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_payment ON public.payments;
CREATE TRIGGER trg_log_payment
  AFTER INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_log_payment_activity();


-- ============================================================
-- 9. SEED / BACKFILL ACTIVITY LOGS FROM EXISTING RECORDS
-- Ensures Recent Activity is immediately populated on fresh run
-- ============================================================
DO $$
BEGIN
  -- Backfill from existing appointments
  INSERT INTO public.activity_logs (action, description, entity_type, entity_id, created_at)
  SELECT
    'appointment_booked',
    'Appointment scheduled for ' || COALESCE(patient_name, client_name, 'Patient') || ' (' || COALESCE(protocol_title, service_name, 'Treatment') || ')',
    'appointment',
    id::text,
    COALESCE(created_at, NOW())
  FROM public.appointments
  WHERE id::text NOT IN (SELECT entity_id FROM public.activity_logs WHERE entity_type = 'appointment' AND entity_id IS NOT NULL)
  ORDER BY created_at DESC
  LIMIT 15;

  -- Backfill from existing patients
  INSERT INTO public.activity_logs (action, description, entity_type, entity_id, created_at)
  SELECT
    'patient_registered',
    'New patient registered: ' || COALESCE(full_name, name, 'Patient'),
    'patient',
    id::text,
    COALESCE(created_at, NOW())
  FROM public.patients
  WHERE id::text NOT IN (SELECT entity_id FROM public.activity_logs WHERE entity_type = 'patient' AND entity_id IS NOT NULL)
  ORDER BY created_at DESC
  LIMIT 10;
END $$;


-- ============================================================
-- 10. PREVENT DUPLICATE APPOINTMENT BOOKING CONSTRAINTS & TRIGGER
-- ============================================================
-- Clean up duplicate active records if any exist
WITH duplicate_clinician_slots AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY COALESCE(clinician_id, provider_id), COALESCE(appointment_date, date), COALESCE(appointment_time, time)
           ORDER BY created_at DESC
         ) as rn
  FROM public.appointments
  WHERE status != 'Cancelled'
    AND COALESCE(clinician_id, provider_id) IS NOT NULL
    AND COALESCE(appointment_date, date) IS NOT NULL
    AND COALESCE(appointment_time, time) IS NOT NULL
)
UPDATE public.appointments
SET status = 'Cancelled',
    notes = COALESCE(notes, '') || ' [Auto-cancelled: Duplicate clinician slot cleaned during index migration]'
WHERE id IN (SELECT id FROM duplicate_clinician_slots WHERE rn > 1);

WITH duplicate_patient_slots AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY COALESCE(patient_id, client_id), COALESCE(appointment_date, date), COALESCE(appointment_time, time)
           ORDER BY created_at DESC
         ) as rn
  FROM public.appointments
  WHERE status != 'Cancelled'
    AND COALESCE(patient_id, client_id) IS NOT NULL
    AND COALESCE(appointment_date, date) IS NOT NULL
    AND COALESCE(appointment_time, time) IS NOT NULL
)
UPDATE public.appointments
SET status = 'Cancelled',
    notes = COALESCE(notes, '') || ' [Auto-cancelled: Duplicate patient slot cleaned during index migration]'
WHERE id IN (SELECT id FROM duplicate_patient_slots WHERE rn > 1);

-- Unique Partial Index for Clinician + Date + Time
DROP INDEX IF EXISTS idx_appointments_clinician_slot_unique;
CREATE UNIQUE INDEX idx_appointments_clinician_slot_unique
ON public.appointments (
  COALESCE(clinician_id, provider_id),
  COALESCE(appointment_date, date),
  COALESCE(appointment_time, time)
)
WHERE status != 'Cancelled';

-- Unique Partial Index for Patient + Date + Time
DROP INDEX IF EXISTS idx_appointments_patient_slot_unique;
CREATE UNIQUE INDEX idx_appointments_patient_slot_unique
ON public.appointments (
  COALESCE(patient_id, client_id),
  COALESCE(appointment_date, date),
  COALESCE(appointment_time, time)
)
WHERE status != 'Cancelled';

-- Trigger Validation Function for Clear Exception Messages
CREATE OR REPLACE FUNCTION public.fn_validate_appointment_slot()
RETURNS TRIGGER AS $$
DECLARE
  v_clinician_id TEXT;
  v_patient_id TEXT;
  v_date TEXT;
  v_time TEXT;
  v_conflict_count INTEGER;
BEGIN
  IF NEW.status = 'Cancelled' THEN
    RETURN NEW;
  END IF;

  v_clinician_id := COALESCE(NEW.clinician_id, NEW.provider_id);
  v_patient_id := COALESCE(NEW.patient_id, NEW.client_id);
  v_date := COALESCE(NEW.appointment_date, NEW.date);
  v_time := COALESCE(NEW.appointment_time, NEW.time);

  IF v_clinician_id IS NOT NULL AND v_date IS NOT NULL AND v_time IS NOT NULL THEN
    SELECT COUNT(*) INTO v_conflict_count
    FROM public.appointments
    WHERE status != 'Cancelled'
      AND COALESCE(clinician_id, provider_id) = v_clinician_id
      AND COALESCE(appointment_date, date) = v_date
      AND COALESCE(appointment_time, time) = v_time
      AND (TG_OP = 'INSERT' OR id != NEW.id);

    IF v_conflict_count > 0 THEN
      RAISE EXCEPTION 'This clinician is already booked for % at %. Please select a different time slot or clinician.', v_date, v_time
        USING ERRCODE = '23505';
    END IF;
  END IF;

  IF v_patient_id IS NOT NULL AND v_date IS NOT NULL AND v_time IS NOT NULL THEN
    SELECT COUNT(*) INTO v_conflict_count
    FROM public.appointments
    WHERE status != 'Cancelled'
      AND COALESCE(patient_id, client_id) = v_patient_id
      AND COALESCE(appointment_date, date) = v_date
      AND COALESCE(appointment_time, time) = v_time
      AND (TG_OP = 'INSERT' OR id != NEW.id);

    IF v_conflict_count > 0 THEN
      RAISE EXCEPTION 'This patient already has an appointment scheduled for % at %. Please choose a different date or time.', v_date, v_time
        USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_appointment_slot ON public.appointments;
CREATE TRIGGER trg_validate_appointment_slot
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validate_appointment_slot();


-- ============================================================
-- TABLE 7: COUPONS (Promotions & Discount Codes)
-- ============================================================
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

-- Ensure all columns exist
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

-- Enable RLS & Policies for coupons
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read coupons" ON public.coupons;
CREATE POLICY "Allow anon read coupons" ON public.coupons FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow anon insert coupons" ON public.coupons;
CREATE POLICY "Allow anon insert coupons" ON public.coupons FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon update coupons" ON public.coupons;
CREATE POLICY "Allow anon update coupons" ON public.coupons FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "Allow anon delete coupons" ON public.coupons;
CREATE POLICY "Allow anon delete coupons" ON public.coupons FOR DELETE TO public USING (true);

GRANT ALL ON public.coupons TO authenticated, anon, service_role;


