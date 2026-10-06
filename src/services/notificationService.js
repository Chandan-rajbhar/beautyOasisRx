/**
 * notificationService.js
 * 
 * Supabase service for dynamic notifications, categories, read/unread workflow,
 * real-time subscriptions, deduplication, and dynamic route navigation.
 */

import { supabase } from '../lib/supabaseClient';
import { supabaseAdmin } from '../lib/supabaseAdmin';

// No static dummy data - strictly dynamic from Supabase
export const DEFAULT_NOTIFICATIONS = [];

export function isStaticNotification(n) {
  if (!n) return true;
  const id = String(n.id || '').toLowerCase();
  const title = String(n.title || '').trim().toLowerCase();
  const msg = String(n.message || '').trim().toLowerCase();

  // Known demo/static IDs
  if (['notif-1', 'notif-2', 'notif-3', 'notif-4', 'notif-5'].includes(id)) return true;
  if (id.startsWith('demo-') || id.startsWith('static-')) return true;

  // Known demo text / persona names from demo seeds
  if (
    msg.includes('camille dupont') ||
    msg.includes('lady charlotte montagu') ||
    msg.includes('genevieve st. claire') ||
    msg.includes('genevieve vance') ||
    msg.includes('sarah jenkins') ||
    msg.includes('ord-9402') ||
    msg.includes('inclusive sensory suite')
  ) {
    return true;
  }

  // Hardcoded appointment reminder without actual database reference_id
  if (title.includes('appointment reminder') && !n.reference_id && !n.referenceId) {
    return true;
  }

  return false;
}

/**
 * Format timestamp into relative human-readable string
 */
export function formatTimestamp(dateStr) {
  if (!dateStr) return 'Just now';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin === 1) return '1 min ago';
    if (diffMin < 60) return `${diffMin} mins ago`;
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  } catch (_) {
    return dateStr;
  }
}

function resolveDynamicPaymentNotification(title, message, refId) {
  let cleanTitle = String(title || 'Payment Confirmed').trim();
  let cleanMessage = String(message || '').trim();

  // If title or message has $0.00 or $0, try to resolve from cached payments/orders
  const hasZeroAmount = /\$0(\.00)?(\b|\))/.test(cleanTitle) || /\$0(\.00)?(\b|\.)/.test(cleanMessage);
  if (!hasZeroAmount || !refId) {
    return { title: cleanTitle, message: cleanMessage };
  }

  try {
    const rawPayments = typeof localStorage !== 'undefined' ? localStorage.getItem('bo_cache_payments') : null;
    const payments = rawPayments ? JSON.parse(rawPayments) : [];
    if (Array.isArray(payments)) {
      const p = payments.find(item => item && String(item.id).toLowerCase() === String(refId).toLowerCase());
      if (p) {
        const amt = Number(p.total_amount || p.amount || p.raw_subtotal || 0);
        if (amt > 0) {
          const curr = String(p.currency || 'USD').toUpperCase();
          const symbol = curr === 'GBP' ? '£' : curr === 'EUR' ? '€' : curr === 'INR' ? '₹' : '$';
          const formatted = `${symbol}${amt.toFixed(2)}`;
          const name = p.customer_name || p.client_name || p.clientName || 'Client';

          cleanTitle = `Payment Confirmed (${formatted})`;
          cleanMessage = `Payment of ${formatted} confirmed for ${name}.`;
        }
      }
    }
  } catch (_) {}

  return { title: cleanTitle, message: cleanMessage };
}

/**
 * Normalize raw Supabase row into standard notification object
 */
export function normalizeNotification(row) {
  if (!row) return null;
  const isRead = Boolean(row.is_read ?? row.read ?? false);
  const rawType = String(row.type || row.category || 'appointment').toLowerCase();
  const rawCategory = String(row.category || row.type || 'appointment').toLowerCase();
  const refId = row.reference_id || row.referenceId || null;

  let title = row.title || 'Notification';
  let message = row.message || '';

  if (rawType === 'payment' || rawCategory === 'payment') {
    const dynamic = resolveDynamicPaymentNotification(title, message, refId);
    title = dynamic.title;
    message = dynamic.message;
  }

  return {
    id: row.id,
    title,
    message,
    type: rawType,
    category: rawCategory,
    reference_id: refId,
    patient_id: row.patient_id || row.patientId || null,
    user_id: row.user_id || row.userId || null,
    is_read: isRead,
    read: isRead,
    created_at: row.created_at || new Date().toISOString(),
    timestamp: row.timestamp || (row.created_at ? formatTimestamp(row.created_at) : 'Just now'),
    link: row.link || null
  };
}

/**
 * Deduplicate notification list by unique ID and unique composite event key (type + reference_id).
 * Preserves the most recent notification when duplicates exist.
 */
export function deduplicateNotifications(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenRefKeys = new Set();
  const seenContentKeys = new Set();
  const result = [];

  for (const item of list) {
    if (!item) continue;
    const id = item.id ? String(item.id) : null;
    const type = String(item.type || item.category || '').toLowerCase().trim();
    const refId = item.reference_id || item.referenceId || (type === 'patient' || type === 'client' ? (item.patient_id || item.patientId) : null);
    const cleanRefId = refId ? String(refId).trim().toLowerCase() : null;
    const compositeKey = cleanRefId ? `${type}__${cleanRefId}` : null;
    const contentKey = !cleanRefId && item.title && item.message ? `${type}__${String(item.title).trim()}__${String(item.message).trim()}` : null;

    if (id && seenIds.has(id)) {
      continue;
    }
    if (compositeKey && seenRefKeys.has(compositeKey)) {
      continue;
    }
    if (contentKey && seenContentKeys.has(contentKey)) {
      continue;
    }

    if (id) seenIds.add(id);
    if (compositeKey) seenRefKeys.add(compositeKey);
    if (contentKey) seenContentKeys.add(contentKey);
    result.push(item);
  }

  return result;
}

/**
 * Dynamic route generator based on notification type and reference_id
 */
export function getNotificationRoute(notif) {
  if (!notif) return { path: '/notifications' };

  const type = (notif.type || notif.category || '').toLowerCase();
  const refId = notif.reference_id || notif.referenceId;
  const patId = notif.patient_id || notif.patientId || refId;

  // New patient registration directly navigates to that patient's profile
  if (type === 'patient' || type === 'client') {
    return {
      path: patId ? `/clients/${encodeURIComponent(patId)}` : '/clients',
      state: { patientId: patId }
    };
  }

  if (notif.link) {
    return { path: notif.link };
  }

  switch (type) {
    case 'appointment':
      return {
        path: '/appointments',
        state: { selectedAppointmentId: refId, highlightId: refId },
        search: refId ? `?id=${encodeURIComponent(refId)}` : ''
      };
    case 'order':
      return {
        path: refId ? `/orders/${encodeURIComponent(refId)}` : '/orders',
        state: { selectedOrderId: refId }
      };
    case 'payment':
      return {
        path: '/payments',
        state: { selectedPaymentId: refId, highlightId: refId },
        search: refId ? `?id=${encodeURIComponent(refId)}` : ''
      };
    case 'inquiry':
    case 'ticket':
      return {
        path: '/inquiries',
        state: { selectedInquiryId: refId, highlightId: refId },
        search: refId ? `?ticket=${encodeURIComponent(refId)}` : ''
      };
    default:
      return { path: '/notifications' };
  }
}

export const notificationService = {
  /**
   * Fetch all notifications from Supabase with deduplication
   */
  async fetchNotifications() {
    try {
      let rows = null;
      let error = null;

      try {
        const res = await supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false });

        if (!res.error && Array.isArray(res.data)) {
          rows = res.data;
        } else {
          error = res.error;
        }
      } catch (clientErr) {
        error = clientErr;
      }

      // Fallback via supabaseAdmin if RLS policy blocked anon/service
      if (!rows && supabaseAdmin) {
        try {
          const adminRes = await supabaseAdmin
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false });

          if (!adminRes.error && Array.isArray(adminRes.data)) {
            rows = adminRes.data;
          }
        } catch (_) {}
      }

      if (rows && rows.length > 0) {
        const normalized = rows.map(normalizeNotification).filter(n => !isStaticNotification(n));
        const deduplicated = deduplicateNotifications(normalized);
        try {
          localStorage.setItem('bo_cache_notifications', JSON.stringify(deduplicated));
        } catch (_) {}
        return deduplicated;
      }

      // If table exists but empty, return empty array
      if (rows && rows.length === 0) {
        try {
          localStorage.setItem('bo_cache_notifications', JSON.stringify([]));
        } catch (_) {}
        return [];
      }

      if (error) {
        console.warn('[NotificationService] Supabase notifications notice:', error.message || error);
        try {
          const cached = localStorage.getItem('bo_cache_notifications');
          if (cached) {
            const parsed = JSON.parse(cached);
            const realOnly = (Array.isArray(parsed) ? parsed : []).filter(n => !isStaticNotification(n));
            return deduplicateNotifications(realOnly.map(normalizeNotification));
          }
        } catch (_) {}
        return [];
      }

      return [];
    } catch (err) {
      console.error('[NotificationService] Fetch error:', err);
      return [];
    }
  },

  /**
   * Mark a single notification as read in Supabase
   */
  async markAsRead(id) {
    if (!id) return;
    try {
      // Update in Supabase
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error && supabaseAdmin) {
        await supabaseAdmin
          .from('notifications')
          .update({ is_read: true, updated_at: new Date().toISOString() })
          .eq('id', id);
      }
    } catch (err) {
      console.warn('[NotificationService] Mark read error:', err);
    }

    // Always update local cache immediately for instant UI response
    try {
      const cached = localStorage.getItem('bo_cache_notifications');
      if (cached) {
        const list = JSON.parse(cached);
        const updated = list.map(n => (n.id === id ? { ...n, is_read: true, read: true } : n));
        localStorage.setItem('bo_cache_notifications', JSON.stringify(deduplicateNotifications(updated)));
      }
    } catch (_) {}
  },

  /**
   * Mark all unread notifications as read in Supabase
   */
  async markAllAsRead() {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .neq('is_read', true);

      if (error && supabaseAdmin) {
        await supabaseAdmin
          .from('notifications')
          .update({ is_read: true, updated_at: new Date().toISOString() })
          .neq('is_read', true);
      }
    } catch (err) {
      console.warn('[NotificationService] Mark all read error:', err);
    }

    // Always update local cache immediately
    try {
      const cached = localStorage.getItem('bo_cache_notifications');
      if (cached) {
        const list = JSON.parse(cached);
        const updated = list.map(n => ({ ...n, is_read: true, read: true }));
        localStorage.setItem('bo_cache_notifications', JSON.stringify(deduplicateNotifications(updated)));
      }
    } catch (_) {}
  },

  /**
   * Delete a notification from Supabase
   */
  async deleteNotification(id) {
    if (!id) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error && supabaseAdmin) {
        await supabaseAdmin
          .from('notifications')
          .delete()
          .eq('id', id);
      }
    } catch (err) {
      console.warn('[NotificationService] Delete notification error:', err);
    }

    try {
      const cached = localStorage.getItem('bo_cache_notifications');
      if (cached) {
        const list = JSON.parse(cached);
        const updated = list.filter(n => n.id !== id);
        localStorage.setItem('bo_cache_notifications', JSON.stringify(deduplicateNotifications(updated)));
      }
    } catch (_) {}
  },

  /**
   * Create a new notification in Supabase with deduplication protection
   */
  async createNotification(payload) {
    if (!payload || !payload.title) return null;

    const rawType = payload.type || payload.category || 'appointment';
    const rawCategory = payload.category || payload.type || 'appointment';
    const type = String(rawType).toLowerCase().trim();
    const category = String(rawCategory).toLowerCase().trim();
    const refId = payload.reference_id || payload.referenceId || (type === 'patient' ? (payload.patient_id || payload.patientId) : null);
    const patId = payload.patient_id || payload.patientId || (type === 'patient' ? refId : null);

    // 1. In-memory deduplication check against cached notifications
    try {
      const cached = localStorage.getItem('bo_cache_notifications');
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list)) {
          const match = list.find(n => {
            if (!n) return false;
            const nType = String(n.type || n.category || '').toLowerCase().trim();
            const nRef = n.reference_id || n.referenceId || (nType === 'patient' ? (n.patient_id || n.patientId) : null);
            return refId && nType === type && String(nRef).trim().toLowerCase() === String(refId).trim().toLowerCase();
          });
          if (match) {
            console.log(`[NotificationService] Notification already cached for ${type} ${refId}`);
            return normalizeNotification(match);
          }
        }
      }
    } catch (_) {}

    // 2. Database deduplication check in Supabase before insertion
    if (refId) {
      try {
        const { data: existingRows } = await supabase
          .from('notifications')
          .select('*')
          .eq('type', type)
          .eq('reference_id', String(refId))
          .limit(1);

        if (Array.isArray(existingRows) && existingRows.length > 0) {
          console.log(`[NotificationService] Notification for ${type} ${refId} already exists in DB, skipping duplicate.`);
          return normalizeNotification(existingRows[0]);
        }
      } catch (checkErr) {
        console.warn('[NotificationService] Dedup check warning:', checkErr?.message);
      }
    }

    const item = {
      title: payload.title,
      message: payload.message || '',
      type,
      category,
      reference_id: refId ? String(refId) : null,
      patient_id: patId ? String(patId) : null,
      is_read: Boolean(payload.is_read ?? false),
      user_id: payload.user_id || payload.userId || null,
      link: payload.link || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      let insertData = null;

      const res = await supabase
        .from('notifications')
        .insert([item])
        .select()
        .single();

      if (!res.error && res.data) {
        insertData = res.data;
      } else {
        // If unique constraint violation, fetch the existing record
        if (res.error && (res.error.code === '23505' || res.error.message?.includes('duplicate key') || res.error.message?.includes('uq_notifications'))) {
          const { data: existing } = await supabase
            .from('notifications')
            .select('*')
            .eq('type', type)
            .eq('reference_id', String(refId))
            .maybeSingle();
          if (existing) return normalizeNotification(existing);
        }

        // Retry via supabaseAdmin if RLS blocked anon
        if (supabaseAdmin) {
          const adminRes = await supabaseAdmin
            .from('notifications')
            .insert([item])
            .select()
            .single();
          if (!adminRes.error && adminRes.data) {
            insertData = adminRes.data;
          } else if (adminRes.error && (adminRes.error.code === '23505' || adminRes.error.message?.includes('duplicate key'))) {
            const { data: existing } = await supabaseAdmin
              .from('notifications')
              .select('*')
              .eq('type', type)
              .eq('reference_id', String(refId))
              .maybeSingle();
            if (existing) return normalizeNotification(existing);
          }
        }
      }

      if (insertData) {
        const normalized = normalizeNotification(insertData);
        try {
          const cached = localStorage.getItem('bo_cache_notifications');
          const list = cached ? JSON.parse(cached) : [];
          const updated = deduplicateNotifications([normalized, ...(Array.isArray(list) ? list : [])]);
          localStorage.setItem('bo_cache_notifications', JSON.stringify(updated));
        } catch (_) {}
        return normalized;
      }
    } catch (err) {
      console.warn('[NotificationService] Create notification error:', err);
    }

    return normalizeNotification({ ...item, id: `local-${Date.now()}` });
  }
};
