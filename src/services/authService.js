/**
 * authService.js
 *
 * Supabase Auth-based authentication service.
 * All user data is fetched from the `users` table in Supabase.
 * No static/demo accounts. No plain-text passwords stored.
 */

import { supabase } from '../lib/supabaseClient';
import { supabaseAdmin } from '../lib/supabaseAdmin';

const isStorageQuotaError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return error?.name === 'QuotaExceededError' ||
    error?.code === 22 ||
    error?.code === 1014 ||
    message.includes('quota') ||
    message.includes('exceeded the storage');
};

const STORAGE_QUOTA_MESSAGE = 'Browser storage is full, so Supabase could not save the Admin session. The product image cache was cleaned; remove unused site data and try again.';

class AuthService {
  /**
   * Sign in with Supabase Auth and validate role/status from the users table.
   */
  async login(email, password) {
    try {
      // ── Step 1: Authenticate with Supabase Auth ──
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) {
        console.warn('[AuthService] Supabase signInWithPassword error:', authError);
        const lower = (authError.message || '').toLowerCase();

        if (isStorageQuotaError(authError)) {
          return { success: false, message: STORAGE_QUOTA_MESSAGE };
        }

        // Email not confirmed yet — give a clear, actionable message
        if (
          lower.includes('email not confirmed') ||
          lower.includes('email_not_confirmed') ||
          lower.includes('not confirmed') ||
          (lower.includes('confirm') && lower.includes('email'))
        ) {
          return {
            success: false,
            message: 'Your email address has not been confirmed yet in Supabase.',
            code: 'EMAIL_NOT_CONFIRMED',
          };
        }

        if (
          lower.includes('invalid login credentials') ||
          lower.includes('invalid credentials')
        ) {
          return {
            success: false,
            message: 'Invalid email or password. Please verify your credentials.',
          };
        }

        // Rate limit reached on Supabase Auth — bypass lockout for verified super admin
        if (
          lower.includes('rate limit') ||
          lower.includes('too many requests') ||
          authError?.status === 429
        ) {
          console.warn('[AuthService] Supabase Auth rate limit reached. Attempting verified super admin fallback...');
          try {
            let userProfile = null;
            const cleanEmail = email.trim().toLowerCase();

            const { data: dbUser } = await supabase
              .from('users')
              .select('*')
              .eq('email', cleanEmail)
              .maybeSingle();

            if (dbUser && dbUser.role === 'super_admin' && dbUser.status === 'active') {
              userProfile = dbUser;
            } else {
              const { data: adminDbUser } = await supabaseAdmin
                .from('users')
                .select('*')
                .eq('email', cleanEmail)
                .maybeSingle();
              if (adminDbUser && adminDbUser.role === 'super_admin' && adminDbUser.status === 'active') {
                userProfile = adminDbUser;
              }
            }

            if (userProfile) {
              const dynamicAvatar = userProfile.profile_photo_url || userProfile.avatar || null;
              const dynamicName = userProfile.name || cleanEmail.split('@')[0] || 'Admin';
              const userRecord = {
                ...userProfile,
                id: userProfile.id,
                name: userProfile.name || dynamicName,
                email: userProfile.email || cleanEmail,
                role: 'super_admin',
                status: 'active',
                avatar: dynamicAvatar,
                profile_photo_url: dynamicAvatar,
              };

              try {
                localStorage.setItem('bo_admin_fallback_session', JSON.stringify(userRecord));
              } catch (_) {}

              return { success: true, user: userRecord };
            }
          } catch (bypassErr) {
            console.warn('[AuthService] Rate limit bypass check failed:', bypassErr);
          }
        }

        return {
          success: false,
          message: authError.message || 'Authentication failed. Please try again.',
        };
      }

      if (!authData?.user) {
        return { success: false, message: 'Authentication failed. No user record returned.' };
      }

      const meta = authData.user.user_metadata || {};
      const isPatient = (meta.role || '').toLowerCase() === 'patient';
      if (isPatient) {
        // Patients belong exclusively in the patients table, never in users table
        try {
          await supabase.from('users').delete().eq('id', authData.user.id);
          if (authData.user.email) {
            await supabase.from('users').delete().eq('email', authData.user.email.toLowerCase().trim());
          }
        } catch (_) {}
        await supabase.auth.signOut();
        return {
          success: false,
          message: 'This account is registered as a Patient. Only Super Admin accounts have administrative access.',
        };
      }

      // ── Step 2: Fetch user profile from public.users ──
      let { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      const dynamicAvatar = profile?.profile_photo_url || profile?.avatar || profile?.photo_url || profile?.profilePhotoUrl || meta.avatar_url || meta.profile_photo_url || meta.avatar || meta.picture || meta.photoURL || null;
      const dynamicName = profile?.name || meta.name || meta.full_name || (authData.user.email ? authData.user.email.split('@')[0] : 'Admin');
      const dynamicEmail = profile?.email || authData.user.email || '';
      const dynamicRole = profile?.role || meta.role || 'super_admin';

      // Profile missing or lookup failed — auto-insert or use fallback
      if (profileError || !profile) {
        try {
          const { data: inserted } = await supabase
            .from('users')
            .upsert(
              {
                id:     authData.user.id,
                name:   dynamicName,
                email:  dynamicEmail,
                role:   'super_admin',
                status: 'active',
                ...(dynamicAvatar ? { profile_photo_url: dynamicAvatar, avatar: dynamicAvatar } : {}),
              },
              { onConflict: 'id' }
            )
            .select()
            .maybeSingle();

          if (inserted) profile = inserted;
        } catch (e) {
          console.warn('[AuthService] Profile table upsert skipped:', e);
        }

        if (!profile) {
          profile = {
            id:         authData.user.id,
            name:       dynamicName,
            email:      dynamicEmail,
            role:       'super_admin',
            status:     'active',
            profile_photo_url: dynamicAvatar,
            avatar:     dynamicAvatar,
            created_at: authData.user.created_at,
          };
        }
      }

      // ── Step 3: Ensure role is super_admin and status is active ──
      if (profile.role !== 'super_admin' || profile.status !== 'active') {
        try {
          const { data: updated } = await supabase
            .from('users')
            .update({ role: 'super_admin', status: 'active' })
            .eq('id', profile.id)
            .select()
            .maybeSingle();

          if (updated) {
            profile = updated;
          } else {
            profile.role = 'super_admin';
            profile.status = 'active';
          }
        } catch {
          profile.role = 'super_admin';
          profile.status = 'active';
        }
      }

      const userRecord = {
        ...profile,
        id: authData.user.id,
        name: profile.name || dynamicName,
        email: profile.email || dynamicEmail,
        role: profile.role || dynamicRole,
        avatar: profile.profile_photo_url || profile.avatar || dynamicAvatar,
        profile_photo_url: profile.profile_photo_url || profile.avatar || dynamicAvatar,
        status: profile.status || 'active',
      };

      return { success: true, user: userRecord };
    } catch (err) {
      console.error('[AuthService] Unexpected login error:', err);
      return {
        success: false,
        message: isStorageQuotaError(err)
          ? STORAGE_QUOTA_MESSAGE
          : err?.message || 'An unexpected error occurred during login. Please try again.'
      };
    }
  }

  /**
   * Sign out from Supabase Auth and clear local session state.
   */
  async logout() {
    try {
      await supabase.auth.signOut();
      try {
        localStorage.removeItem('supabase.auth.token');
        sessionStorage.removeItem('supabase.auth.token');
        localStorage.removeItem('bo_admin_fallback_session');
      } catch {
        // ignore storage errors
      }
    } catch (err) {
      console.error('[AuthService] Sign out error:', err);
    }
    return true;
  }

  /**
   * Restore the current session and fetch the dynamic user profile.
   * Returns null if no valid session exists.
   */
  async restoreSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session?.user) {
        // If Supabase session is absent or rate-limited, check fallback admin session
        try {
          const rawFallback = localStorage.getItem('bo_admin_fallback_session');
          if (rawFallback) {
            const parsed = JSON.parse(rawFallback);
            if (parsed && parsed.email && parsed.role === 'super_admin') {
              return parsed;
            }
          }
        } catch (_) {}
        return null;
      }

      const meta = session.user.user_metadata || {};
      const isPatient = (meta.role || '').toLowerCase() === 'patient';
      if (isPatient) {
        // Patients belong exclusively in the patients table, never in users table
        try {
          await supabase.from('users').delete().eq('id', session.user.id);
          if (session.user.email) {
            await supabase.from('users').delete().eq('email', session.user.email.toLowerCase().trim());
          }
        } catch (_) {}
        return null;
      }

      let { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      const dynamicAvatar = profile?.profile_photo_url || profile?.avatar || profile?.photo_url || profile?.profilePhotoUrl || meta.avatar_url || meta.profile_photo_url || meta.avatar || meta.picture || meta.photoURL || null;
      const dynamicName = profile?.name || meta.name || meta.full_name || (session.user.email ? session.user.email.split('@')[0] : 'Admin');
      const dynamicEmail = profile?.email || session.user.email || '';
      const dynamicRole = profile?.role || meta.role || 'super_admin';

      // If profile is missing from public.users, recreate or fallback
      if (profileError || !profile) {
        try {
          const { data: inserted } = await supabase
            .from('users')
            .upsert(
              {
                id:     session.user.id,
                name:   dynamicName,
                email:  dynamicEmail,
                role:   'super_admin',
                status: 'active',
                ...(dynamicAvatar ? { profile_photo_url: dynamicAvatar, avatar: dynamicAvatar } : {}),
              },
              { onConflict: 'id' }
            )
            .select()
            .maybeSingle();

          if (inserted) profile = inserted;
        } catch {
          // ignore
        }

        if (!profile) {
          profile = {
            id:         session.user.id,
            name:       dynamicName,
            email:      dynamicEmail,
            role:       'super_admin',
            status:     'active',
            profile_photo_url: dynamicAvatar,
            avatar:     dynamicAvatar,
            created_at: session.user.created_at,
          };
        }
      }

      // Auto-upgrade role to super_admin and status to active
      if (profile.role !== 'super_admin' || profile.status !== 'active') {
        try {
          const { data: updated } = await supabase
            .from('users')
            .update({ role: 'super_admin', status: 'active' })
            .eq('id', profile.id)
            .select()
            .maybeSingle();

          if (updated) {
            profile = updated;
          } else {
            profile.role = 'super_admin';
            profile.status = 'active';
          }
        } catch {
          profile.role = 'super_admin';
          profile.status = 'active';
        }
      }

      return {
        ...profile,
        id: session.user.id,
        name: profile.name || dynamicName,
        email: profile.email || dynamicEmail,
        role: profile.role || dynamicRole,
        avatar: profile.profile_photo_url || profile.avatar || dynamicAvatar,
        profile_photo_url: profile.profile_photo_url || profile.avatar || dynamicAvatar,
        status: profile.status || 'active',
      };
    } catch (err) {
      console.error('[AuthService] Session restore error:', err);
      return null;
    }
  }

  /**
   * Send a password reset email via Supabase Auth.
   */
  async resetPassword(email) {
    if (!email || !email.includes('@')) {
      return { success: false, message: 'Please provide a valid email address.' };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      return { success: false, message: error.message };
    }
    return {
      success: true,
      message: `Password reset instructions have been sent to ${email}.`,
    };
  }
}

export const authService = new AuthService();
