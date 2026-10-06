/**
 * supabaseAdmin.js
 *
 * A secondary, isolated Supabase client used exclusively for
 * server-side-style user creation operations (signUp) in Admin flows.
 *
 * KEY DESIGN DECISION:
 *   persistSession: false     -- signUp() responses are NEVER written to
 *                                localStorage/sessionStorage, so the Super
 *                                Admin active session is completely untouched.
 *   autoRefreshToken: false   -- No background token refresh that could
 *                                bleed into the primary session.
 *   detectSessionInUrl: false -- Ignores ?access_token params in URL.
 *   storageKey (unique)       -- Even in-memory tokens use a key the main
 *                                app never reads.
 *
 * Usage:
 *   import { supabaseAdmin } from '../lib/supabaseAdmin';
 *   const { data, error } = await supabaseAdmin.auth.signUp({ ... });
 *   await supabaseAdmin.auth.signOut(); // always clear after creation
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tuepzwlxgnmtbjijtgta.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1ZXB6d2x4Z25tdGJqaWp0Z3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1Njk5NzksImV4cCI6MjEwNjE0NTk3OX0.KwVH3satwRxR9NzAwDBdRzANknMVDKSdIxynvhRkkyY';

export const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,   // Never write tokens to any storage
    autoRefreshToken: false,   // No background refresh
    detectSessionInUrl: false,   // Ignore URL tokens
    storageKey: 'sb-admin-create-user-isolated', // Unique key, never read by main app
  },
});
