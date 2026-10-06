-- ============================================================
-- BEAUTY OASIS Rx — DUPLICATE APPOINTMENT PREVENTION
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- Prevents duplicate bookings for:
--   1. Same Clinician + Same Date + Same Time slot
--   2. Same Patient + Same Date + Same Time slot
-- (Cancelled appointments are excluded so freed slots can be rebooked)
-- ============================================================

-- 1. Ensure columns exist
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS clinician_id TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS provider_id TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS patient_id TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS appointment_date TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS appointment_time TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS time TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Confirmed';

-- 2. Deduplicate any existing duplicate active appointments before creating constraint
-- (Marks older duplicate active bookings as 'Cancelled' so creating unique index succeeds)
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

-- 3. Create Unique Partial Index for Clinician + Date + Time
DROP INDEX IF EXISTS idx_appointments_clinician_slot_unique;
CREATE UNIQUE INDEX idx_appointments_clinician_slot_unique
ON public.appointments (
  COALESCE(clinician_id, provider_id),
  COALESCE(appointment_date, date),
  COALESCE(appointment_time, time)
)
WHERE status != 'Cancelled';

-- 4. Create Unique Partial Index for Patient + Date + Time
DROP INDEX IF EXISTS idx_appointments_patient_slot_unique;
CREATE UNIQUE INDEX idx_appointments_patient_slot_unique
ON public.appointments (
  COALESCE(patient_id, client_id),
  COALESCE(appointment_date, date),
  COALESCE(appointment_time, time)
)
WHERE status != 'Cancelled';

-- 5. Database Trigger Validation Function for Clear Error Messages
CREATE OR REPLACE FUNCTION public.fn_validate_appointment_slot()
RETURNS TRIGGER AS $$
DECLARE
  v_clinician_id TEXT;
  v_patient_id TEXT;
  v_date TEXT;
  v_time TEXT;
  v_conflict_count INTEGER;
BEGIN
  -- Only validate non-cancelled appointments
  IF NEW.status = 'Cancelled' THEN
    RETURN NEW;
  END IF;

  v_clinician_id := COALESCE(NEW.clinician_id, NEW.provider_id);
  v_patient_id := COALESCE(NEW.patient_id, NEW.client_id);
  v_date := COALESCE(NEW.appointment_date, NEW.date);
  v_time := COALESCE(NEW.appointment_time, NEW.time);

  -- 5A. Check clinician slot conflict
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

  -- 5B. Check patient duplicate booking
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

-- 6. Attach Trigger to public.appointments
DROP TRIGGER IF EXISTS trg_validate_appointment_slot ON public.appointments;
CREATE TRIGGER trg_validate_appointment_slot
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validate_appointment_slot();

-- 7. Verification Notice
DO $$
BEGIN
  RAISE NOTICE 'Duplicate appointment protection successfully enabled for clinicians and patients on public.appointments.';
END $$;
