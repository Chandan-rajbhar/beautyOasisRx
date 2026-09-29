-- ============================================================
-- BEAUTY OASIS Rx — ENFORCE UNIQUE EMAIL ACROSS ALL ROLES
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
--
-- 1. Normalizes email addresses (lowercased & trimmed)
-- 2. Creates UNIQUE indexes on LOWER(TRIM(email)) for public.users & public.patients
-- 3. Adds cross-table triggers preventing an email from existing in both tables
-- 4. Creates public.check_email_exists() RPC for atomic validation across users, patients, and auth.users
-- ============================================================

-- ── 1. NORMALIZE EXISTING EMAILS ─────────────────────────────
UPDATE public.users
SET email = LOWER(TRIM(email))
WHERE email != LOWER(TRIM(email));

UPDATE public.patients
SET email = LOWER(TRIM(email))
WHERE email IS NOT NULL AND email != LOWER(TRIM(email));

-- ── 2. UNIQUE INDEXES (Case-Insensitive) ──────────────────────
-- Users table uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_unique_lower_email
  ON public.users (LOWER(TRIM(email)));

-- Patients table uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_unique_lower_email
  ON public.patients (LOWER(TRIM(email)));

-- ── 3. CROSS-TABLE VALIDATION TRIGGERS ────────────────────────
-- Prevent inserting/updating a user with an email that already exists in patients
CREATE OR REPLACE FUNCTION public.check_user_email_not_in_patients()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.patients
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(NEW.email))
  ) THEN
    RAISE EXCEPTION 'This email address is already registered as a patient in the database.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_user_email_not_in_patients ON public.users;
CREATE TRIGGER trg_check_user_email_not_in_patients
  BEFORE INSERT OR UPDATE OF email ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.check_user_email_not_in_patients();

-- Prevent inserting/updating a patient with an email that already exists in users
CREATE OR REPLACE FUNCTION public.check_patient_email_not_in_users()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(NEW.email))
  ) THEN
    RAISE EXCEPTION 'This email address is already registered as a super admin in the database.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_patient_email_not_in_users ON public.patients;
CREATE TRIGGER trg_check_patient_email_not_in_users
  BEFORE INSERT OR UPDATE OF email ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.check_patient_email_not_in_users();

-- ── 4. RPC: ATOMIC CHECK ACROSS USERS, PATIENTS & AUTH.USERS ──
CREATE OR REPLACE FUNCTION public.check_email_exists(lookup_email TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  clean_email TEXT := LOWER(TRIM(lookup_email));
  found_user RECORD;
  found_patient RECORD;
  found_auth RECORD;
BEGIN
  IF clean_email IS NULL OR clean_email = '' THEN
    RETURN json_build_object('exists', FALSE);
  END IF;

  -- 1. Check public.users
  SELECT id, role, name INTO found_user
  FROM public.users
  WHERE LOWER(TRIM(email)) = clean_email
  LIMIT 1;

  IF found_user.id IS NOT NULL THEN
    RETURN json_build_object(
      'exists', TRUE,
      'source', 'users',
      'role', COALESCE(found_user.role, 'super_admin'),
      'message', 'This email address is already registered.'
    );
  END IF;

  -- 2. Check public.patients
  SELECT id, role, COALESCE(full_name, name) AS name INTO found_patient
  FROM public.patients
  WHERE LOWER(TRIM(email)) = clean_email
  LIMIT 1;

  IF found_patient.id IS NOT NULL THEN
    RETURN json_build_object(
      'exists', TRUE,
      'source', 'patients',
      'role', 'patient',
      'message', 'This email address is already registered.'
    );
  END IF;

  -- 3. Check auth.users (covers unlinked or pending auth records)
  SELECT id INTO found_auth
  FROM auth.users
  WHERE LOWER(TRIM(email)) = clean_email
  LIMIT 1;

  IF found_auth.id IS NOT NULL THEN
    RETURN json_build_object(
      'exists', TRUE,
      'source', 'auth',
      'role', 'auth_user',
      'message', 'This email address is already registered.'
    );
  END IF;

  RETURN json_build_object('exists', FALSE);
END;
$$;

-- Grant permissions to call the RPC
GRANT EXECUTE ON FUNCTION public.check_email_exists(TEXT) TO anon, authenticated, service_role;

-- Verification query
SELECT 'Database duplicate email enforcement applied successfully.' AS status;
