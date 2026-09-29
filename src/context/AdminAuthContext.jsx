import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { supabase } from '../lib/supabaseClient';

const AdminAuthContext = createContext(null);

export const AdminAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true while restoring session

  // On mount: restore session and subscribe to real-time auth changes
  useEffect(() => {
    let isMounted = true;

    // 1. Initial restore
    authService.restoreSession().then((profile) => {
      if (isMounted) {
        setUser(profile);
        setLoading(false);
      }
    });

    // 2. Real-time auth synchronization
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (event === 'SIGNED_OUT' || !session?.user) {
        setUser(null);
        setLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        const profile = await authService.restoreSession();
        if (isMounted) {
          setUser(profile);
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await authService.login(email, password);
      if (res.success) {
        setUser(res.user);
      }
      return res;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const updateProfile = (updates) => {
    if (!user) return null;
    const updated = { ...user, ...updates };
    setUser(updated);
    return updated;
  };

  const refreshProfile = async () => {
    const profile = await authService.restoreSession();
    setUser(profile);
    return profile;
  };

  const hasPermission = () => {
    if (!user) return false;
    return user.role === 'super_admin';
  };

  const resetPassword = async (email) => {
    return authService.resetPassword(email);
  };

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        loading,
        login,
        logout,
        updateProfile,
        refreshProfile,
        hasPermission,
        resetPassword,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};
