import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  Calendar,
  ShoppingBag,
  CreditCard,
  MessageSquare,
  ExternalLink,
  Trash2
} from 'lucide-react';
import { useAdminData } from '../../context/AdminDataContext';
import { AdminButton } from '../../components/admin/ui/AdminButton';
import { AdminBadge } from '../../components/admin/ui/AdminBadge';

export const NotificationsPage = () => {
  const { notifications, markNotificationAsRead, markAllNotificationsAsRead, deleteItem } = useAdminData();
  const [filterType, setFilterType] = useState('ALL');

  const filteredNotifications = notifications.filter((notif) => {
    if (filterType === 'UNREAD') return !notif.read;
    if (filterType === 'APPOINTMENTS') return notif.type === 'appointment';
    if (filterType === 'ORDERS') return notif.type === 'order';
    if (filterType === 'PAYMENTS') return notif.type === 'payment';
    if (filterType === 'INQUIRIES') return notif.type === 'inquiry';
    return true;
  });

  const getTypeIcon = (type) => {
    switch (type) {
      case 'appointment':
        return <Calendar size={18} color="#1e5aa8" />;
      case 'order':
        return <ShoppingBag size={18} color="#16a34a" />;
      case 'payment':
        return <CreditCard size={18} color="#0284c7" />;
      case 'inquiry':
        return <MessageSquare size={18} color="#eab308" />;
      default:
        return <Bell size={18} color="#1e5aa8" />;
    }
  };

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Clinic Notifications & Alerts</h1>
          <p>Real-time audit log of appointments, patient registrations, orders, and inquiries.</p>
        </div>

        <div className="admin-page-actions">
          <AdminButton
            variant="secondary"
            onClick={markAllNotificationsAsRead}
            icon={<CheckCheck size={16} />}
          >
            Mark All as Read
          </AdminButton>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { id: 'ALL', label: `All Updates (${notifications.length})` },
          { id: 'UNREAD', label: `Unread (${notifications.filter(n => !n.read).length})` },
          { id: 'APPOINTMENTS', label: 'Appointments' },
          { id: 'ORDERS', label: 'Orders' },
          { id: 'PAYMENTS', label: 'Payments' },
          { id: 'INQUIRIES', label: 'Inquiries' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterType(tab.id)}
            style={{
              padding: '9px 16px',
              fontSize: '0.84rem',
              fontWeight: filterType === tab.id ? 700 : 500,
              color: filterType === tab.id ? '#1e5aa8' : '#64748b',
              background: 'transparent',
              border: 'none',
              borderBottom: filterType === tab.id ? '2px solid #1e5aa8' : '2px solid transparent',
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => markNotificationAsRead(notif.id)}
              style={{
                background: notif.read ? '#ffffff' : '#f0fdf4',
                border: notif.read ? '1px solid #e2e8f0' : '1px solid #86efac',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  {getTypeIcon(notif.type)}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 700, color: '#0f2942', fontSize: '0.9rem' }}>
                      {notif.title}
                    </span>
                    {!notif.read && (
                      <span
                        style={{
                          background: '#15803d',
                          color: '#ffffff',
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '9999px',
                          textTransform: 'uppercase'
                        }}
                      >
                        New
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.84rem', color: '#475569' }}>
                    {notif.message}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  {notif.timestamp}
                </span>

                {notif.link && (
                  <Link
                    to={notif.link}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: '#1e5aa8',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    View <ExternalLink size={12} />
                  </Link>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteItem('notifications', notif.id);
                  }}
                  title="Dismiss notification"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            No notifications found in this category.
          </div>
        )}
      </div>
    </div>
  );
};
