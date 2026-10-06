import React, { useRef, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ExternalLink, Calendar, ShoppingBag, CreditCard, MessageSquare, User, Bell } from 'lucide-react';
import { useAdminData } from '../../../context/AdminDataContext';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { getNotificationRoute, formatTimestamp, isStaticNotification, deduplicateNotifications } from '../../../services/notificationService';

export const AdminNotificationDropdown = ({ isOpen, onClose }) => {
  const { notifications = [], markNotificationAsRead, markAllNotificationsAsRead } = useAdminData();
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Dynamic notifications fetched from Supabase, filtered for dynamic data, deduplicated & sorted descending (newest first)
  const allNotifications = useMemo(() => {
    let list = [];
    if (Array.isArray(notifications)) {
      list = [...notifications];
    } else {
      try {
        const cached = localStorage.getItem('bo_cache_notifications');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) list = [...parsed];
        }
      } catch (_) {}
    }
    const realList = deduplicateNotifications(list.filter(n => !isStaticNotification(n)));
    realList.sort((a, b) => {
      const timeA = new Date(a.created_at || a.createdAt || a.timestamp || a.date || 0).getTime();
      const timeB = new Date(b.created_at || b.createdAt || b.timestamp || b.date || 0).getTime();
      return timeB - timeA;
    });
    return realList;
  }, [notifications]);

  const totalCount = allNotifications.length;

  // Show strictly the 3 most recent notifications in the dropdown
  // If fewer than 3, shows all available. If more than 3, shows only the 3 newest.
  const recentNotifications = useMemo(() => {
    return allNotifications.slice(0, 3);
  }, [allNotifications]);

  // Refresh notifications whenever dropdown opens so the latest notifications are always displayed
  useEffect(() => {
    if (isOpen) {
      supabaseDataService.fetchAll('notifications', { forceFresh: true });
    }
  }, [isOpen]);

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
    const t = String(type || '').toLowerCase();
    switch (t) {
      case 'appointment':
        return <Calendar size={15} color="#1e5aa8" />;
      case 'order':
        return <ShoppingBag size={15} color="#16a34a" />;
      case 'payment':
        return <CreditCard size={15} color="#0284c7" />;
      case 'inquiry':
      case 'ticket':
        return <MessageSquare size={15} color="#eab308" />;
      case 'patient':
      case 'client':
        return <User size={15} color="#7c3aed" />;
      default:
        return <Bell size={15} color="#1e5aa8" />;
    }
  };

  const handleNotificationClick = (notif, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!notif.is_read && !notif.read) {
      markNotificationAsRead(notif.id);
    }
    onClose();
    const route = getNotificationRoute(notif);
    if (route && route.path) {
      navigate(route.path, { state: route.state });
    }
  };

  const handleMarkAllRead = (e) => {
    if (e) e.stopPropagation();
    markAllNotificationsAsRead();
  };

  return (
    <div
      ref={dropdownRef}
      className="admin-notification-dropdown"
    >
      <div className="admin-notification-dropdown-header">
        <div>
          <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#0f2942' }}>
            Notifications
          </h4>
          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
            {`${totalCount} update${totalCount === 1 ? '' : 's'}`}
          </span>
        </div>
        <button
          onClick={handleMarkAllRead}
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

      <div className="admin-notification-dropdown-body">
        {recentNotifications.length > 0 ? (
          recentNotifications.map((notif) => {
            const isRead = Boolean(notif.is_read || notif.read);
            const dateVal = notif.created_at || notif.createdAt;
            const timeText = dateVal ? formatTimestamp(dateVal) : (notif.timestamp || 'Just now');

            return (
              <div
                key={notif.id}
                onClick={(e) => handleNotificationClick(notif, e)}
                className="admin-notification-dropdown-item"
                style={{
                  background: isRead ? '#ffffff' : '#f0fdf4'
                }}
              >
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  {getTypeIcon(notif.type || notif.category)}
                </div>
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '0.81rem', fontWeight: 600, color: '#0f2942', wordBreak: 'break-word', lineHeight: 1.25 }}>
                      {notif.title}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {timeText}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#475569', lineHeight: 1.35, wordBreak: 'break-word' }}>
                    {notif.message}
                  </p>
                  <span
                    onClick={(e) => handleNotificationClick(notif, e)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.71rem',
                      color: '#1e5aa8',
                      fontWeight: 600,
                      marginTop: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    View details <ExternalLink size={10} />
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
            No notifications yet
          </div>
        )}
      </div>

      <div className="admin-notification-dropdown-footer">
        <Link
          to="/notifications"
          onClick={onClose}
          style={{ fontSize: '0.78rem', color: '#1e5aa8', fontWeight: 600, textDecoration: 'none' }}
        >
          View all notifications →
        </Link>
      </div>
    </div>
  );
};
