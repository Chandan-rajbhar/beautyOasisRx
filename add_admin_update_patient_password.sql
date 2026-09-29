-- =========================================================================
-- FUNCTION: public.admin_update_patient_password
-- Allows Super Admins to update a patient's portal login password directly in auth.users
-- =========================================================================

CREATE OR REPLACE FUNCTION public.admin_update_patient_password(
  target_email TEXT,
  new_password TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  clean_email TEXT;
  target_user_id UUID;
BEGIN
  clean_email := LOWER(TRIM(target_email));

  IF clean_email IS NULL OR clean_email = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid email provided.');
  END IF;

  IF new_password IS NULL OR LENGTH(new_password) < 8 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Password must be at least 8 characters long.');
  END IF;

  -- 1. Find user in auth.users
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE LOWER(TRIM(email)) = clean_email
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'USER_NOT_FOUND',
      'message', 'Patient authentication account not found.'
    );
  END IF;

  -- 2. Update auth.users password using pgcrypto's crypt & gen_salt
  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
    updated_at = NOW()
  WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Patient password updated successfully.'
  );
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.admin_update_patient_password(TEXT, TEXT) TO authenticated, anon;
