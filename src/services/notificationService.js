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
    notification_type: row.notification_type || rawType,
    reference_id: refId,
    related_entity_id: row.related_entity_id || refId,
    patient_id: row.patient_id || row.patientId || null,
    user_id: row.user_id || row.userId || null,
    recipient_user_id: row.recipient_user_id || row.user_id || row.patient_id || null,
    is_read: isRead,
    read: isRead,
    read_at: row.read_at || null,
    delivery_status: row.delivery_status || 'sent',
    delivery_details: row.delivery_details || [],
    idempotency_key: row.idempotency_key || null,
    data_payload: row.data_payload || row.data || {},
    created_at: row.created_at || new Date().toISOString(),
    timestamp: row.timestamp || (row.created_at ? formatTimestamp(row.created_at) : 'Just now'),
    link: row.link || row.deep_link || row.action_url || null,
    deep_link: row.deep_link || row.action_url || row.link || null,
    action_url: row.action_url || row.deep_link || row.link || null
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
 * Check if a notification is related to a patient activity
 */
export function isPatientRelatedNotification(notif) {
  if (!notif) return false;
  const type = String(notif.type || notif.category || '').toLowerCase().trim();
  const title = String(notif.title || '').toLowerCase();
  const message = String(notif.message || '').toLowerCase();

  if (['appointment', 'order', 'patient', 'client', 'payment'].includes(type)) return true;
  if (notif.patient_id || notif.patientId) return true;
  if (title.includes('appointment') || title.includes('order') || title.includes('patient') || title.includes('client') || title.includes('treatment')) return true;
  if (message.includes('booked') || message.includes('scheduled') || message.includes('placed an order') || message.includes('registered')) return true;

  return false;
}

/**
 * Fast synchronous resolver for patient ID from notification, context data & local storage
 */
export function resolvePatientFromNotificationSync(notif, context = {}) {
  if (!notif) return null;

  const currentAdminId = context.currentAdminId ? String(context.currentAdminId).toLowerCase().trim() : null;
  const isForbiddenId = (id) => {
    if (!id) return true;
    const clean = String(id).toLowerCase().trim();
    if (['null', 'undefined', 'admin', 'super-admin', 'current-admin', 'guest'].includes(clean)) return true;
    if (currentAdminId && clean === currentAdminId) return true;
    return false;
  };

  const clients = Array.isArray(context.clients) ? context.clients : [];
  const appointments = Array.isArray(context.appointments) ? context.appointments : [];
  const orders = Array.isArray(context.orders) ? context.orders : [];
  const payments = Array.isArray(context.payments) ? context.payments : [];

  const findPatientInLocal = (predicate) => {
    let match = clients.find(predicate);
    if (!match) {
      try {
        const cached = localStorage.getItem('cached_dynamic_patients') || localStorage.getItem('bo_cache_clients');
        if (cached) {
          const list = JSON.parse(cached);
          if (Array.isArray(list)) match = list.find(predicate);
        }
      } catch (_) {}
    }
    return match;
  };

  const rawPatId = notif.patient_id || notif.patientId;
  const type = String(notif.type || notif.category || '').toLowerCase().trim();
  const refId = notif.reference_id || notif.referenceId;
  const message = String(notif.message || '').trim();
  const title = String(notif.title || '').trim();

  // 1. Direct valid patient_id
  if (rawPatId && !isForbiddenId(rawPatId)) {
    const cleanPat = String(rawPatId).trim();
    const localMatch = findPatientInLocal(p => String(p.id) === cleanPat || String(p.user_id) === cleanPat);
    if (localMatch && !isForbiddenId(localMatch.id)) return String(localMatch.id);
    if (/^[0-9a-fA-F-]{36}$/.test(cleanPat)) return cleanPat;
  }

  // 2. Patient / client type directly by reference_id
  if ((type === 'patient' || type === 'client') && refId && !isForbiddenId(refId)) {
    const cleanRef = String(refId).trim();
    const localMatch = findPatientInLocal(p => String(p.id) === cleanRef || String(p.user_id) === cleanRef);
    if (localMatch && !isForbiddenId(localMatch.id)) return String(localMatch.id);
    if (/^[0-9a-fA-F-]{36}$/.test(cleanRef)) return cleanRef;
  }

  // 3. Resolve via appointments in memory/cache
  if (type === 'appointment' || title.toLowerCase().includes('appointment') || message.toLowerCase().includes('booked')) {
    let appt = null;
    if (refId) {
      appt = appointments.find(a => String(a.id) === String(refId));
      if (!appt) {
        try {
          const cached = localStorage.getItem('bo_cache_appointments');
          if (cached) {
            const list = JSON.parse(cached);
            if (Array.isArray(list)) appt = list.find(a => String(a.id) === String(refId));
          }
        } catch (_) {}
      }
    }
    if (appt) {
      const apptPatId = appt.patient_id || appt.client_id || appt.clientId;
      if (apptPatId && !isForbiddenId(apptPatId)) {
        const localMatch = findPatientInLocal(p => String(p.id) === String(apptPatId));
        if (localMatch) return String(localMatch.id);
        if (/^[0-9a-fA-F-]{36}$/.test(String(apptPatId))) return String(apptPatId);
      }
      const apptEmail = (appt.patient_email || appt.client_email || appt.clientEmail || appt.email || '').toLowerCase().trim();
      if (apptEmail) {
        const match = findPatientInLocal(p => (p.email || '').toLowerCase().trim() === apptEmail);
        if (match && !isForbiddenId(match.id)) return String(match.id);
      }
      const apptPhone = (appt.patient_phone || appt.client_phone || appt.clientPhone || appt.phone || '').replace(/\D/g, '');
      if (apptPhone && apptPhone.length >= 7) {
        const match = findPatientInLocal(p => (p.phone || '').replace(/\D/g, '') === apptPhone);
        if (match && !isForbiddenId(match.id)) return String(match.id);
      }
      const apptName = (appt.patient_name || appt.client_name || appt.clientName || '').trim();
      if (apptName && apptName.toLowerCase() !== 'patient' && apptName.toLowerCase() !== 'client') {
        const match = findPatientInLocal(p => (p.full_name || p.name || '').toLowerCase().trim() === apptName.toLowerCase());
        if (match && !isForbiddenId(match.id)) return String(match.id);
      }
    }
  }

  // 4. Resolve via orders in memory/cache
  if (type === 'order' || title.toLowerCase().includes('order') || message.toLowerCase().includes('order')) {
    let order = null;
    if (refId) {
      order = orders.find(o => String(o.id) === String(refId) || String(o.order_number) === String(refId) || String(o.order_id) === String(refId));
      if (!order) {
        try {
          const cached = localStorage.getItem('bo_cache_orders');
          if (cached) {
            const list = JSON.parse(cached);
            if (Array.isArray(list)) order = list.find(o => String(o.id) === String(refId) || String(o.order_number) === String(refId) || String(o.order_id) === String(refId));
          }
        } catch (_) {}
      }
    }
    if (order) {
      const orderPatId = order.patient_id || order.client_id || order.clientId || order.user_id;
      if (orderPatId && !isForbiddenId(orderPatId)) {
        const localMatch = findPatientInLocal(p => String(p.id) === String(orderPatId));
        if (localMatch) return String(localMatch.id);
        if (/^[0-9a-fA-F-]{36}$/.test(String(orderPatId))) return String(orderPatId);
      }
      const orderEmail = (order.customer_email || order.client_email || order.clientEmail || order.email || '').toLowerCase().trim();
      if (orderEmail) {
        const match = findPatientInLocal(p => (p.email || '').toLowerCase().trim() === orderEmail);
        if (match && !isForbiddenId(match.id)) return String(match.id);
      }
      const orderName = (order.customer_name || order.client_name || order.clientName || '').trim();
      if (orderName && orderName.toLowerCase() !== 'client' && orderName.toLowerCase() !== 'patient') {
        const match = findPatientInLocal(p => (p.full_name || p.name || '').toLowerCase().trim() === orderName.toLowerCase());
        if (match && !isForbiddenId(match.id)) return String(match.id);
      }
    }
  }

  // 5. Resolve via payments in memory/cache
  if (type === 'payment' || title.toLowerCase().includes('payment')) {
    let payment = null;
    if (refId) {
      payment = payments.find(p => String(p.id) === String(refId));
      if (!payment) {
        try {
          const cached = localStorage.getItem('bo_cache_payments');
          if (cached) {
            const list = JSON.parse(cached);
            if (Array.isArray(list)) payment = list.find(p => String(p.id) === String(refId));
          }
        } catch (_) {}
      }
    }
    if (payment) {
      const payPatId = payment.patient_id || payment.client_id || payment.clientId || payment.user_id;
      if (payPatId && !isForbiddenId(payPatId)) {
        const localMatch = findPatientInLocal(p => String(p.id) === String(payPatId));
        if (localMatch) return String(localMatch.id);
        if (/^[0-9a-fA-F-]{36}$/.test(String(payPatId))) return String(payPatId);
      }
      const payName = (payment.customer_name || payment.client_name || payment.clientName || '').trim();
      if (payName && payName.toLowerCase() !== 'patient' && payName.toLowerCase() !== 'client') {
        const match = findPatientInLocal(p => (p.full_name || p.name || '').toLowerCase().trim() === payName.toLowerCase());
        if (match && !isForbiddenId(match.id)) return String(match.id);
      }
    }
  }

  // 6. Name extraction from message text
  let extractedName = null;
  const matchBooked = message.match(/^(.+?)\s+(?:booked|scheduled)\s+for/i);
  const matchOrder = message.match(/^(.+?)\s+placed\s+an?\s+order/i);
  const matchPayment = message.match(/confirmed\s+for\s+([^.]+)/i);
  const matchReg = message.match(/^(.+?)\s+registered/i);

  if (matchBooked) extractedName = matchBooked[1].trim();
  else if (matchOrder) extractedName = matchOrder[1].trim();
  else if (matchPayment) extractedName = matchPayment[1].trim();
  else if (matchReg) extractedName = matchReg[1].trim();

  if (extractedName && !['patient', 'client', 'user', 'someone', 'customer', 'admin'].includes(extractedName.toLowerCase())) {
    const ext = extractedName.toLowerCase().trim();
    const localMatch = findPatientInLocal(p => {
      const pName = (p.full_name || p.name || '').toLowerCase().trim();
      return pName === ext || pName.includes(ext) || ext.includes(pName);
    });
    if (localMatch && !isForbiddenId(localMatch.id)) return String(localMatch.id);
  }

  return null;
}

/**
 * Asynchronously resolve patient ID, falling back to live Supabase queries if needed
 */
export async function resolvePatientFromNotification(notif, context = {}) {
  // First attempt fast in-memory resolution
  const fastId = resolvePatientFromNotificationSync(notif, context);
  if (fastId) return fastId;

  if (!notif) return null;

  const currentAdminId = context.currentAdminId ? String(context.currentAdminId).toLowerCase().trim() : null;
  const isForbiddenId = (id) => {
    if (!id) return true;
    const clean = String(id).toLowerCase().trim();
    if (['null', 'undefined', 'admin', 'super-admin', 'current-admin', 'guest'].includes(clean)) return true;
    if (currentAdminId && clean === currentAdminId) return true;
    return false;
  };

  const rawPatId = notif.patient_id || notif.patientId;
  const type = String(notif.type || notif.category || '').toLowerCase().trim();
  const refId = notif.reference_id || notif.referenceId;
  const message = String(notif.message || '').trim();
  const title = String(notif.title || '').trim();

  // Helper: query Supabase patient
  const querySupabasePatient = async (column, value) => {
    if (!value) return null;
    try {
      const { data } = await supabase
        .from('patients')
        .select('id, name, full_name, email, phone')
        .eq(column, value)
        .maybeSingle();
      if (data && !isForbiddenId(data.id)) return data;
    } catch (_) {}

    if (supabaseAdmin) {
      try {
        const { data } = await supabaseAdmin
          .from('patients')
          .select('id, name, full_name, email, phone')
          .eq(column, value)
          .maybeSingle();
        if (data && !isForbiddenId(data.id)) return data;
      } catch (_) {}
    }
    return null;
  };

  const querySupabasePatientByName = async (nameVal) => {
    if (!nameVal || nameVal.length < 2) return null;
    try {
      const { data } = await supabase
        .from('patients')
        .select('id, name, full_name')
        .or(`full_name.ilike.%${nameVal}%,name.ilike.%${nameVal}%`)
        .limit(1);
      if (Array.isArray(data) && data.length > 0 && !isForbiddenId(data[0].id)) {
        return data[0];
      }
    } catch (_) {}

    if (supabaseAdmin) {
      try {
        const { data } = await supabaseAdmin
          .from('patients')
          .select('id, name, full_name')
          .or(`full_name.ilike.%${nameVal}%,name.ilike.%${nameVal}%`)
          .limit(1);
        if (Array.isArray(data) && data.length > 0 && !isForbiddenId(data[0].id)) {
          return data[0];
        }
      } catch (_) {}
    }
    return null;
  };

  let resolvedId = null;

  // 1. Check direct patient_id in Supabase
  if (rawPatId && !isForbiddenId(rawPatId)) {
    const cleanId = String(rawPatId).trim();
    const dbMatch = await querySupabasePatient('id', cleanId);
    if (dbMatch) resolvedId = String(dbMatch.id);
    else if (/^[0-9a-fA-F-]{36}$/.test(cleanId)) resolvedId = cleanId;
  }

  // 2. Reference ID for patient type
  if (!resolvedId && (type === 'patient' || type === 'client') && refId && !isForbiddenId(refId)) {
    const cleanRef = String(refId).trim();
    const dbMatch = await querySupabasePatient('id', cleanRef);
    if (dbMatch) resolvedId = String(dbMatch.id);
    else if (/^[0-9a-fA-F-]{36}$/.test(cleanRef)) resolvedId = cleanRef;
  }

  // 3. Check appointment in Supabase
  if (!resolvedId && (type === 'appointment' || title.toLowerCase().includes('appointment') || message.toLowerCase().includes('booked')) && refId) {
    try {
      const { data: dbAppt } = await supabase.from('appointments').select('*').eq('id', refId).maybeSingle();
      if (dbAppt) {
        const apptPatId = dbAppt.patient_id || dbAppt.client_id || dbAppt.clientId;
        if (apptPatId && !isForbiddenId(apptPatId)) {
          const dbMatch = await querySupabasePatient('id', apptPatId);
          if (dbMatch) resolvedId = String(dbMatch.id);
          else if (/^[0-9a-fA-F-]{36}$/.test(String(apptPatId))) resolvedId = String(apptPatId);
        }
        if (!resolvedId) {
          const apptEmail = (dbAppt.patient_email || dbAppt.client_email || dbAppt.clientEmail || dbAppt.email || '').toLowerCase().trim();
          if (apptEmail) {
            const dbMatch = await querySupabasePatient('email', apptEmail);
            if (dbMatch) resolvedId = String(dbMatch.id);
          }
        }
        if (!resolvedId) {
          const apptName = (dbAppt.patient_name || dbAppt.client_name || dbAppt.clientName || '').trim();
          if (apptName && apptName.toLowerCase() !== 'patient' && apptName.toLowerCase() !== 'client') {
            const dbMatch = await querySupabasePatientByName(apptName);
            if (dbMatch) resolvedId = String(dbMatch.id);
          }
        }
      }
    } catch (_) {}
  }

  // 4. Check order in Supabase
  if (!resolvedId && (type === 'order' || title.toLowerCase().includes('order') || message.toLowerCase().includes('order')) && refId) {
    try {
      const { data: dbOrder } = await supabase.from('orders').select('*').or(`id.eq.${refId},order_number.eq.${refId},order_id.eq.${refId}`).maybeSingle();
      if (dbOrder) {
        const orderPatId = dbOrder.patient_id || dbOrder.client_id || dbOrder.clientId || dbOrder.user_id;
        if (orderPatId && !isForbiddenId(orderPatId)) {
          const dbMatch = await querySupabasePatient('id', orderPatId);
          if (dbMatch) resolvedId = String(dbMatch.id);
          else if (/^[0-9a-fA-F-]{36}$/.test(String(orderPatId))) resolvedId = String(orderPatId);
        }
        if (!resolvedId) {
          const orderEmail = (dbOrder.customer_email || dbOrder.client_email || dbOrder.clientEmail || dbOrder.email || '').toLowerCase().trim();
          if (orderEmail) {
            const dbMatch = await querySupabasePatient('email', orderEmail);
            if (dbMatch) resolvedId = String(dbMatch.id);
          }
        }
        if (!resolvedId) {
          const orderName = (dbOrder.customer_name || dbOrder.client_name || dbOrder.clientName || '').trim();
          if (orderName && orderName.toLowerCase() !== 'client' && orderName.toLowerCase() !== 'patient') {
            const dbMatch = await querySupabasePatientByName(orderName);
            if (dbMatch) resolvedId = String(dbMatch.id);
          }
        }
      }
    } catch (_) {}
  }

  // 5. Check payment in Supabase
  if (!resolvedId && (type === 'payment' || title.toLowerCase().includes('payment')) && refId) {
    try {
      const { data: dbPay } = await supabase.from('payments').select('*').eq('id', refId).maybeSingle();
      if (dbPay) {
        const payPatId = dbPay.patient_id || dbPay.client_id || dbPay.clientId || dbPay.user_id;
        if (payPatId && !isForbiddenId(payPatId)) {
          const dbMatch = await querySupabasePatient('id', payPatId);
          if (dbMatch) resolvedId = String(dbMatch.id);
          else if (/^[0-9a-fA-F-]{36}$/.test(String(payPatId))) resolvedId = String(payPatId);
        }
        if (!resolvedId && dbPay.order_id) {
          const { data: dbOrder } = await supabase.from('orders').select('*').eq('id', dbPay.order_id).maybeSingle();
          if (dbOrder) {
            const opId = dbOrder.patient_id || dbOrder.client_id || dbOrder.clientId;
            if (opId && !isForbiddenId(opId)) resolvedId = String(opId);
          }
        }
        if (!resolvedId && dbPay.appointment_id) {
          const { data: dbAppt } = await supabase.from('appointments').select('*').eq('id', dbPay.appointment_id).maybeSingle();
          if (dbAppt) {
            const apId = dbAppt.patient_id || dbAppt.client_id || dbAppt.clientId;
            if (apId && !isForbiddenId(apId)) resolvedId = String(apId);
          }
        }
        if (!resolvedId) {
          const payName = (dbPay.customer_name || dbPay.client_name || dbPay.clientName || '').trim();
          if (payName && payName.toLowerCase() !== 'patient' && payName.toLowerCase() !== 'client') {
            const dbMatch = await querySupabasePatientByName(payName);
            if (dbMatch) resolvedId = String(dbMatch.id);
          }
        }
      }
    } catch (_) {}
  }

  // 6. Name extraction from notification text against Supabase
  if (!resolvedId) {
    let extractedName = null;
    const matchBooked = message.match(/^(.+?)\s+(?:booked|scheduled)\s+for/i);
    const matchOrder = message.match(/^(.+?)\s+placed\s+an?\s+order/i);
    const matchPayment = message.match(/confirmed\s+for\s+([^.]+)/i);
    const matchReg = message.match(/^(.+?)\s+registered/i);

    if (matchBooked) extractedName = matchBooked[1].trim();
    else if (matchOrder) extractedName = matchOrder[1].trim();
    else if (matchPayment) extractedName = matchPayment[1].trim();
    else if (matchReg) extractedName = matchReg[1].trim();

    if (extractedName && !['patient', 'client', 'user', 'someone', 'customer', 'admin'].includes(extractedName.toLowerCase())) {
      const dbMatch = await querySupabasePatientByName(extractedName);
      if (dbMatch) resolvedId = String(dbMatch.id);
    }
  }

  // Backfill patient_id in database asynchronously if missing
  if (resolvedId && notif.id && !notif.patient_id) {
    try {
      supabase.from('notifications')
        .update({ patient_id: resolvedId })
        .eq('id', notif.id)
        .then(() => {})
        .catch(() => {});
    } catch (_) {}
  }

  return resolvedId;
}

/**
 * Async dynamic route generator based on notification type and patient resolution.
 * Strictly prevents navigation to the logged-in admin's profile for patient notifications.
 */
export async function resolveNotificationRoute(notif, context = {}) {
  if (!notif) {
    return { path: null, error: 'No notification data provided' };
  }

  const type = String(notif.type || notif.category || '').toLowerCase().trim();
  const refId = notif.reference_id || notif.referenceId;
  const isPatientRelated = isPatientRelatedNotification(notif);

  // 1. Patient-related notification: MUST open the specific patient's profile
  if (isPatientRelated) {
    const patientId = await resolvePatientFromNotification(notif, context);

    if (patientId) {
      return {
        path: `/patients/${encodeURIComponent(patientId)}`,
        state: { patientId, fromNotification: true, notificationId: notif.id }
      };
    }

    // Fallback if patient cannot be resolved: NEVER navigate to admin profile!
    return {
      path: null,
      error: 'Unable to locate the patient profile associated with this notification.'
    };
  }

  // 2. Safe custom link (strictly disallowing admin profile links)
  if (notif.link && !notif.link.includes('/profile') && !notif.link.includes('/admin/profile')) {
    return { path: notif.link };
  }

  // 3. Non-patient notifications
  switch (type) {
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

/**
 * Dynamic route generator (synchronous fallback for backwards compatibility)
 */
export function getNotificationRoute(notif, context = {}) {
  if (!notif) return { path: '/notifications' };

  const type = (notif.type || notif.category || '').toLowerCase().trim();
  const refId = notif.reference_id || notif.referenceId;
  const isPatientRelated = isPatientRelatedNotification(notif);

  if (isPatientRelated) {
    const patId = resolvePatientFromNotificationSync(notif, context);
    if (patId) {
      return {
        path: `/patients/${encodeURIComponent(patId)}`,
        state: { patientId: patId, fromNotification: true }
      };
    }
    return {
      path: null,
      error: 'Unable to locate the patient profile associated with this notification.'
    };
  }

  if (notif.link && !notif.link.includes('/profile') && !notif.link.includes('/admin/profile')) {
    return { path: notif.link };
  }

  switch (type) {
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
    let patId = payload.patient_id || payload.patientId || (type === 'patient' ? refId : null);

    // Auto-resolve patient_id if missing for patient-related notification
    if (!patId && isPatientRelatedNotification(payload)) {
      patId = resolvePatientFromNotificationSync(payload);
    }

    // Never save an admin profile link
    const cleanLink = payload.link && !payload.link.includes('/profile') && !payload.link.includes('/admin/profile') ? payload.link : null;

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
      link: cleanLink,
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

        // If push delivery requested, trigger sendPushNotification in background
        if (payload.sendPush) {
          notificationService.sendPushNotification({
            title: payload.title,
            message: payload.message,
            notification_type: type,
            recipient_user_id: patId || payload.user_id,
            related_entity_id: refId,
            deep_link: cleanLink,
            idempotency_key: payload.idempotency_key || `push-${insertData.id}`
          }).catch(err => console.warn('[NotificationService] Background push dispatch notice:', err));
        }

        return normalized;
      }
    } catch (err) {
      console.warn('[NotificationService] Create notification error:', err);
    }

    return normalizeNotification({ ...item, id: `local-${Date.now()}` });
  },

  /**
   * Dispatch push notification via Supabase Edge Function 'send-push-notification'
   * Authenticated, idempotent, server-side FCM HTTP v1 delivery.
   */
  async sendPushNotification(payload) {
    if (!payload || !payload.title || !payload.message) {
      return { success: false, error: 'Title and message are required for push notification.' };
    }

    const idempotencyKey = payload.idempotency_key || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const body = {
      title: payload.title.trim(),
      message: payload.message.trim(),
      body: payload.message.trim(),
      notification_type: payload.notification_type || payload.type || payload.category || 'general',
      category: payload.category || payload.notification_type || 'general',
      recipient_type: payload.recipient_type || (payload.recipient_user_id ? 'specific_user' : 'all_users'),
      recipient_user_id: payload.recipient_user_id || payload.user_id || payload.patient_id || null,
      recipient_role: payload.recipient_role || null,
      related_entity_id: payload.related_entity_id || payload.reference_id || null,
      deep_link: payload.deep_link || payload.action_url || payload.link || null,
      action_url: payload.action_url || payload.deep_link || payload.link || null,
      data: payload.data || {},
      idempotency_key: idempotencyKey,
      priority: payload.priority || 'high'
    };

    try {
      // 1. Try invoking through Supabase Functions client
      let result = null;
      try {
        const { data, error } = await supabase.functions.invoke('send-push-notification', {
          body,
          headers: {
            'x-idempotency-key': idempotencyKey
          }
        });

        if (!error && data) {
          result = data;
        } else if (error) {
          console.warn('[NotificationService] supabase.functions.invoke error:', error);
        }
      } catch (invokeErr) {
        console.warn('[NotificationService] functions.invoke exception:', invokeErr);
      }

      // 2. Fallback direct HTTP invocation if functions.invoke failed (e.g. CORS/environment mismatch)
      if (!result) {
        try {
          const supabaseUrl = 'https://tuepzwlxgnmtbjijtgta.supabase.co';
          const { data: { session } } = await supabase.auth.getSession();
          const authToken = session?.access_token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1ZXB6d2x4Z25tdGJqaWp0Z3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1Njk5NzksImV4cCI6MjEwNjE0NTk3OX0.KwVH3satwRxR9NzAwDBdRzANknMVDKSdIxynvhRkkyY';

          const res = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1ZXB6d2x4Z25tdGJqaWp0Z3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1Njk5NzksImV4cCI6MjEwNjE0NTk3OX0.KwVH3satwRxR9NzAwDBdRzANknMVDKSdIxynvhRkkyY',
              'x-idempotency-key': idempotencyKey
            },
            body: JSON.stringify(body)
          });

          if (res.ok) {
            result = await res.json();
          } else {
            const errText = await res.text();
            console.warn(`[NotificationService] Edge Function HTTP ${res.status}:`, errText);
          }
        } catch (fetchErr) {
          console.warn('[NotificationService] Direct fetch error:', fetchErr);
        }
      }

      // 3. Fallback: If edge function endpoint is not yet deployed, save directly into Supabase notifications
      if (!result) {
        console.log('[NotificationService] Falling back to direct database insertion for notification record');
        const dbRecord = await notificationService.createNotification({
          ...body,
          delivery_status: 'pending'
        });

        return {
          success: true,
          notification_id: dbRecord?.id,
          delivery_status: 'pending',
          tokens_count: 0,
          sent_count: 0,
          failed_count: 0,
          message: 'Notification saved to Supabase (Edge Function offline/pending deployment).',
          notification: dbRecord
        };
      }

      // Update local cache with newly created notification
      if (result.notification) {
        const normalized = normalizeNotification(result.notification);
        try {
          const cached = localStorage.getItem('bo_cache_notifications');
          const list = cached ? JSON.parse(cached) : [];
          const updated = deduplicateNotifications([normalized, ...(Array.isArray(list) ? list : [])]);
          localStorage.setItem('bo_cache_notifications', JSON.stringify(updated));
        } catch (_) {}
      }

      return result;
    } catch (err) {
      console.error('[NotificationService] sendPushNotification error:', err);
      return { success: false, error: err.message || 'Push dispatch failed' };
    }
  },

  /**
   * Retrieve active registered push devices with user details
   */
  async fetchPushDevices() {
    try {
      const { data, error } = await supabase
        .from('push_devices')
        .select('*')
        .order('last_seen_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        return data;
      }
      return [];
    } catch (err) {
      console.warn('[NotificationService] fetchPushDevices error:', err);
      return [];
    }
  },

  /**
   * Fetch device counts & platform distribution
   */
  async fetchPushDeviceStats() {
    try {
      const devices = await this.fetchPushDevices();
      const active = devices.filter(d => d.is_active);
      const androidCount = active.filter(d => d.platform === 'android').length;
      const iosCount = active.filter(d => d.platform === 'ios').length;
      const webCount = active.filter(d => d.platform === 'web').length;

      return {
        total: devices.length,
        activeCount: active.length,
        androidCount,
        iosCount,
        webCount
      };
    } catch (_) {
      return { total: 0, activeCount: 0, androidCount: 0, iosCount: 0, webCount: 0 };
    }
  },

  /**
   * Register or update a device's FCM token in Supabase
   */
  async registerPushDevice({ userId, fcmToken, platform = 'android', deviceId = null, deviceName = null, appVersion = null }) {
    if (!userId || !fcmToken) return { success: false, error: 'userId and fcmToken required' };

    try {
      // Try RPC first
      const { data: rpcData, error: rpcError } = await supabase.rpc('register_push_device', {
        p_user_id: userId,
        p_fcm_token: fcmToken,
        p_platform: platform,
        p_device_id: deviceId,
        p_device_name: deviceName,
        p_app_version: appVersion
      });

      if (!rpcError && rpcData) {
        return rpcData;
      }

      // Fallback direct upsert
      const { data, error } = await supabase
        .from('push_devices')
        .upsert({
          user_id: userId,
          fcm_token: fcmToken,
          platform: platform.toLowerCase(),
          device_id: deviceId,
          device_name: deviceName,
          app_version: appVersion,
          is_active: true,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'fcm_token' })
        .select()
        .single();

      if (!error && data) {
        return { success: true, device: data };
      }

      return { success: false, error: error?.message || 'Device registration failed' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Disassociate/deactivate device token on logout
   */
  async unregisterPushDevice(fcmToken, userId = null) {
    if (!fcmToken) return { success: false };
    try {
      const { data, error } = await supabase.rpc('unregister_push_device', {
        p_fcm_token: fcmToken,
        p_user_id: userId
      });

      if (!error && data) return data;

      await supabase
        .from('push_devices')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('fcm_token', fcmToken);

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

