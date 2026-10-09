import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Send,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Users,
  User,
  Shield,
  Bell,
  Calendar,
  ShoppingBag,
  CreditCard,
  MessageSquare,
  Sparkles,
  ExternalLink,
  Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import { notificationService } from '../../../services/notificationService';
import { supabase } from '../../../lib/supabaseClient';

export const SendNotificationModal = ({ isOpen, onClose, onNotificationSent }) => {
  const [recipientType, setRecipientType] = useState('specific_user'); // 'specific_user', 'role', 'all_users'
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('patient');
  const [category, setCategory] = useState('general');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [relatedEntityId, setRelatedEntityId] = useState('');
  const [deepLink, setDeepLink] = useState('');
  const [priority, setPriority] = useState('high');

  const [patients, setPatients] = useState([]);
  const [users, setUsers] = useState([]);
  const [registeredDevices, setRegisteredDevices] = useState([]);
  const [deviceStats, setDeviceStats] = useState({ total: 0, activeCount: 0, androidCount: 0, iosCount: 0 });

  const [isLoading, setIsLoading] = useState(false);
  const [deliveryResult, setDeliveryResult] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch recipients & device registration status
  useEffect(() => {
    if (!isOpen) {
      setDeliveryResult(null);
      return;
    }

    async function loadData() {
      try {
        const [patRes, userRes, devices] = await Promise.all([
          supabase.from('patients').select('id, name, full_name, email, phone').order('name'),
          supabase.from('users').select('id, name, email, role').order('name'),
          notificationService.fetchPushDevices()
        ]);

        if (Array.isArray(patRes.data)) setPatients(patRes.data);
        if (Array.isArray(userRes.data)) setUsers(userRes.data);
        if (Array.isArray(devices)) {
          setRegisteredDevices(devices);
          const active = devices.filter(d => d.is_active);
          setDeviceStats({
            total: devices.length,
            activeCount: active.length,
            androidCount: active.filter(d => d.platform === 'android').length,
            iosCount: active.filter(d => d.platform === 'ios').length
          });
        }
      } catch (err) {
        console.warn('Failed loading recipient data:', err);
      }
    }

    loadData();
  }, [isOpen]);

  // Combined recipient list with device token indicator
  const combinedRecipients = useMemo(() => {
    const list = [];
    const activeUserDeviceIds = new Set(
      registeredDevices.filter(d => d.is_active).map(d => String(d.user_id))
    );

    // Patients
    patients.forEach(p => {
      const name = p.name || p.full_name || 'Patient';
      list.push({
        id: p.id,
        name,
        email: p.email || 'No email',
        type: 'Patient',
        hasDevice: activeUserDeviceIds.has(String(p.id))
      });
    });

    // Staff/Users
    users.forEach(u => {
      list.push({
        id: u.id,
        name: u.name || 'Admin',
        email: u.email || '',
        type: u.role === 'super_admin' ? 'Super Admin' : 'Staff',
        hasDevice: activeUserDeviceIds.has(String(u.id))
      });
    });

    return list;
  }, [patients, users, registeredDevices]);

  // Filtered recipients by search
  const filteredRecipients = useMemo(() => {
    if (!searchQuery.trim()) return combinedRecipients;
    const q = searchQuery.toLowerCase();
    return combinedRecipients.filter(
      r => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.type.toLowerCase().includes(q)
    );
  }, [combinedRecipients, searchQuery]);

  // Selected recipient device count
  const recipientDeviceCount = useMemo(() => {
    if (recipientType === 'all_users') {
      return deviceStats.activeCount;
    }
    if (recipientType === 'role') {
      if (selectedRole === 'patient') {
        const patientIdSet = new Set(patients.map(p => String(p.id)));
        return registeredDevices.filter(d => d.is_active && patientIdSet.has(String(d.user_id))).length;
      } else {
        const adminIdSet = new Set(users.filter(u => u.role === selectedRole).map(u => String(u.id)));
        return registeredDevices.filter(d => d.is_active && adminIdSet.has(String(d.user_id))).length;
      }
    }
    if (recipientType === 'specific_user' && selectedUserId) {
      return registeredDevices.filter(d => d.is_active && String(d.user_id) === String(selectedUserId)).length;
    }
    return 0;
  }, [recipientType, selectedUserId, selectedRole, registeredDevices, deviceStats, patients, users]);

  const handleSend = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('Please enter a notification title');
      return;
    }
    if (!message.trim()) {
      toast.error('Please enter a notification message body');
      return;
    }
    if (recipientType === 'specific_user' && !selectedUserId) {
      toast.error('Please select a recipient user');
      return;
    }

    setIsLoading(true);
    setDeliveryResult(null);

    const idempotencyKey = `dash_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const payload = {
        title: title.trim(),
        message: message.trim(),
        body: message.trim(),
        notification_type: category,
        category,
        recipient_type: recipientType,
        recipient_user_id: recipientType === 'specific_user' ? selectedUserId : null,
        recipient_role: recipientType === 'role' ? selectedRole : null,
        related_entity_id: relatedEntityId.trim() || null,
        deep_link: deepLink.trim() || null,
        action_url: deepLink.trim() || null,
        priority,
        idempotency_key: idempotencyKey,
        data: {
          category,
          source: 'dashboard_manual_dispatch',
          sender: 'admin'
        }
      };

      const result = await notificationService.sendPushNotification(payload);

      if (result && (result.success || result.notification_id)) {
        setDeliveryResult(result);
        toast.success(
          result.delivery_status === 'no_devices'
            ? 'Notification saved in Supabase (Recipient has 0 registered devices)'
            : 'Push notification processed successfully!'
        );

        if (onNotificationSent) {
          onNotificationSent(result);
        }
      } else {
        setDeliveryResult({
          success: false,
          error: result?.error || 'Failed to dispatch push notification.'
        });
        toast.error(result?.error || 'Failed to dispatch push notification.');
      }
    } catch (err) {
      console.error('Push send error:', err);
      setDeliveryResult({
        success: false,
        error: err.message || 'Unexpected transmission error.'
      });
      toast.error('Failed to send push notification.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetForm = () => {
    setTitle('');
    setMessage('');
    setRelatedEntityId('');
    setDeepLink('');
    setDeliveryResult(null);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '780px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          animation: 'fadeSlideUp 0.2s ease-out'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #0f2942 0%, #1e5aa8 100%)',
            color: '#ffffff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Send size={20} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#ffffff' }}>
                Broadcast Push Notification
              </h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#cbd5e1' }}>
                Deliver real-time mobile push via Firebase Cloud Messaging & Supabase
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isLoading}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '6px',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Active Devices Overview Banner */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Smartphone size={18} color="#1e5aa8" />
              <span style={{ fontSize: '0.86rem', color: '#334155', fontWeight: 600 }}>
                Mobile Fleet Status:
              </span>
              <span style={{ fontSize: '0.86rem', color: '#0f2942', fontWeight: 700 }}>
                {deviceStats.activeCount} active devices registered
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <span
                style={{
                  fontSize: '0.74rem',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: '#e0f2fe',
                  color: '#0369a1',
                  fontWeight: 600
                }}
              >
                Android: {deviceStats.androidCount}
              </span>
              <span
                style={{
                  fontSize: '0.74rem',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: '#f1f5f9',
                  color: '#475569',
                  fontWeight: 600
                }}
              >
                iOS: {deviceStats.iosCount}
              </span>
            </div>
          </div>

          {/* Delivery Result Feedback Box */}
          {deliveryResult && (
            <div
              style={{
                borderRadius: '12px',
                padding: '16px',
                border: deliveryResult.success ? '1px solid #86efac' : '1px solid #fca5a5',
                background: deliveryResult.success ? '#f0fdf4' : '#fef2f2',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {deliveryResult.success ? (
                  <CheckCircle2 size={18} color="#16a34a" />
                ) : (
                  <AlertCircle size={18} color="#dc2626" />
                )}
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    color: deliveryResult.success ? '#15803d' : '#991b1b'
                  }}
                >
                  {deliveryResult.success ? 'Notification Dispatched & Saved' : 'Delivery Issue'}
                </span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    fontWeight: 700,
                    background: deliveryResult.delivery_status === 'sent' ? '#dcfce7' : deliveryResult.delivery_status === 'no_devices' ? '#fef3c7' : '#fee2e2',
                    color: deliveryResult.delivery_status === 'sent' ? '#166534' : deliveryResult.delivery_status === 'no_devices' ? '#92400e' : '#991b1b',
                    textTransform: 'uppercase'
                  }}
                >
                  Status: {deliveryResult.delivery_status || 'Processed'}
                </span>
              </div>

              <p style={{ margin: 0, fontSize: '0.84rem', color: '#334155' }}>
                {deliveryResult.message || (deliveryResult.success ? 'Notification record created in Supabase.' : deliveryResult.error)}
              </p>

              <div style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '4px' }}>
                {deliveryResult.notification_id && (
                  <span>Record ID: <code>{deliveryResult.notification_id}</code></span>
                )}
                <span>Active Tokens: <strong>{deliveryResult.tokens_count ?? 0}</strong></span>
                <span>FCM Dispatched: <strong>{deliveryResult.sent_count ?? 0}</strong></span>
                {deliveryResult.failed_count > 0 && (
                  <span style={{ color: '#dc2626' }}>Failed: <strong>{deliveryResult.failed_count}</strong></span>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Recipient Mode Tabs */}
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#0f2942', marginBottom: '8px' }}>
                Target Recipients
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {[
                  { id: 'specific_user', label: 'Specific User', icon: User },
                  { id: 'role', label: 'By User Role', icon: Shield },
                  { id: 'all_users', label: 'All App Users', icon: Users }
                ].map(tab => {
                  const Icon = tab.icon;
                  const isSelected = recipientType === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setRecipientType(tab.id)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: isSelected ? '2px solid #1e5aa8' : '1px solid #cbd5e1',
                        background: isSelected ? '#f0f7ff' : '#ffffff',
                        color: isSelected ? '#1e5aa8' : '#475569',
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: '0.84rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Icon size={16} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recipient Selector */}
            {recipientType === 'specific_user' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Select Patient or Staff Member
                </label>
                <div style={{ marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.84rem'
                    }}
                  />
                </div>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.86rem',
                    background: '#ffffff',
                    color: '#0f2942'
                  }}
                  required
                >
                  <option value="">-- Choose Recipient ({filteredRecipients.length} available) --</option>
                  {filteredRecipients.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.email}) — [{r.type}] {r.hasDevice ? '📱 Registered' : '⚠️ No Device'}
                    </option>
                  ))}
                </select>
                <div style={{ marginTop: '4px', fontSize: '0.75rem', color: recipientDeviceCount > 0 ? '#15803d' : '#b45309' }}>
                  {selectedUserId ? (
                    recipientDeviceCount > 0
                      ? `✓ ${recipientDeviceCount} active registered mobile device(s) found for this recipient.`
                      : '⚠️ Recipient has not logged into the mobile app yet. Push will be saved in Supabase.'
                  ) : null}
                </div>
              </div>
            )}

            {recipientType === 'role' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Select Authorized Role
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.86rem',
                    background: '#ffffff'
                  }}
                >
                  <option value="patient">All Patients / Clients ({patients.length} registered)</option>
                  <option value="super_admin">Super Admins Only ({users.length} registered)</option>
                </select>
                <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#64748b' }}>
                  Targeting ~{recipientDeviceCount} registered mobile devices in this role.
                </div>
              </div>
            )}

            {recipientType === 'all_users' && (
              <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', fontSize: '0.8rem', color: '#475569' }}>
                Broadcast will target all active registered devices across patients and clinic admins ({deviceStats.activeCount} total active devices).
              </div>
            )}

            {/* Notification Category */}
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#0f2942', marginBottom: '6px' }}>
                Notification Category
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {[
                  { id: 'appointment', label: 'Appointment', icon: Calendar },
                  { id: 'order', label: 'Order / Pharmacy', icon: ShoppingBag },
                  { id: 'payment', label: 'Payment', icon: CreditCard },
                  { id: 'inquiry', label: 'Inquiry / Support', icon: MessageSquare },
                  { id: 'clinical_alert', label: 'Clinical Alert', icon: Sparkles },
                  { id: 'general', label: 'General News', icon: Bell }
                ].map(cat => {
                  const Icon = cat.icon;
                  const isSel = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: isSel ? '2px solid #1e5aa8' : '1px solid #e2e8f0',
                        background: isSel ? '#f0f7ff' : '#f8fafc',
                        color: isSel ? '#1e5aa8' : '#475569',
                        fontSize: '0.8rem',
                        fontWeight: isSel ? 700 : 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Icon size={14} />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title & Message */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.84rem', fontWeight: 600, color: '#0f2942' }}>
                  Notification Title *
                </label>
                <span style={{ fontSize: '0.74rem', color: title.length > 50 ? '#dc2626' : '#94a3b8' }}>
                  {title.length}/65 chars
                </span>
              </div>
              <input
                type="text"
                placeholder="e.g. Appointment Confirmed: HydraFacial Treatment"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={65}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem'
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.84rem', fontWeight: 600, color: '#0f2942' }}>
                  Notification Message *
                </label>
                <span style={{ fontSize: '0.74rem', color: message.length > 150 ? '#dc2626' : '#94a3b8' }}>
                  {message.length}/200 chars
                </span>
              </div>
              <textarea
                placeholder="e.g. Your clinical session is scheduled for tomorrow at 10:00 AM. Please arrive 10 minutes early."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={200}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Optional Deep Link & Entity Reference */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Related Record ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Appointment or Order UUID"
                  value={relatedEntityId}
                  onChange={(e) => setRelatedEntityId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Mobile Deep Link (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. /appointments/view or /orders/9402"
                  value={deepLink}
                  onChange={(e) => setDeepLink(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem'
                  }}
                />
              </div>
            </div>

            {/* Live Mobile Push Preview Card */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
                Mobile Lockscreen Preview
              </label>
              <div
                style={{
                  background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
                  borderRadius: '14px',
                  padding: '14px 18px',
                  color: '#ffffff',
                  boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.1)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '4px',
                        background: '#38bdf8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '9px',
                        fontWeight: 900,
                        color: '#0f172a'
                      }}
                    >
                      B
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.5px' }}>
                      BEAUTYOASIS RX • NOW
                    </span>
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#64748b' }}>FCM High</span>
                </div>

                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#f8fafc', marginBottom: '2px' }}>
                  {title.trim() || 'Notification Title Preview'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.3' }}>
                  {message.trim() || 'Notification body text will appear right here as configured in this form...'}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '12px',
                borderTop: '1px solid #e2e8f0',
                marginTop: '6px'
              }}
            >
              <button
                type="button"
                onClick={handleResetForm}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Clear Form
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    padding: '9px 22px',
                    borderRadius: '8px',
                    border: 'none',
                    background: isLoading ? '#94a3b8' : 'linear-gradient(135deg, #1e5aa8 0%, #0f2942 100%)',
                    color: '#ffffff',
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 6px -1px rgba(30, 90, 168, 0.2)'
                  }}
                >
                  {isLoading ? (
                    <>
                      <div
                        style={{
                          width: '14px',
                          height: '14px',
                          border: '2px solid #ffffff',
                          borderTopColor: 'transparent',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite'
                        }}
                      />
                      Broadcasting...
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      Send Notification
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SendNotificationModal;
