import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tuepzwlxgnmtbjijtgta.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1ZXB6d2x4Z25tdGJqaWp0Z3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1Njk5NzksImV4cCI6MjEwNjE0NTk3OX0.KwVH3satwRxR9NzAwDBdRzANknMVDKSdIxynvhRkkyY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
