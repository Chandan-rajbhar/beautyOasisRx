import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Sparkles,
  ShoppingBag,
  ShoppingCart,
  CreditCard,
  UserCheck,
  MessageSquare,
  Globe,
  Bell,
  Shield,
  Settings,
  LogOut,
  X
} from 'lucide-react';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { useAdminData } from '../../../context/AdminDataContext';
import { AdminLogoutDialog } from '../ui/AdminLogoutDialog';
import brandLogo from '../../../assets/logo.png';

export const AdminSidebar = ({
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
  onRequestLogout
}) => {
  const { user, logout, hasPermission } = useAdminAuth();
  const { stats } = useAdminData();
  const navigate = useNavigate();

  const [localLogoutOpen, setLocalLogoutOpen] = useState(false);
  const [localLogoutLoading, setLocalLogoutLoading] = useState(false);

  const handleLogoutClick = () => {
    if (onRequestLogout) {
      onRequestLogout();
    } else {
      setLocalLogoutOpen(true);
    }
  };

  const handleLocalConfirmLogout = async () => {
    setLocalLogoutLoading(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLocalLogoutLoading(false);
      setLocalLogoutOpen(false);
    }
  };

  const userPhoto = user?.profile_photo_url || user?.avatar || null;
  const userName = user?.name || (user?.email ? user.email.split('@')[0] : 'Admin');
  const userRole = user?.role || 'super_admin';
  const userInitial = (userName || 'A').charAt(0).toUpperCase();

  // On mobile/tablet (when mobileOpen is active), always show full drawer labels
  const isCollapsed = collapsed && !mobileOpen;

  const navSections = [
    {
      label: "Clinical & Practice",
      items: [
        { label: "Dashboard", path: "/dashboard", icon: <LayoutDashboard size={18} />, permission: "all" },
        { label: "Appointments", path: "/appointments", icon: <Calendar size={18} />, badge: stats.todayAppointmentsCount || null, permission: "appointments" },
        { label: "Clients / Patients", path: "/clients", icon: <Users size={18} />, permission: "clients" },
        { label: "Treatments & Services", path: "/services", icon: <Sparkles size={18} />, permission: "services" },
        { label: "Staff & Providers", path: "/providers", icon: <UserCheck size={18} />, permission: "providers" }
      ]
    },
    {
      label: "Apothecary & Finance",
      items: [
        { label: "Products Catalog", path: "/products", icon: <ShoppingBag size={18} />, permission: "products" },
        { label: "Orders", path: "/orders", icon: <ShoppingCart size={18} />, permission: "orders" },
        { label: "Payments", path: "/payments", icon: <CreditCard size={18} />, permission: "payments" }
      ]
    },
    {
      label: "Communications & CMS",
      items: [
        { label: "Inquiries & Leads", path: "/inquiries", icon: <MessageSquare size={18} />, badge: stats.newInquiriesCount || null, permission: "inquiries" },
        { label: "Website Content", path: "/content", icon: <Globe size={18} />, permission: "content" },
        { label: "Notifications", path: "/notifications", icon: <Bell size={18} />, badge: stats.unreadNotificationsCount || null, permission: "all" }
      ]
    },
    {
      label: "System & Governance",
      items: [
        { label: "Admin Users", path: "/users", icon: <Shield size={18} />, permission: "users" },
        { label: "Clinic Settings", path: "/settings", icon: <Settings size={18} />, permission: "settings" }
      ]
    }
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(11, 37, 69, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 190
          }}
        />
      )}

      <aside
        className={`admin-sidebar ${isCollapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
      >
        {/* Brand Header */}
        <div className="admin-sidebar-header">
          <Link
            to="/dashboard"
            className="admin-brand-link"
            onClick={() => setMobileOpen(false)}
            title="BeautyOasisRx — Clinical Aesthetics & Bespoke Wellness"
          >
            {!isCollapsed ? (
              <div className="admin-brand-card">
                <img
                  src={brandLogo}
                  alt="BeautyOasisRx — Clinical Aesthetics"
                  className="admin-brand-logo-full"
                />
              </div>
            ) : (
              <div className="admin-brand-icon-box" title="BeautyOasisRx">
                <img
                  src={brandLogo}
                  alt="BeautyOasisRx"
                  className="admin-brand-icon-img"
                />
              </div>
            )}
          </Link>

          {/* Mobile Close Button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="admin-sidebar-mobile-close"
            title="Close drawer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation List */}
        <div className="admin-sidebar-nav">
          {navSections.map((section, sIdx) => {
            const visibleItems = section.items.filter(item => hasPermission(item.permission));
            if (visibleItems.length === 0) return null;

            return (
              <div key={sIdx} style={{ marginBottom: '8px' }}>
                {!isCollapsed && (
                  <div className="admin-nav-group-label">
                    {section.label}
                  </div>
                )}
                {visibleItems.map((item, iIdx) => (
                  <NavLink
                    key={iIdx}
                    to={item.path}
                    className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => setMobileOpen(false)}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <span>{item.icon}</span>
                    {!isCollapsed && <span>{item.label}</span>}
                    {!isCollapsed && item.badge && (
                      <span className="admin-nav-badge">{item.badge}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            );
          })}

        </div>

        {/* User Card & Logout Footer */}
        <div className="admin-sidebar-footer">
          <div className="admin-user-card">
            <Link
              to="/profile"
              onClick={() => setMobileOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0, textDecoration: 'none' }}
            >
              {userPhoto ? (
                <img
                  src={userPhoto}
                  alt={userName}
                  className="admin-user-avatar"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) {
                      e.currentTarget.nextElementSibling.style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              <div
                className="admin-user-avatar-initials"
                style={{
                  display: userPhoto ? 'none' : 'flex',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1e5aa8 0%, #16a34a 100%)',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  border: '1.5px solid #22c55e',
                }}
              >
                {userInitial}
              </div>

              {!isCollapsed && (
                <div className="admin-user-info">
                  <div className="admin-user-name" title={userName}>{userName}</div>
                  <div className="admin-user-role">{userRole}</div>
                </div>
              )}
            </Link>

            {!isCollapsed && (
              <button
                type="button"
                onClick={handleLogoutClick}
                title="Log out"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'color 0.15s ease, background 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {!onRequestLogout && (
        <AdminLogoutDialog
          isOpen={localLogoutOpen}
          onClose={() => setLocalLogoutOpen(false)}
          onConfirm={handleLocalConfirmLogout}
          loading={localLogoutLoading}
        />
      )}
    </>
  );
};
