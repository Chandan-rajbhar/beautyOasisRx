import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Calendar,
  ShoppingBag,
  CreditCard,
  MessageSquare,
  ExternalLink,
  Trash2,
  User,
  Send,
  Smartphone
} from 'lucide-react';
import { useAdminData } from '../../context/AdminDataContext';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { AdminButton } from '../../components/admin/ui/AdminButton';
import { SendNotificationModal } from '../../components/admin/ui/SendNotificationModal';
import { supabase } from '../../lib/supabaseClient';
import { supabaseDataService } from '../../services/supabaseDataService';
import toast from 'react-hot-toast';
import {
  notificationService,
  resolveNotificationRoute,
  getNotificationRoute,
  formatTimestamp,
  normalizeNotification,
  isStaticNotification,
  deduplicateNotifications
} from '../../services/notificationService';

export const NotificationsPage = () => {
  const {
    notifications = [],
    clients = [],
    appointments = [],
    orders = [],
    payments = [],
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteItem,
    isLoading: contextLoading
  } = useAdminData();
  const { user: currentUser } = useAdminAuth();

  const navigate = useNavigate();
  const [filterType, setFilterType] = useState('ALL');
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [localNotifications, setLocalNotifications] = useState(() => {
    let list = [];
    if (Array.isArray(notifications)) list = notifications;
    else {
      try {
        const cached = localStorage.getItem('bo_cache_notifications');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) list = parsed;
        }
      } catch (_) {}
    }
    return deduplicateNotifications(list.filter(n => !isStaticNotification(n)));
  });

  // Keep local list in sync with context
  useEffect(() => {
    if (Array.isArray(notifications)) {
      setLocalNotifications(deduplicateNotifications(notifications.filter(n => !isStaticNotification(n))));
    }
  }, [notifications]);

  // Initial fetch from Supabase and synchronize across entire admin layout
  useEffect(() => {
    let isMounted = true;
    async function loadNotifications() {
      try {
        const data = await notificationService.fetchNotifications();
        if (isMounted && Array.isArray(data)) {
          setLocalNotifications(deduplicateNotifications(data));
          supabaseDataService.fetchAll('notifications', { forceFresh: true });
        }
      } catch (err) {
        console.warn('Initial notifications fetch warning:', err);
      }
    }
    loadNotifications();
    return () => {
      isMounted = false;
    };
  }, []);

  // Real-time Supabase postgres subscription for live notification updates
  useEffect(() => {
    const channelName = `notif_feed_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        async () => {
          try {
            const fresh = await supabaseDataService.fetchAll('notifications', { forceFresh: true });
            if (Array.isArray(fresh)) {
              setLocalNotifications(deduplicateNotifications(fresh));
            }
          } catch (_) {
            const fallback = await notificationService.fetchNotifications();
            if (Array.isArray(fallback)) {
              setLocalNotifications(deduplicateNotifications(fallback));
            }
          }
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (_) {}
    };
  }, []);

  // Filter notifications by active tab category
  const filteredNotifications = useMemo(() => {
    return localNotifications.filter((notif) => {
      const type = (notif.type || notif.category || '').toLowerCase();
      const category = (notif.category || notif.type || '').toLowerCase();
      const isUnread = !notif.is_read && !notif.read;

      if (filterType === 'UNREAD') return isUnread;
      if (filterType === 'SENT_PUSHES') {
        return Boolean(notif.delivery_status || notif.recipient_user_id || notif.idempotency_key || notif.data_payload?.source === 'dashboard_manual_dispatch');
      }
      if (filterType === 'APPOINTMENTS') return category === 'appointment' || type === 'appointment';
      if (filterType === 'ORDERS') return category === 'order' || type === 'order';
      if (filterType === 'PAYMENTS') return category === 'payment' || type === 'payment';
      if (filterType === 'INQUIRIES') return category === 'inquiry' || type === 'inquiry' || category === 'ticket' || type === 'ticket';
      return true;
    });
  }, [localNotifications, filterType]);

  const unreadCount = useMemo(() => {
    return localNotifications.filter((n) => !n.is_read && !n.read).length;
  }, [localNotifications]);

  // Handle Mark Single Notification Read & Dynamic Navigation
  const handleNotificationClick = async (notif) => {
    const isUnread = !notif.is_read && !notif.read;
    if (isUnread) {
      setLocalNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true, read: true } : n))
      );
      try {
        await markNotificationAsRead(notif.id);
      } catch (_) {
        await notificationService.markAsRead(notif.id);
      }
    }

    try {
      const route = await resolveNotificationRoute(notif, {
        clients,
        appointments,
        orders,
        payments,
        currentAdminId: currentUser?.id
      });

      if (route && route.path) {
        navigate(route.path, { state: route.state });
      } else {
        toast.error(route?.error || 'Unable to locate the patient profile for this notification.');
      }
    } catch (err) {
      console.error('[NotificationsPage] Patient navigation error:', err);
      toast.error('Unable to navigate to patient profile.');
    }
  };

  // Handle Mark All as Read
  const handleMarkAllAsRead = async () => {
    setLocalNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true, read: true }))
    );
    try {
      await markAllNotificationsAsRead();
    } catch (_) {
      await notificationService.markAllAsRead();
    }
  };

  // Handle Dismiss / Delete Notification
  const handleDeleteNotification = async (notifId, e) => {
    e.stopPropagation();
    setLocalNotifications((prev) => prev.filter((n) => n.id !== notifId));
    try {
      await deleteItem('notifications', notifId);
    } catch (_) {
      await notificationService.deleteNotification(notifId);
    }
  };

  const getTypeIcon = (type) => {
    const t = String(type || '').toLowerCase();
    switch (t) {
      case 'appointment':
        return <Calendar size={18} color="#1e5aa8" />;
      case 'order':
        return <ShoppingBag size={18} color="#16a34a" />;
      case 'payment':
        return <CreditCard size={18} color="#0284c7" />;
      case 'inquiry':
      case 'ticket':
        return <MessageSquare size={18} color="#eab308" />;
      case 'patient':
      case 'client':
        return <User size={18} color="#7c3aed" />;
      default:
        return <Bell size={18} color="#1e5aa8" />;
    }
  };

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Clinic Notifications & Alerts</h1>
          <p>Real-time push delivery audit log for appointments, registrations, orders, and FCM broadcasts.</p>
        </div>

        <div className="admin-page-actions" style={{ display: 'flex', gap: '10px' }}>
          <AdminButton
            variant="secondary"
            onClick={handleMarkAllAsRead}
            icon={<CheckCheck size={16} />}
          >
            Mark All as Read
          </AdminButton>

          <AdminButton
            variant="primary"
            onClick={() => setIsSendModalOpen(true)}
            icon={<Send size={16} />}
          >
            Send Push Notification
          </AdminButton>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { id: 'ALL', label: `All Updates (${localNotifications.length})` },
          { id: 'UNREAD', label: `Unread (${unreadCount})` },
          { id: 'SENT_PUSHES', label: 'Push Broadcasts' },
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
          filteredNotifications.map((notif) => {
            const isRead = Boolean(notif.is_read || notif.read);
            const timeText = notif.timestamp || (notif.created_at ? formatTimestamp(notif.created_at) : 'Just now');
            const deliveryStatus = notif.delivery_status;

            return (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                style={{
                  background: isRead ? '#ffffff' : '#f0fdf4',
                  border: isRead ? '1px solid #e2e8f0' : '1px solid #86efac',
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
                    {getTypeIcon(notif.type || notif.category)}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, color: '#0f2942', fontSize: '0.9rem' }}>
                        {notif.title}
                      </span>

                      {!isRead && (
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

                      {deliveryStatus && (
                        <span
                          style={{
                            background:
                              deliveryStatus === 'sent'
                                ? '#dcfce7'
                                : deliveryStatus === 'no_devices'
                                ? '#fef3c7'
                                : deliveryStatus === 'partial'
                                ? '#fef9c3'
                                : deliveryStatus === 'failed'
                                ? '#fee2e2'
                                : '#f1f5f9',
                            color:
                              deliveryStatus === 'sent'
                                ? '#166534'
                                : deliveryStatus === 'no_devices'
                                ? '#92400e'
                                : deliveryStatus === 'partial'
                                ? '#854d0e'
                                : deliveryStatus === 'failed'
                                ? '#991b1b'
                                : '#475569',
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '9999px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            textTransform: 'uppercase'
                          }}
                          title={deliveryStatus === 'no_devices' ? 'Saved in Supabase (Recipient has 0 devices)' : `FCM Status: ${deliveryStatus}`}
                        >
                          <Smartphone size={10} />
                          {deliveryStatus === 'sent'
                            ? 'FCM Sent'
                            : deliveryStatus === 'no_devices'
                            ? 'No Devices'
                            : deliveryStatus}
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
                    {timeText}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNotificationClick(notif);
                    }}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: '#1e5aa8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    View <ExternalLink size={12} />
                  </button>

                  <button
                    onClick={(e) => handleDeleteNotification(notif.id, e)}
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
            );
          })
        ) : (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            No notifications found in this category.
          </div>
        )}
      </div>

      {/* Broadcast Push Notification Modal */}
      <SendNotificationModal
        isOpen={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
        onNotificationSent={(newNotif) => {
          if (newNotif?.notification) {
            setLocalNotifications((prev) =>
              deduplicateNotifications([normalizeNotification(newNotif.notification), ...prev])
            );
          }
          supabaseDataService.fetchAll('notifications', { forceFresh: true });
        }}
      />
    </div>
  );
};

export default NotificationsPage;
