import React, { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Check, ExternalLink, Calendar, ShoppingBag, CreditCard, MessageSquare } from 'lucide-react';
import { useAdminData } from '../../../context/AdminDataContext';

export const AdminNotificationDropdown = ({ isOpen, onClose }) => {
  const { notifications, markNotificationAsRead, markAllNotificationsAsRead } = useAdminData();
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getTypeIcon = (type) => {
    switch (type) {
      case 'appointment':
        return <Calendar size={16} color="#1e5aa8" />;
      case 'order':
        return <ShoppingBag size={16} color="#16a34a" />;
      case 'payment':
        return <CreditCard size={16} color="#0284c7" />;
      case 'inquiry':
        return <MessageSquare size={16} color="#eab308" />;
      default:
        return <Calendar size={16} color="#1e5aa8" />;
    }
  };

  return (
    <div
      ref={dropdownRef}
      style={{
        position: 'absolute',
        top: '60px',
        right: '20px',
        width: '360px',
        maxWidth: '90vw',
        background: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 12px 36px rgba(11, 37, 69, 0.15)',
        border: '1px solid #e2e8f0',
        zIndex: 500,
        overflow: 'hidden',
        animation: 'scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f8fafc'
        }}
      >
        <div>
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f2942' }}>
            Notifications
          </h4>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            {notifications.filter(n => !n.read).length} unread updates
          </span>
        </div>
        <button
          onClick={markAllNotificationsAsRead}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#1e5aa8',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <Check size={14} /> Mark all read
        </button>
      </div>

      <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
        {notifications.length > 0 ? (
          notifications.slice(0, 8).map((notif) => (
            <div
              key={notif.id}
              onClick={() => markNotificationAsRead(notif.id)}
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                gap: '12px',
                background: notif.read ? '#ffffff' : '#f0fdf4',
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
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
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f2942' }}>
                    {notif.title}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    {notif.timestamp}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569', lineHeight: 1.4 }}>
                  {notif.message}
                </p>
                {notif.link && (
                  <Link
                    to={notif.link}
                    onClick={onClose}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.72rem',
                      color: '#1e5aa8',
                      fontWeight: 600,
                      marginTop: '6px'
                    }}
                  >
                    View details <ExternalLink size={10} />
                  </Link>
                )}
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
            No notifications yet
          </div>
        )}
      </div>

      <div
        style={{
          padding: '12px',
          textAlign: 'center',
          borderTop: '1px solid #e2e8f0',
          background: '#f8fafc'
        }}
      >
        <Link
          to="/notifications"
          onClick={onClose}
          style={{ fontSize: '0.8rem', color: '#1e5aa8', fontWeight: 600, textDecoration: 'none' }}
        >
          View all notifications →
        </Link>
      </div>
    </div>
  );
};
