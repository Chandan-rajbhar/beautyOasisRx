-- ============================================================
-- BEAUTY OASIS Rx — INQUIRIES & INQUIRY MESSAGES TABLES & RLS
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create inquiries table
CREATE TABLE IF NOT EXISTS public.inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  contact_number TEXT,
  phone TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'New',
  priority TEXT NOT NULL DEFAULT 'Medium',
  received_at TIMESTAMPTZ DEFAULT NOW(),
  date TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Ensure all columns exist if table was previously partially created
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS ticket_id TEXT;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS contact_number TEXT;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'New';
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Medium';
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Create inquiry_messages table for conversation / chat history
CREATE TABLE IF NOT EXISTS public.inquiry_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES public.inquiries(id) ON DELETE CASCADE,
  ticket_id TEXT,
  sender_type TEXT NOT NULL DEFAULT 'admin', -- 'admin' or 'client'
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all columns exist on inquiry_messages
ALTER TABLE public.inquiry_messages ADD COLUMN IF NOT EXISTS inquiry_id UUID;
ALTER TABLE public.inquiry_messages ADD COLUMN IF NOT EXISTS ticket_id TEXT;
ALTER TABLE public.inquiry_messages ADD COLUMN IF NOT EXISTS sender_type TEXT DEFAULT 'admin';
ALTER TABLE public.inquiry_messages ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE public.inquiry_messages ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.inquiry_messages ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.inquiry_messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.inquiry_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.inquiry_messages ADD COLUMN IF NOT EXISTS deleted_by TEXT;
ALTER TABLE public.inquiry_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 5. Create inquiry_attachments table for dedicated relational attachment queries
CREATE TABLE IF NOT EXISTS public.inquiry_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.inquiry_messages(id) ON DELETE CASCADE,
  inquiry_id UUID REFERENCES public.inquiries(id) ON DELETE CASCADE,
  ticket_id TEXT,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all columns exist on inquiry_attachments
ALTER TABLE public.inquiry_attachments ADD COLUMN IF NOT EXISTS message_id UUID;
ALTER TABLE public.inquiry_attachments ADD COLUMN IF NOT EXISTS inquiry_id UUID;
ALTER TABLE public.inquiry_attachments ADD COLUMN IF NOT EXISTS ticket_id TEXT;
ALTER TABLE public.inquiry_attachments ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE public.inquiry_attachments ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE public.inquiry_attachments ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE public.inquiry_attachments ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE public.inquiry_attachments ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ DEFAULT NOW();

-- 6. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_inquiries_ticket_id ON public.inquiries(ticket_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_email ON public.inquiries(email);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON public.inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_priority ON public.inquiries(priority);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON public.inquiries(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inquiry_messages_inquiry_id ON public.inquiry_messages(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_messages_ticket_id ON public.inquiry_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_messages_created_at ON public.inquiry_messages(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_inquiry_messages_is_deleted ON public.inquiry_messages(is_deleted);

CREATE INDEX IF NOT EXISTS idx_inquiry_attachments_message_id ON public.inquiry_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_attachments_inquiry_id ON public.inquiry_attachments(inquiry_id);

-- 7. Row Level Security (RLS)
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiry_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiry_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on public.inquiries" ON public.inquiries;
CREATE POLICY "Allow all on public.inquiries"
  ON public.inquiries FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on public.inquiry_messages" ON public.inquiry_messages;
CREATE POLICY "Allow all on public.inquiry_messages"
  ON public.inquiry_messages FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on public.inquiry_attachments" ON public.inquiry_attachments;
CREATE POLICY "Allow all on public.inquiry_attachments"
  ON public.inquiry_attachments FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- 8. Storage Bucket for inquiry attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('inquiry-attachments', 'inquiry-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage object policies
DROP POLICY IF EXISTS "Allow public read inquiry attachments" ON storage.objects;
CREATE POLICY "Allow public read inquiry attachments"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'inquiry-attachments');

DROP POLICY IF EXISTS "Allow public upload inquiry attachments" ON storage.objects;
CREATE POLICY "Allow public upload inquiry attachments"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'inquiry-attachments');

-- 9. Permissions
GRANT ALL ON public.inquiries TO authenticated, anon, service_role;
GRANT ALL ON public.inquiry_messages TO authenticated, anon, service_role;
GRANT ALL ON public.inquiry_attachments TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;

-- 10. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
