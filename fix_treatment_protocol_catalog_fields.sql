-- Treatment protocols are catalog records, not appointments.
-- Existing rows may keep these values, but new protocols must not require them.
ALTER TABLE public.treatment_protocols
  ALTER COLUMN appointment_date DROP NOT NULL,
  ALTER COLUMN appointment_time DROP NOT NULL;