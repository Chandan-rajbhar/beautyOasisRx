import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Shield,
  Lock,
  Save,
  AlertCircle,
  CheckCircle,
  Edit3,
  X,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { AdminButton } from '../../components/admin/ui/AdminButton';
import { AdminBadge } from '../../components/admin/ui/AdminBadge';
import { supabase } from '../../lib/supabaseClient';
import toast from 'react-hot-toast';

export const ProfilePage = () => {
  const { user, updateProfile, refreshProfile } = useAdminAuth();

  // Mode state: View mode by default
  const [isEditing, setIsEditing] = useState(false);

  // Dynamic profile data state loaded from Supabase
  const [profileData, setProfileData] = useState(user || null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Profile Form state
  const [formData, setFormData] = useState({
    name: user?.name || '',
  });

  // Password Change state
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // ── Load Super Admin profile data dynamically from Supabase ──
  const fetchProfileFromSupabase = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.warn('[ProfilePage] Error fetching user record from Supabase:', error);
      }

      if (data) {
        setProfileData(data);
        setFormData({ name: data.name || user.name || '' });
        updateProfile(data);
      } else if (user) {
        setProfileData(user);
        setFormData({ name: user.name || '' });
      }
    } catch (err) {
      console.error('[ProfilePage] Unexpected error loading profile:', err);
    }
  };

  useEffect(() => {
    fetchProfileFromSupabase();
  }, [user?.id]);

  // Keep in sync with context user if updated elsewhere
  useEffect(() => {
    if (user && !isEditing) {
      setProfileData(user);
      setFormData({ name: user.name || '' });
    }
  }, [user, isEditing]);

  // ── Handle Profile Update ──
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = formData.name.trim();

    if (!trimmedName) {
      toast.error('Full Name is required.');
      return;
    }

    setProfileLoading(true);
    try {
      // 1. Update public.users record in Supabase
      const { data: updatedRecord, error: dbError } = await supabase
        .from('users')
        .update({
          name: trimmedName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select()
        .maybeSingle();

      if (dbError) throw dbError;

      // 2. Synchronize Supabase Auth user metadata
      try {
        await supabase.auth.updateUser({
          data: { name: trimmedName },
        });
      } catch (metaErr) {
        console.warn('[ProfilePage] Auth user_metadata update notice:', metaErr);
      }

      // 3. Refresh and synchronize context and local states
      const refreshedProfile = updatedRecord || { ...profileData, name: trimmedName };
      setProfileData(refreshedProfile);
      setFormData({ name: trimmedName });
      updateProfile({ name: trimmedName });
      if (refreshProfile) {
        await refreshProfile();
      }

      toast.success('Profile updated successfully.');
      setIsEditing(false);
    } catch (err) {
      console.error('[ProfilePage] Error updating profile:', err);
      toast.error(err?.message || 'Failed to update profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  // ── Cancel Edit Mode ──
  const handleCancelEdit = () => {
    setFormData({ name: profileData?.name || user?.name || '' });
    setIsEditing(false);
  };

  // ── Handle Password Change via Supabase Auth ──
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    const newPwd = passwordData.newPassword;
    const confirmPwd = passwordData.confirmPassword;

    if (!newPwd) {
      setPasswordError('Please enter a new password.');
      return;
    }

    if (newPwd.length < 8) {
      setPasswordError('Password must be at least 8 characters long.');
      return;
    }

    if (newPwd !== confirmPwd) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    setPasswordLoading(true);
    try {
      // Securely update password using Supabase Auth (not stored in DB table)
      const { error } = await supabase.auth.updateUser({
        password: newPwd,
      });

      if (error) throw error;

      setPasswordSuccess('Password updated successfully.');
      toast.success('Password updated successfully.');
      setPasswordData({ newPassword: '', confirmPassword: '' });

      setTimeout(() => {
        setPasswordSuccess('');
      }, 4000);
    } catch (err) {
      console.error('[ProfilePage] Password change error:', err);
      const errMsg = err?.message || 'Failed to update password. Please try again.';
      setPasswordError(errMsg);
      toast.error(errMsg);
    } finally {
      setPasswordLoading(false);
    }
  };

  const activeUser = profileData || user;
  const userPhoto = activeUser?.profile_photo_url || activeUser?.avatar || null;
  const userName = activeUser?.name || '—';
  const userEmail = activeUser?.email || '';
  const userRole = activeUser?.role === 'super_admin' ? 'Super Admin' : (activeUser?.role || 'Super Admin');
  const userInitial = (userName && userName !== '—' ? userName : (userEmail || 'A')).charAt(0).toUpperCase();

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>My Profile</h1>
          <p>Manage your account name and security password.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Profile Card */}
        <div className="admin-card">
          {/* Avatar header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            {userPhoto ? (
              <img
                src={userPhoto}
                alt={userName}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid #22c55e',
                  flexShrink: 0,
                }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.nextElementSibling) {
                    e.currentTarget.nextElementSibling.style.display = 'flex';
                  }
                }}
              />
            ) : null}
            <div
              style={{
                display: userPhoto ? 'none' : 'flex',
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1e5aa8, #16a34a)',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '1.5rem',
                fontWeight: 700,
                flexShrink: 0,
                border: '2px solid #22c55e',
              }}
            >
              {userInitial}
            </div>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: '1.15rem', color: '#0f2942' }}>
                {userName}
              </h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <AdminBadge status={userRole} />
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                {userEmail}
              </div>
            </div>
          </div>

          <form onSubmit={handleProfileSubmit}>
            {/* Full Name */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                <User size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Full Name
              </label>
              <input
                type="text"
                className="admin-form-input"
                value={isEditing ? formData.name : (userName !== '—' ? userName : '')}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                readOnly={!isEditing}
                disabled={!isEditing && false}
                style={{
                  background: isEditing ? '#ffffff' : '#f8fafc',
                  color: isEditing ? '#0f172a' : '#334155',
                  borderColor: isEditing ? '#1e5aa8' : '#e2e8f0',
                  cursor: isEditing ? 'text' : 'default',
                  transition: 'all 0.15s ease',
                }}
                required={isEditing}
                placeholder="Full Name"
                autoFocus={isEditing}
              />
            </div>

            {/* Email Address — Read-only */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                <Mail size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Email Address
              </label>
              <input
                type="email"
                className="admin-form-input"
                value={userEmail}
                disabled
                style={{ opacity: 0.6, cursor: 'not-allowed', background: '#f8fafc' }}
              />
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '4px 0 0' }}>
                Email is managed via Supabase Auth and cannot be changed here.
              </p>
            </div>

            {/* Role — Read-only */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                <Shield size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Role
              </label>
              <input
                type="text"
                className="admin-form-input"
                value={userRole}
                disabled
                style={{ opacity: 0.6, cursor: 'not-allowed', background: '#f8fafc' }}
              />
            </div>

            {/* Actions: View Mode vs Edit Mode */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              {isEditing ? (
                <>
                  <AdminButton
                    type="button"
                    variant="secondary"
                    icon={<X size={15} />}
                    onClick={handleCancelEdit}
                    disabled={profileLoading}
                  >
                    Cancel
                  </AdminButton>
                  <AdminButton
                    type="submit"
                    variant="primary"
                    icon={<Save size={15} />}
                    loading={profileLoading}
                    disabled={profileLoading}
                  >
                    Save Profile
                  </AdminButton>
                </>
              ) : (
                <AdminButton
                  type="button"
                  variant="primary"
                  icon={<Edit3 size={15} />}
                  onClick={() => setIsEditing(true)}
                >
                  Edit Profile
                </AdminButton>
              )}
            </div>
          </form>
        </div>

        {/* Change Password Card */}
        <div className="admin-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Lock size={20} color="#1e5aa8" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f2942' }}>
              Update Password
            </h3>
          </div>

          {passwordSuccess && (
            <div
              style={{
                padding: '12px 14px',
                background: '#dcfce7',
                color: '#15803d',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle size={15} />
              {passwordSuccess}
            </div>
          )}

          {passwordError && (
            <div
              style={{
                padding: '12px 14px',
                background: '#fee2e2',
                color: '#b91c1c',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={15} />
              {passwordError}
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} noValidate>
            <div className="admin-form-group">
              <label className="admin-form-label">
                <Lock size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                New Password (min. 8 characters)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  className="admin-form-input"
                  placeholder="••••••••"
                  required
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px',
                  }}
                  title={showNewPassword ? 'Hide password' : 'Show password'}
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">
                <Lock size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Confirm New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="admin-form-input"
                  placeholder="Confirm password"
                  required
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                  }
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px',
                  }}
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <AdminButton
                type="submit"
                variant="primary"
                icon={<Lock size={15} />}
                loading={passwordLoading}
                disabled={passwordLoading}
              >
                Update Password
              </AdminButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
