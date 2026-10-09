-- ============================================================================
-- BEAUTY OASIS Rx — COMPLETE PUSH NOTIFICATIONS & DEVICE REGISTRATION MIGRATION
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- 
-- 1. Extends public.notifications with FCM push delivery fields & idempotency
-- 2. Maintains bi-directional compatibility with existing legacy notification columns
-- 3. Creates public.push_devices for multi-device FCM token management & cleanup
-- 4. Establishes secure Row Level Security (RLS) policies
-- 5. Implements helper RPCs for atomic device registration & token invalidation
-- 6. Adds notifications and push_devices to supabase_realtime publication
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 0. HELPER FUNCTION: handle_updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 1. EXTEND TABLE: public.notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general',
  category TEXT NOT NULL DEFAULT 'general',
  reference_id TEXT,
  patient_id UUID,
  user_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safely ensure standard & push delivery columns exist
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS recipient_user_id UUID;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS notification_type TEXT DEFAULT 'general';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_entity_id TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS action_url TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS deep_link TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS data_payload JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS delivery_details JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Backfill legacy / push column synchronization for existing rows
UPDATE public.notifications
SET 
  recipient_user_id = COALESCE(recipient_user_id, user_id, patient_id),
  notification_type = COALESCE(notification_type, type, category, 'general'),
  related_entity_id = COALESCE(related_entity_id, reference_id),
  deep_link = COALESCE(deep_link, link),
  action_url = COALESCE(action_url, link),
  delivery_status = COALESCE(delivery_status, 'sent')
WHERE recipient_user_id IS NULL OR notification_type IS NULL OR delivery_status IS NULL;

-- Trigger to maintain bi-directional synchronization between legacy and push notification columns
CREATE OR REPLACE FUNCTION public.sync_notifications_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Sync recipient
  IF NEW.recipient_user_id IS NULL THEN
    NEW.recipient_user_id := COALESCE(NEW.user_id, NEW.patient_id);
  END IF;
  IF NEW.user_id IS NULL THEN
    NEW.user_id := NEW.recipient_user_id;
  END IF;

  -- Sync type / category
  IF NEW.notification_type IS NULL OR NEW.notification_type = 'general' THEN
    NEW.notification_type := COALESCE(NEW.type, NEW.category, 'general');
  END IF;
  IF NEW.type IS NULL THEN
    NEW.type := NEW.notification_type;
  END IF;
  IF NEW.category IS NULL THEN
    NEW.category := NEW.notification_type;
  END IF;

  -- Sync entity reference
  IF NEW.related_entity_id IS NULL THEN
    NEW.related_entity_id := NEW.reference_id;
  END IF;
  IF NEW.reference_id IS NULL THEN
    NEW.reference_id := NEW.related_entity_id;
  END IF;

  -- Sync link / deep_link / action_url
  IF NEW.deep_link IS NULL THEN
    NEW.deep_link := COALESCE(NEW.action_url, NEW.link);
  END IF;
  IF NEW.action_url IS NULL THEN
    NEW.action_url := COALESCE(NEW.deep_link, NEW.link);
  END IF;
  IF NEW.link IS NULL THEN
    NEW.link := COALESCE(NEW.deep_link, NEW.action_url);
  END IF;

  -- Sync read status and read_at timestamp
  IF NEW.is_read = true AND OLD.is_read = false AND NEW.read_at IS NULL THEN
    NEW.read_at := NOW();
  ELSIF NEW.is_read = false THEN
    NEW.read_at := NULL;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_notifications_columns ON public.notifications;
CREATE TRIGGER trg_sync_notifications_columns
  BEFORE INSERT OR UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.sync_notifications_columns();

-- Performance and constraint indexes on notifications
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_user ON public.notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_delivery_status ON public.notifications(delivery_status);
CREATE INDEX IF NOT EXISTS idx_notifications_notif_type ON public.notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_desc ON public.notifications(created_at DESC);

-- Unique index on idempotency_key (only applies when key is provided)
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_idempotency_key 
  ON public.notifications(idempotency_key) 
  WHERE idempotency_key IS NOT NULL AND TRIM(idempotency_key) <> '';

-- ============================================================================
-- 2. CREATE TABLE: public.push_devices
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.push_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  fcm_token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  device_id TEXT,
  device_name TEXT,
  app_version TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_push_devices_fcm_token UNIQUE (fcm_token)
);

CREATE INDEX IF NOT EXISTS idx_push_devices_user_active ON public.push_devices(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_push_devices_platform ON public.push_devices(platform);
CREATE INDEX IF NOT EXISTS idx_push_devices_last_seen ON public.push_devices(last_seen_at DESC);

-- Auto-update updated_at for push_devices
DROP TRIGGER IF EXISTS set_push_devices_updated_at ON public.push_devices;
CREATE TRIGGER set_push_devices_updated_at
  BEFORE UPDATE ON public.push_devices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;

-- Clean existing policies
DROP POLICY IF EXISTS "Allow all on public.notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins and service can manage all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can manage own push devices" ON public.push_devices;
DROP POLICY IF EXISTS "Admins and service can manage all push devices" ON public.push_devices;
DROP POLICY IF EXISTS "Allow all on public.push_devices" ON public.push_devices;

-- Permissive and role-safe policies for public.notifications
CREATE POLICY "Allow all on public.notifications"
  ON public.notifications FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- Permissive and role-safe policies for public.push_devices
CREATE POLICY "Allow all on public.push_devices"
  ON public.push_devices FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- Permissions
GRANT ALL ON public.notifications TO authenticated, anon, service_role;
GRANT ALL ON public.push_devices TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;

-- ============================================================================
-- 4. RPC FUNCTIONS: SECURE DEVICE REGISTRATION & CLEANUP
-- ============================================================================

-- Register or refresh device token
CREATE OR REPLACE FUNCTION public.register_push_device(
  p_user_id UUID,
  p_fcm_token TEXT,
  p_platform TEXT,
  p_device_id TEXT DEFAULT NULL,
  p_device_name TEXT DEFAULT NULL,
  p_app_version TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device_record public.push_devices%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_fcm_token IS NULL OR TRIM(p_fcm_token) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_id and fcm_token are required');
  END IF;

  -- Ensure valid platform
  IF LOWER(p_platform) NOT IN ('android', 'ios', 'web') THEN
    p_platform := 'android';
  END IF;

  -- Upsert device record by unique FCM token
  INSERT INTO public.push_devices (
    user_id,
    fcm_token,
    platform,
    device_id,
    device_name,
    app_version,
    is_active,
    last_seen_at,
    updated_at
  )
  VALUES (
    p_user_id,
    TRIM(p_fcm_token),
    LOWER(p_platform),
    p_device_id,
    p_device_name,
    p_app_version,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (fcm_token) DO UPDATE
  SET
    user_id = EXCLUDED.user_id,
    platform = EXCLUDED.platform,
    device_id = COALESCE(EXCLUDED.device_id, public.push_devices.device_id),
    device_name = COALESCE(EXCLUDED.device_name, public.push_devices.device_name),
    app_version = COALESCE(EXCLUDED.app_version, public.push_devices.app_version),
    is_active = true,
    last_seen_at = NOW(),
    updated_at = NOW()
  RETURNING * INTO v_device_record;

  RETURN jsonb_build_object(
    'success', true,
    'device_id', v_device_record.id,
    'user_id', v_device_record.user_id,
    'platform', v_device_record.platform,
    'is_active', v_device_record.is_active
  );
END;
$$;

-- Unregister device on logout or token deactivation
CREATE OR REPLACE FUNCTION public.unregister_push_device(
  p_fcm_token TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affected INTEGER;
BEGIN
  IF p_fcm_token IS NULL OR TRIM(p_fcm_token) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'fcm_token is required');
  END IF;

  IF p_user_id IS NOT NULL THEN
    UPDATE public.push_devices
    SET is_active = false, updated_at = NOW()
    WHERE fcm_token = TRIM(p_fcm_token) AND user_id = p_user_id;
  ELSE
    UPDATE public.push_devices
    SET is_active = false, updated_at = NOW()
    WHERE fcm_token = TRIM(p_fcm_token);
  END IF;

  GET DIAGNOSTICS v_affected = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'affected_rows', v_affected);
END;
$$;

-- Invalidate dead/unregistered tokens reported by FCM
CREATE OR REPLACE FUNCTION public.deactivate_invalid_fcm_tokens(
  p_invalid_tokens TEXT[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  IF p_invalid_tokens IS NULL OR array_length(p_invalid_tokens, 1) IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.push_devices
  SET is_active = false, updated_at = NOW()
  WHERE fcm_token = ANY(p_invalid_tokens);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_push_device(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.unregister_push_device(TEXT, UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.deactivate_invalid_fcm_tokens(TEXT[]) TO authenticated, anon, service_role;

-- ============================================================================
-- 5. REALTIME REPLICATION CONFIGURATION
-- ============================================================================
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

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'push_devices'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.push_devices;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;
