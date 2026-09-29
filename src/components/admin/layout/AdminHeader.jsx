import React, { useState, useRef, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  Menu,
  PanelLeft,
  Bell,
  Plus,
  Search,
  User,
  LogOut,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  Calendar,
  UserPlus
} from 'lucide-react';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { useAdminData } from '../../../context/AdminDataContext';
import { AdminNotificationDropdown } from '../ui/AdminNotificationDropdown';

export const AdminHeader = ({
  onToggleSidebar,
  onToggleMobile,
  isSidebarCollapsed,
  isMobileOpen,
  onOpenNewAppointment,
  onOpenNewClient,
  onRequestLogout
}) => {
  const { user, logout } = useAdminAuth();
  const { stats } = useAdminData();
  const location = useLocation();
  const navigate = useNavigate();

  const userPhoto = user?.profile_photo_url || user?.avatar || null;
  const userName = user?.name || (user?.email ? user.email.split('@')[0] : 'Admin');
  const userRole = user?.role || 'super_admin';
  const userInitial = (userName || 'A').charAt(0).toUpperCase();
  const userEmail = user?.email || '';

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const profileRef = useRef(null);
  const quickAddRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
      if (quickAddRef.current && !quickAddRef.current.contains(e.target)) {
        setQuickAddOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Compute breadcrumb title based on path
  const getBreadcrumbTitle = () => {
    const path = location.pathname.replace('/admin', '').replace('/', '');
    if (!path || path === 'dashboard') return 'Dashboard Overview';
    return path.charAt(0).toUpperCase() + path.slice(1).replace('-', ' ');
  };

  return (
    <header className="admin-header">
      {/* Header Left with Side Drawer Icon */}
      <div className="admin-header-left">
        <button
          className="admin-menu-toggle"
          onClick={onToggleSidebar || onToggleMobile}
          title="Toggle Side Drawer"
          aria-label="Toggle Side Drawer"
        >
          <PanelLeft size={20} />
        </button>

        <div className="admin-breadcrumbs">
          <Link to="/dashboard" className="admin-breadcrumb-home">Dashboard</Link>
          <span className="admin-breadcrumb-sep">/</span>
          <span className="admin-breadcrumbs-current">{getBreadcrumbTitle()}</span>
        </div>
      </div>

      {/* Header Right */}
      <div className="admin-header-right">
        {/* Quick Add Menu (Create New) - Commented out
        <div style={{ position: 'relative' }} ref={quickAddRef}>
          <button
            className="admin-quick-add-btn"
            onClick={() => setQuickAddOpen(!quickAddOpen)}
            title="Create New"
          >
            <Plus size={16} />
            <span className="admin-quick-add-text">Create New</span>
            <ChevronDown size={14} className="admin-quick-add-arrow" />
          </button>

          {quickAddOpen && (
            <div
              style={{
                position: 'absolute',
                top: '46px',
                right: 0,
                width: '210px',
                background: '#ffffff',
                borderRadius: '12px',
                boxShadow: '0 10px 30px rgba(11, 37, 69, 0.15)',
                border: '1px solid #e2e8f0',
                zIndex: 300,
                padding: '6px'
              }}
            >
              <button
                onClick={() => {
                  setQuickAddOpen(false);
                  if (onOpenNewAppointment) onOpenNewAppointment();
                  else navigate('/appointments?action=new');
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  fontSize: '0.84rem',
                  color: '#334155',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f7ff')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Calendar size={15} color="#1e5aa8" /> New Appointment
              </button>

              <button
                onClick={() => {
                  setQuickAddOpen(false);
                  if (onOpenNewClient) onOpenNewClient();
                  else navigate('/clients?action=new');
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  fontSize: '0.84rem',
                  color: '#334155',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f7ff')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <UserPlus size={15} color="#16a34a" /> Add New Client
              </button>
            </div>
          )}
        </div>
        */}

        {/* Notifications Icon Button */}
        <div style={{ position: 'relative' }}>
          <button
            className="admin-header-icon-btn"
            onClick={() => setNotifOpen(!notifOpen)}
            title="Notifications"
          >
            <Bell size={18} />
            {stats.unreadNotificationsCount > 0 && (
              <span className="admin-notif-pill">
                {stats.unreadNotificationsCount}
              </span>
            )}
          </button>

          <AdminNotificationDropdown
            isOpen={notifOpen}
            onClose={() => setNotifOpen(false)}
          />
        </div>

        {/* Admin Profile Dropdown */}
        <div style={{ position: 'relative' }} ref={profileRef}>
          <button
            className="admin-profile-btn"
            onClick={() => setProfileOpen(!profileOpen)}
            aria-label="Admin profile menu"
          >
            {userPhoto ? (
              <img
                src={userPhoto}
                alt={userName}
                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.nextElementSibling) {
                    e.currentTarget.nextElementSibling.style.display = 'flex';
                  }
                }}
              />
            ) : null}
            <div
              className="admin-header-avatar-initials"
              style={{
                display: userPhoto ? 'none' : 'flex',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1e5aa8 0%, #16a34a 100%)',
                color: '#ffffff',
                fontSize: '0.85rem',
                fontWeight: 700,
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {userInitial}
            </div>
            <div className="admin-header-profile-text">
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f2942', lineHeight: 1.2 }}>
                {userName}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#16a34a', fontWeight: 600 }}>
                {userRole}
              </div>
            </div>
            <ChevronDown size={14} color="#64748b" className="admin-profile-chevron" />
          </button>

          {profileOpen && (
            <div
              style={{
                position: 'absolute',
                top: '50px',
                right: 0,
                width: '240px',
                background: '#ffffff',
                borderRadius: '14px',
                boxShadow: '0 12px 36px rgba(11, 37, 69, 0.15)',
                border: '1px solid #e2e8f0',
                zIndex: 300,
                overflow: 'hidden'
              }}
            >
              <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f2942' }}>
                  {userName}
                </div>
                {userEmail && (
                  <div style={{ fontSize: '0.75rem', color: '#64748b', wordBreak: 'break-all', marginTop: '2px' }}>
                    {userEmail}
                  </div>
                )}
                <div style={{ marginTop: '6px' }}>
                  <span
                    style={{
                      background: '#dcfce7',
                      color: '#15803d',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      textTransform: 'uppercase',
                      display: 'inline-block'
                    }}
                  >
                    {userRole.toUpperCase()}
                  </span>
                </div>
              </div>

              <div style={{ padding: '6px' }}>
                <Link
                  to="/profile"
                  onClick={() => setProfileOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    fontSize: '0.84rem',
                    color: '#334155',
                    borderRadius: '8px',
                    textDecoration: 'none'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f7ff')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <User size={15} color="#1e5aa8" /> My Profile
                </Link>

                <div style={{ height: '1px', background: '#f1f5f9', margin: '6px 0' }} />

                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    if (onRequestLogout) {
                      onRequestLogout();
                    } else {
                      logout().then(() => navigate('/login'));
                    }
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.84rem',
                    color: '#b91c1c',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#fee2e2')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <LogOut size={15} color="#b91c1c" /> Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
