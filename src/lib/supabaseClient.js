import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tuepzwlxgnmtbjijtgta.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1ZXB6d2x4Z25tdGJqaWp0Z3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1Njk5NzksImV4cCI6MjEwNjE0NTk3OX0.KwVH3satwRxR9NzAwDBdRzANknMVDKSdIxynvhRkkyY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
})
