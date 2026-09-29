import React, { useState } from 'react';
import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { PageLoader } from '../ui/AdminLoaders';
import { AdminLogoutDialog } from '../ui/AdminLogoutDialog';
import '../../../styles/admin.css';

// Standalone component for unauthorized state (avoids hook-in-render issues)
const UnauthorizedScreen = ({ onSignOut }) => (
  <div
    style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #091e36 0%, #0b2545 50%, #0f2942 100%)',
      padding: '24px',
    }}
  >
    <div
      style={{
        maxWidth: '480px',
        background: 'rgba(255,255,255,0.98)',
        borderRadius: '20px',
        padding: '40px 36px',
        textAlign: 'center',
        boxShadow: '0 25px 70px rgba(0,0,0,0.4)',
      }}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: '#fee2e2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          fontSize: '28px',
        }}
      >
        🚫
      </div>
      <h2
        style={{
          fontFamily: 'var(--font-serif-display)',
          fontSize: '1.5rem',
          color: '#0f2942',
          margin: '0 0 12px',
        }}
      >
        Access Denied
      </h2>
      <p style={{ color: '#475569', fontSize: '0.9rem', margin: '0 0 24px', lineHeight: '1.6' }}>
        You are not authorized to access the Clinical Portal. This area is restricted to{' '}
        <strong>Super Admin</strong> users only.
      </p>
      <button
        onClick={onSignOut}
        style={{
          background: '#1e5aa8',
          color: '#fff',
          border: 'none',
          padding: '10px 24px',
          borderRadius: '10px',
          fontSize: '0.88rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Return to Login
      </button>
    </div>
  </div>
);

export const AdminLayout = () => {
  const { isAuthenticated, loading, user, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  // While the session is being restored, show a full-screen loader
  if (loading) {
    return <PageLoader />;
  }

  // Not authenticated → redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated but not super_admin → unauthorized screen
  if (user?.role !== 'super_admin') {
    const handleSignOut = async () => {
      await logout();
      navigate('/login', { replace: true });
    };
    return <UnauthorizedScreen onSignOut={handleSignOut} />;
  }

  const handleToggleSidebar = () => {
    if (window.innerWidth <= 1024) {
      setMobileOpen((prev) => !prev);
    } else {
      setCollapsed((prev) => !prev);
    }
  };

  const handleConfirmLogout = async () => {
    setLogoutLoading(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLogoutLoading(false);
      setShowLogoutModal(false);
    }
  };

  return (
    <div className="admin-app">
      {/* Sidebar */}
      <AdminSidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onRequestLogout={() => setShowLogoutModal(true)}
      />

      {/* Main Content Area */}
      <div className={`admin-main ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <AdminHeader
          onToggleSidebar={handleToggleSidebar}
          onToggleMobile={() => setMobileOpen((prev) => !prev)}
          isSidebarCollapsed={collapsed}
          isMobileOpen={mobileOpen}
          onRequestLogout={() => setShowLogoutModal(true)}
        />

        <main className="admin-body">
          <Outlet />
        </main>
      </div>

      {/* Logout Confirmation Modal */}
      <AdminLogoutDialog
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout}
        loading={logoutLoading}
      />
    </div>
  );
};
