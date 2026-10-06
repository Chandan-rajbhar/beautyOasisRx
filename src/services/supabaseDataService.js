/**
 * supabaseDataService.js
 * 
 * High-Performance Supabase Data Service with:
 * 1. In-flight request deduplication (prevents duplicate simultaneous queries)
 * 2. In-memory caching with TTL (Time-To-Live) and Stale-While-Revalidate
 * 3. LocalStorage persistence for instant 0ms first-paint hydration
 * 4. Optimistic / Direct cache updates on mutations (no full-table refetch lag)
 * 5. Reactive subscriber pattern with debounced real-time updates
 */

import { supabase } from '../lib/supabaseClient';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { normalizeNotification, DEFAULT_NOTIFICATIONS, deduplicateNotifications, isStaticNotification } from './notificationService';
import { activityLogService } from './activityLogService';
import { getUpcomingAppointments, isAppointmentUpcoming } from '../utils/appointmentUtils';

// Map collection names to Supabase table names
const TABLE_MAP = {
  appointments: 'appointments',
  clients: 'patients',
  patients: 'patients',
  services: 'services',
  products: 'products',
  categories: 'categories',
  orders: 'orders',
  payments: 'payments',
  providers: 'clinicians',
  clinicians: 'clinicians',
  inquiries: 'inquiries',
  notifications: 'notifications',
  activity_logs: 'activity_logs',
  users: 'users',
  website_content: 'website_content',
  settings: 'settings',
  order_statuses: 'order_statuses',
};

const APPOINTMENTS_DB_COLUMNS = new Set([
  'id',
  'patient_id',
  'client_id',
  'treatment_protocol_id',
  'service_id',
  'clinician_id',
  'provider_id',
  'patient_name',
  'client_name',
  'patient_email',
  'client_email',
  'patient_phone',
  'client_phone',
  'protocol_title',
  'service_name',
  'clinician_name',
  'provider_name',
  'appointment_date',
  'date',
  'appointment_time',
  'time',
  'start_time',
  'end_time',
  'duration',
  'status',
  'payment_status',
  'amount',
  'price',
  'notes',
  'stripe_payment_intent_id',
  'stripe_checkout_session_id',
  'created_at',
  'updated_at'
]);

function sanitizeAppointmentsPayload(input) {
  if (!input || typeof input !== 'object') return {};
  const out = {};

  const pId = input.patient_id || input.client_id || input.clientId;
  const pName = input.patient_name || input.client_name || input.clientName;
  const pEmail = input.patient_email || input.client_email || input.clientEmail;
  const pPhone = input.patient_phone || input.client_phone || input.clientPhone;
  const sId = input.treatment_protocol_id || input.service_id || input.serviceId;
  const sName = input.protocol_title || input.service_name || input.serviceName;
  const provId = input.clinician_id || input.provider_id || input.providerId;
  const provName = input.clinician_name || input.provider_name || input.providerName;
  const aDate = input.appointment_date || input.date;
  const aTime = input.appointment_time || input.time;
  const payStatus = input.payment_status || input.paymentStatus;
  const amt = input.amount !== undefined ? input.amount : input.price;

  if (pId !== undefined) { out.patient_id = pId; out.client_id = pId; }
  if (pName !== undefined) { out.patient_name = pName; out.client_name = pName; }
  if (pEmail !== undefined) { out.patient_email = pEmail; out.client_email = pEmail; }
  if (pPhone !== undefined) { out.patient_phone = pPhone; out.client_phone = pPhone; }
  if (sId !== undefined) { out.treatment_protocol_id = sId; out.service_id = sId; }
  if (sName !== undefined) { out.protocol_title = sName; out.service_name = sName; }
  if (provId !== undefined) { out.clinician_id = provId; out.provider_id = provId; }
  if (provName !== undefined) { out.clinician_name = provName; out.provider_name = provName; }
  if (aDate !== undefined) { out.appointment_date = aDate; out.date = aDate; }
  if (aTime !== undefined) { out.appointment_time = aTime; out.time = aTime; }
  if (input.start_time !== undefined) out.start_time = input.start_time;
  if (input.end_time !== undefined) out.end_time = input.end_time;
  if (input.duration !== undefined) out.duration = input.duration;
  if (input.status !== undefined) out.status = input.status;
  if (payStatus !== undefined) out.payment_status = payStatus;
  if (amt !== undefined) { out.amount = Number(amt) || 0; out.price = Number(amt) || 0; }
  if (input.notes !== undefined) out.notes = input.notes || '';
  if (input.stripe_payment_intent_id !== undefined) out.stripe_payment_intent_id = input.stripe_payment_intent_id;
  if (input.stripe_checkout_session_id !== undefined) out.stripe_checkout_session_id = input.stripe_checkout_session_id;

  for (const [k, v] of Object.entries(input)) {
    if (APPOINTMENTS_DB_COLUMNS.has(k) && out[k] === undefined && k !== 'id') {
      out[k] = v;
    }
  }

  return out;
}

function sanitizePaymentsPayload(input) {
  if (!input || typeof input !== 'object') return {};
  const out = { ...input };

  if (out.status !== undefined && out.payment_status === undefined) {
    out.payment_status = String(out.status).toLowerCase();
  }
  if (out.amount !== undefined && out.total_amount === undefined) {
    out.total_amount = Number(out.amount) || 0;
  }
  if (out.paymentMethod !== undefined && out.payment_method === undefined) {
    out.payment_method = out.paymentMethod;
  }
  delete out.id;
  delete out.status;
  delete out.amount;
  delete out.transactionId;
  delete out.transaction_id;
  delete out.clientName;
  delete out.client_name;
  delete out.clientEmail;
  delete out.client_email;
  delete out.clientPhone;
  delete out.paymentMethod;
  delete out.date;
  delete out.referenceId;
  delete out.type;

  return out;
}


// Cache TTL: 45 seconds for active queries
const CACHE_TTL_MS = 45 * 1000;

// In-memory cache, timestamps, in-flight promises, and subscribers
const cache = {};
const cacheTimestamps = {};
const inFlightRequests = {};
const subscribers = {};
const sanitizedCacheCollections = new Set();

export const sanitizeCacheData = (value) => {
  if (typeof value === 'string') return /^data:image\//i.test(value) ? null : value;
  if (Array.isArray(value)) return value.map(sanitizeCacheData);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [key, sanitizeCacheData(nestedValue)]));
};

function sanitizeStoredInlineImages() {
  try {
    const cacheKeys = [];
    const imageKeys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith('bo_cache_') || key === 'cached_dynamic_products' || key === 'cached_dynamic_patients') {
        cacheKeys.push(key);
      } else if (/^(product_img_|user_photo_|patient_photo_)/.test(key || '')) {
        imageKeys.push(key);
      }
    }

    cacheKeys.forEach((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      const sanitized = sanitizeCacheData(parsed);
      const serialized = JSON.stringify(sanitized);
      if (serialized === raw) return;

      try {
        localStorage.setItem(key, serialized);
      } catch (_) {
        localStorage.removeItem(key);
      }
      if (key.startsWith('bo_cache_')) sanitizedCacheCollections.add(key.slice('bo_cache_'.length));
      else if (key === 'cached_dynamic_products') sanitizedCacheCollections.add('products');
      else if (key === 'cached_dynamic_patients') sanitizedCacheCollections.add('clients');
    });

    imageKeys.forEach((key) => {
      if (/^data:image\//i.test(localStorage.getItem(key) || '')) {
        localStorage.removeItem(key);
        if (key.startsWith('product_img_')) sanitizedCacheCollections.add('products');
        else if (key.startsWith('user_photo_')) sanitizedCacheCollections.add('users');
        else if (key.startsWith('patient_photo_')) sanitizedCacheCollections.add('clients');
      }
    });
  } catch (_) {}
}

sanitizeStoredInlineImages();

// Helper: load initial cache from localStorage if present
function loadFromStorage(collection) {
  try {
    const raw = localStorage.getItem(`bo_cache_${collection}`);
    if (raw) {
      let parsed = JSON.parse(raw);
      if (parsed && (Array.isArray(parsed) || typeof parsed === 'object')) {
        if (collection === 'payments' && Array.isArray(parsed)) {
          parsed = parsed.map((p) => normalizePayment(p, []));
        } else if (collection === 'appointments' && Array.isArray(parsed)) {
          parsed = parsed.map(normalizeAppointment);
        } else if (collection === 'notifications' && Array.isArray(parsed)) {
          parsed = deduplicateNotifications(parsed);
        }
        cache[collection] = parsed;
        cacheTimestamps[collection] = Date.now() - (
          sanitizedCacheCollections.delete(collection) ? CACHE_TTL_MS : CACHE_TTL_MS / 2
        );
        return parsed;
      }
    }
  } catch (_) {}
  return null;
}

// Helper: save to localStorage asynchronously
function saveToStorage(collection, data) {
  try {
    // Only persist arrays or serializable objects
    if (data && (Array.isArray(data) || typeof data === 'object')) {
      localStorage.setItem(`bo_cache_${collection}`, JSON.stringify(sanitizeCacheData(data)));
    }
  } catch (_) {}
}

// Notify subscribers of state changes
function notifySubscribers(collection, data) {
  const cleanData = collection === 'notifications' && Array.isArray(data) ? deduplicateNotifications(data) : data;
  cache[collection] = cleanData;
  cacheTimestamps[collection] = Date.now();
  saveToStorage(collection, cleanData);

  if (subscribers[collection]) {
    subscribers[collection].forEach((cb) => {
      try {
        cb(cleanData);
      } catch (err) {
        console.warn(`Subscriber error for ${collection}:`, err);
      }
    });
  }
}

// Instant synchronous cache read (memory -> localStorage -> default)
function getCachedData(collection, defaultVal = null) {
  if (cache[collection] !== undefined) {
    return cache[collection];
  }
  const fromStorage = loadFromStorage(collection);
  if (fromStorage !== null) {
    return fromStorage;
  }
  return defaultVal;
}

// Invalidate cache for a specific collection or all
function invalidateCache(collection) {
  if (collection) {
    delete cache[collection];
    delete cacheTimestamps[collection];
    delete inFlightRequests[collection];
    try { localStorage.removeItem(`bo_cache_${collection}`); } catch (_) {}
  } else {
    Object.keys(cache).forEach((k) => delete cache[k]);
    Object.keys(cacheTimestamps).forEach((k) => delete cacheTimestamps[k]);
    Object.keys(inFlightRequests).forEach((k) => delete inFlightRequests[k]);
  }
}

// Helper: normalize appointment objects across camelCase and snake_case schemas
function normalizeAppointment(item) {
  if (!item || typeof item !== 'object') return item;
  return {
    ...item,
    id: item.id,
    patient_id: item.patient_id || item.client_id || item.clientId,
    client_id: item.client_id || item.patient_id || item.clientId,
    clientId: item.clientId || item.client_id || item.patient_id,
    patient_name: item.patient_name || item.client_name || item.clientName || 'Patient',
    client_name: item.client_name || item.patient_name || item.clientName || 'Patient',
    clientName: item.clientName || item.client_name || item.patient_name || 'Patient',
    patient_email: item.patient_email || item.client_email || item.clientEmail || '',
    client_email: item.client_email || item.patient_email || item.clientEmail || '',
    clientEmail: item.clientEmail || item.client_email || item.patient_email || '',
    patient_phone: item.patient_phone || item.client_phone || item.clientPhone || '',
    client_phone: item.client_phone || item.patient_phone || item.clientPhone || '',
    clientPhone: item.clientPhone || item.client_phone || item.patient_phone || '',
    treatment_protocol_id: item.treatment_protocol_id || item.service_id || item.serviceId,
    service_id: item.service_id || item.treatment_protocol_id || item.serviceId,
    serviceId: item.serviceId || item.service_id || item.treatment_protocol_id,
    protocol_title: item.protocol_title || item.service_name || item.serviceName || 'Treatment Protocol',
    service_name: item.service_name || item.protocol_title || item.serviceName || 'Treatment Protocol',
    serviceName: item.serviceName || item.service_name || item.protocol_title || 'Treatment Protocol',
    clinician_id: item.clinician_id || item.provider_id || item.providerId,
    provider_id: item.provider_id || item.clinician_id || item.providerId,
    providerId: item.providerId || item.provider_id || item.clinician_id,
    clinician_name: item.clinician_name || item.provider_name || item.providerName || 'Clinician',
    provider_name: item.provider_name || item.clinician_name || item.providerName || 'Clinician',
    providerName: item.providerName || item.provider_name || item.clinician_name || 'Clinician',
    appointment_date: item.appointment_date || item.date || '',
    date: item.date || item.appointment_date || '',
    appointment_time: item.appointment_time || item.time || '',
    time: item.time || item.appointment_time || '',
    duration: item.duration || '60 Mins',
    amount: item.amount ?? item.price ?? 0,
    price: item.price ?? item.amount ?? 0,
    notes: item.notes || '',
    status: item.status || 'Confirmed',
    payment_status: item.payment_status || item.paymentStatus || 'Pending',
    paymentStatus: item.paymentStatus || item.payment_status || 'Pending',
    stripe_payment_intent_id: item.stripe_payment_intent_id || null,
    stripe_checkout_session_id: item.stripe_checkout_session_id || null
  };
}

// Helper: normalize payment records across Supabase schema and UI requirements
export function normalizePayment(item, patients = []) {
  if (!item || typeof item !== 'object') return item;

  const rawAmt = item.total_amount !== undefined && item.total_amount !== null
    ? item.total_amount
    : item.amount !== undefined && item.amount !== null
      ? item.amount
      : 0;
  const numAmount = Number(rawAmt) || 0;

  const rawStatus = String(item.payment_status || item.status || 'Pending').trim();
  const normalizedStatus = rawStatus.toLowerCase() === 'paid'
    ? 'Paid'
    : rawStatus.toLowerCase() === 'pending'
      ? 'Pending'
      : rawStatus.toLowerCase() === 'refunded'
        ? 'Refunded'
        : rawStatus.toLowerCase() === 'failed'
          ? 'Failed'
          : rawStatus ? rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1) : 'Pending';

  const txnId = item.stripe_payment_intent_id
    || item.reference
    || item.transactionId
    || item.transaction_id
    || item.order_id
    || item.stripe_session_id
    || (item.id ? `TXN-${String(item.id).slice(0, 8).toUpperCase()}` : 'TXN-N/A');

  let clientName = item.customer_name || item.client_name || item.clientName || '';
  let clientEmail = item.customer_email || item.client_email || item.clientEmail || '';
  let clientPhone = item.customer_phone || item.client_phone || item.clientPhone || '';
  let clientId = item.user_id && item.user_id !== 'guest' ? item.user_id : item.client_id || item.patient_id || null;

  if (Array.isArray(patients) && patients.length > 0) {
    const matchedPatient = patients.find(p =>
      (clientId && (p.id === clientId || p.client_id === clientId)) ||
      (clientEmail && p.email && p.email.toLowerCase() === clientEmail.toLowerCase()) ||
      (clientName && (p.name || p.full_name) && (p.name || p.full_name).toLowerCase() === clientName.toLowerCase())
    );
    if (matchedPatient) {
      if (!clientId) clientId = matchedPatient.id;
      if (!clientName) clientName = matchedPatient.full_name || matchedPatient.name;
      if (!clientEmail) clientEmail = matchedPatient.email;
      if (!clientPhone) clientPhone = matchedPatient.phone;
    }
  }

  if (!clientName) clientName = 'Guest Patient';

  let rawMethod = item.payment_method || item.method || item.paymentMethod || 'Stripe';
  let formattedMethod = rawMethod;
  if (rawMethod.toLowerCase() === 'stripe') {
    formattedMethod = 'Credit Card (Stripe)';
  } else if (/visa/i.test(rawMethod) || /mastercard/i.test(rawMethod) || /amex/i.test(rawMethod)) {
    formattedMethod = rawMethod;
  } else if (rawMethod) {
    formattedMethod = rawMethod.charAt(0).toUpperCase() + rawMethod.slice(1);
  }

  const rawDate = item.created_at || item.date || item.updated_at || '';
  let formattedDate = '';
  if (rawDate) {
    try {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        const pad = (n) => String(n).padStart(2, '0');
        const year = d.getFullYear();
        const month = pad(d.getMonth() + 1);
        const day = pad(d.getDate());
        let hours = d.getHours();
        const minutes = pad(d.getMinutes());
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        formattedDate = `${year}-${month}-${day} ${pad(hours)}:${minutes} ${ampm}`;
      } else {
        formattedDate = String(rawDate);
      }
    } catch (_) {
      formattedDate = String(rawDate);
    }
  }

  return {
    ...item,
    id: item.id,
    transactionId: txnId,
    transaction_id: txnId,
    clientName,
    client_name: clientName,
    customer_name: clientName,
    clientEmail,
    client_email: clientEmail,
    customer_email: clientEmail,
    clientPhone,
    customer_phone: clientPhone,
    clientId,
    user_id: clientId,
    amount: numAmount,
    total_amount: numAmount,
    status: normalizedStatus,
    payment_status: normalizedStatus.toLowerCase(),
    paymentMethod: formattedMethod,
    payment_method: rawMethod,
    date: formattedDate,
    created_at: rawDate || new Date().toISOString(),
    currency: item.currency || 'USD',
    order_id: item.order_id || null,
    referenceId: item.order_id || item.reference || txnId,
    type: item.order_id ? 'Apothecary Order' : (item.appointment_id ? 'Treatment Protocol' : 'Direct Payment')
  };
}

// Helper: normalize inquiry records across Supabase schema and UI requirements
export function normalizeInquiry(item) {
  if (!item || typeof item !== 'object') return item;
  const ticketId = item.ticket_id || item.ticketId || (item.id ? `INQ-${String(item.id).slice(0, 8).toUpperCase()}` : 'INQ-N/A');
  return {
    ...item,
    id: item.id,
    ticket_id: ticketId,
    ticketId: ticketId,
    name: item.name || item.sender_name || 'Prospect',
    email: item.email || '',
    contact_number: item.contact_number || item.phone || '',
    phone: item.contact_number || item.phone || '',
    subject: item.subject || 'Consultation Inquiry',
    message: item.message || '',
    status: item.status || 'New',
    priority: item.priority || 'Medium',
    received_at: item.received_at || item.date || item.created_at || new Date().toISOString(),
    date: item.date || (item.received_at ? new Date(item.received_at).toLocaleDateString() : ''),
    notes: item.notes || '',
    created_at: item.created_at || item.received_at || new Date().toISOString(),
    updated_at: item.updated_at || new Date().toISOString()
  };
}

// ─────────────────────────────────────────────
// FETCH ALL (with Deduplication & Cache TTL)
// ─────────────────────────────────────────────
async function fetchAll(collection, options = {}) {
  const { forceFresh = false } = options;
  const table = TABLE_MAP[collection];
  if (!table) return [];

  const now = Date.now();
  const hasValidCache =
    !forceFresh &&
    cache[collection] !== undefined &&
    cacheTimestamps[collection] &&
    now - cacheTimestamps[collection] < CACHE_TTL_MS;

  // 1. Return fresh cached data immediately if within TTL
  if (hasValidCache) {
    return cache[collection];
  }

  // 2. Request Deduplication: return existing in-flight promise if one is already running
  if (inFlightRequests[collection]) {
    return inFlightRequests[collection];
  }

  // 3. Initiate new query and store promise in inFlightRequests
  const queryPromise = (async () => {
    try {
      let data = null;
      let error = null;

      if (collection === 'services') {
        const tpRes = await supabase.from('treatment_protocols').select('*').order('created_at', { ascending: false });
        if (!tpRes.error && tpRes.data && tpRes.data.length > 0) {
          data = tpRes.data.map(item => ({
            ...item,
            id: item.id,
            protocol_title: item.protocol_title || item.title || item.name || 'Treatment',
            title: item.protocol_title || item.title || item.name || 'Treatment',
            category: item.category || 'Skin Rejuvenation',
            category_id: item.category_id || null,
            duration: item.duration || '60 Mins',
            price: Number(item.price || item.numericPrice || 0),
            numericPrice: Number(item.price || item.numericPrice || 0),
            status: item.status || 'Active'
          }));
        } else {
          const srvRes = await supabase.from('services').select('*').order('created_at', { ascending: false });
          if (!srvRes.error && srvRes.data) {
            data = srvRes.data.map(item => ({
              ...item,
              id: item.id,
              protocol_title: item.name || item.title || 'Treatment',
              title: item.name || item.title || 'Treatment',
              category: item.category || 'Skin Rejuvenation',
              duration: item.duration ? `${item.duration} Mins` : '60 Mins',
              price: Number(item.price || 0),
              numericPrice: Number(item.price || 0),
              status: item.status || 'Active'
            }));
          } else {
            error = tpRes.error || srvRes.error;
          }
        }
      } else if (collection === 'providers') {
        const clRes = await supabase.from('clinicians').select('*').order('created_at', { ascending: false });
        if (!clRes.error && clRes.data && clRes.data.length > 0) {
          data = clRes.data.map(item => ({
            ...item,
            id: item.id,
            name: item.clinician_name || item.name || 'Clinician',
            clinician_name: item.clinician_name || item.name || 'Clinician',
            role: item.clinical_title || item.role || item.specialization || 'Clinician',
            clinical_title: item.clinical_title || item.role || 'Clinician',
            specialization: item.specialization || '',
            availability_schedule: item.availability_schedule || item.availability || {},
            email: item.email || '',
            phone: item.phone || '',
            status: item.practice_status || item.status || 'Active'
          }));
        } else {
          const prRes = await supabase.from('providers').select('*').order('created_at', { ascending: false });
          if (!prRes.error && prRes.data) {
            data = prRes.data.map(item => ({
              ...item,
              id: item.id,
              name: item.name || 'Clinician',
              clinician_name: item.name || 'Clinician',
              role: item.role || 'Clinician',
              clinical_title: item.role || 'Clinician',
              specialization: item.specialization || '',
              availability_schedule: item.availability || {},
              email: item.email || '',
              phone: item.phone || '',
              status: item.status || 'Active'
            }));
          } else {
            error = clRes.error || prRes.error;
          }
        }
      } else if (collection === 'clients') {
        const ptRes = await supabase.from('patients').select('*').order('created_at', { ascending: false });
        if (!ptRes.error && ptRes.data && ptRes.data.length > 0) {
          data = ptRes.data.map(item => ({
            ...item,
            id: item.id,
            name: item.name || item.full_name || 'Patient',
            full_name: item.full_name || item.name || 'Patient',
            email: item.email || '',
            phone: item.phone || '',
            avatar: item.profilePhotoUrl || item.profile_photo_url || item.avatar || null,
            status: item.status || item.account_status || 'Active'
          }));
        } else {
          const cltRes = await supabase.from('clients').select('*').order('created_at', { ascending: false });
          if (!cltRes.error && cltRes.data) {
            data = cltRes.data.map(item => ({
              ...item,
              id: item.id,
              name: item.name || 'Patient',
              full_name: item.name || 'Patient',
              email: item.email || '',
              phone: item.phone || '',
              avatar: item.avatar || null,
              status: item.status || 'Active'
            }));
          } else {
            error = ptRes.error || cltRes.error;
          }
        }
      } else if (collection === 'appointments') {
        let apptRows = null;
        try {
          const apptRes = await supabase.from('appointments').select('*').order('created_at', { ascending: false });
          if (!apptRes.error && Array.isArray(apptRes.data)) {
            apptRows = apptRes.data;
          } else {
            const fallbackRes = await supabase.from('appointments').select('*');
            if (!fallbackRes.error && Array.isArray(fallbackRes.data)) {
              apptRows = fallbackRes.data;
            }
          }
        } catch (_) {}

        if (!apptRows) {
          try {
            const adminRes = await supabaseAdmin.from('appointments').select('*').order('created_at', { ascending: false });
            if (!adminRes.error && Array.isArray(adminRes.data)) {
              apptRows = adminRes.data;
            } else {
              const plainAdminRes = await supabaseAdmin.from('appointments').select('*');
              if (!plainAdminRes.error && Array.isArray(plainAdminRes.data)) {
                apptRows = plainAdminRes.data;
              }
            }
          } catch (_) {}
        }

        if (apptRows) {
          data = apptRows.map(normalizeAppointment);
        } else {
          error = new Error('Could not fetch appointments from Supabase');
        }
      } else if (collection === 'notifications') {
        const fetchedNotifs = await notificationService.fetchNotifications();
        data = deduplicateNotifications(fetchedNotifs);
      } else if (collection === 'activity_logs') {
        data = await activityLogService.fetchActivityLogs(cache);
      } else {
        let query = supabase.from(table).select('*');
        if (collection === 'categories') query = query.order('name', { ascending: true });
        else if (collection === 'website_content') {
          const res = await query;
          if (res.error) {
            console.error(`Supabase fetch error [${collection}]:`, res.error);
            return cache[collection] || {};
          }
          const obj = {};
          (res.data || []).forEach((row) => { obj[row.section] = row.data; });
          notifySubscribers(collection, obj);
          return obj;
        } else if (collection === 'settings') {
          const res = await query;
          if (res.error) {
            console.error(`Supabase fetch error [${collection}]:`, res.error);
            return cache[collection] || {};
          }
          const obj = {};
          (res.data || []).forEach((row) => { obj[row.key] = row.value; });
          notifySubscribers(collection, obj);
          return obj;
        } else {
          query = query.order('created_at', { ascending: false });
        }
        const generalRes = await query;
        data = generalRes.data;
        error = generalRes.error;

        if (collection === 'orders' && Array.isArray(data)) {
          data = data.map((o) => {
            const rawItems = Array.isArray(o.items) && o.items.length > 0 ? o.items : Array.isArray(o.cart_items) ? o.cart_items : [];
            const calcItemsTotal = rawItems.reduce((acc, it) => acc + (Number(it.quantity || it.qty || 1) * Number(it.price || 0)), 0);
            const total = Number(
              o.total_amount !== undefined && o.total_amount !== null
                ? o.total_amount
                : o.total !== undefined && o.total !== null
                  ? o.total
                  : o.totalAmount !== undefined && o.totalAmount !== null
                    ? o.totalAmount
                    : calcItemsTotal > 0
                      ? calcItemsTotal
                      : 0
            );

            const rawDate = o.created_at || o.date;
            const dateStr = rawDate ? new Date(rawDate).toISOString().split('T')[0] : '';
            const rawPay = (o.payment_status || o.paymentStatus || 'Pending').trim();
            const payStatus = rawPay.toLowerCase() === 'paid' ? 'Paid' : rawPay.toLowerCase() === 'pending' ? 'Pending' : rawPay.charAt(0).toUpperCase() + rawPay.slice(1);
            const ordStatus = (o.order_status || o.status || o.orderStatus || 'Pending').trim();

            const cName = o.customer_name || o.client_name || o.clientName || o.shipping_address?.fullName || o.delivery_address?.fullName || 'Unknown Patient';
            const cEmail = o.customer_email || o.client_email || o.clientEmail || '';
            const cPhone = o.customer_phone || o.client_phone || o.clientPhone || '';
            const cId = o.user_id !== 'guest' ? (o.user_id || o.client_id || o.clientId) : null;

            return {
              ...o,
              clientId: cId,
              client_id: cId,
              clientName: cName,
              client_name: cName,
              clientEmail: cEmail,
              client_email: cEmail,
              clientPhone: cPhone,
              client_phone: cPhone,
              orderNumber: o.order_number || o.order_id || o.id,
              order_number: o.order_number || o.order_id || o.id,
              totalAmount: total,
              total: total,
              total_amount: total,
              orderStatus: ordStatus,
              status: ordStatus,
              order_status: ordStatus,
              paymentStatus: payStatus,
              payment_status: payStatus,
              items: rawItems.length > 0 ? rawItems : o.items,
              date: dateStr,
              trackingNumber: o.tracking_number || o.trackingNumber || '',
              tracking_number: o.tracking_number || o.trackingNumber || '',
              shippingAddress: typeof o.shipping_address === 'string' ? o.shipping_address : o.shipping_address?.addressLine1 || o.delivery_address?.addressLine1 || 'Clinic Pickup (Allen, TX)'
            };
          });
        }

        if (collection === 'payments' && Array.isArray(data)) {
          data = data.map((p) => normalizePayment(p, cache.clients || []));
        }

        if (collection === 'inquiries' && Array.isArray(data)) {
          data = data.map(normalizeInquiry);
        }

        if (collection === 'notifications' && Array.isArray(data)) {
          data = data.map(normalizeNotification);
        }
      }

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
          console.warn(`[Supabase notice] Table 'public.${table}' is not yet created in Supabase database. Falling back to local cache.`);
        } else {
          console.error(`Supabase fetch error [${collection}]:`, error);
        }
        return getCachedData(collection, []);
      }

      const result = data || [];
      notifySubscribers(collection, result);
      return result;
    } catch (err) {
      console.warn(`Supabase network notice [${collection}]:`, err?.message || err);
      return getCachedData(collection, []);
    } finally {
      delete inFlightRequests[collection];
    }
  })();

  inFlightRequests[collection] = queryPromise;
  return queryPromise;
}

// ─────────────────────────────────────────────
// CREATE (Optimistic + Direct Cache Update)
// ─────────────────────────────────────────────
async function createItem(collection, item) {
  const table = TABLE_MAP[collection];
  if (!table) return null;

  const { id, ...rest } = item;
  let payload = collection === 'appointments'
    ? { ...sanitizeAppointmentsPayload(rest), updated_at: new Date().toISOString() }
    : collection === 'payments'
      ? { ...sanitizePaymentsPayload(rest), updated_at: new Date().toISOString() }
      : { ...rest, updated_at: new Date().toISOString() };

  let insertResult = null;
  let attempts = 0;
  while (attempts < 20) {
    attempts++;
    try {
      let res = await supabase.from(table).insert([payload]).select().single();
      if (!res.error && res.data) {
        insertResult = res.data;
        break;
      }

      if (res.error) {
        // Try fallback with supabaseAdmin
        const adminRes = await supabaseAdmin.from(table).insert([payload]).select().single();
        if (!adminRes.error && adminRes.data) {
          insertResult = adminRes.data;
          break;
        }

        const activeErr = adminRes.error || res.error;
        const match = activeErr.message && activeErr.message.match(/Could not find the '([^']+)' column/i);
        if (match && match[1] && payload[match[1]] !== undefined) {
          delete payload[match[1]];
          continue;
        }
        console.warn(`Supabase create notice [${collection}]:`, activeErr.message);
        break;
      }
    } catch (netErr) {
      try {
        const adminRes = await supabaseAdmin.from(table).insert([payload]).select().single();
        if (!adminRes.error && adminRes.data) {
          insertResult = adminRes.data;
          break;
        }
      } catch (_) {}
      console.warn(`Supabase network issue on create [${collection}]:`, netErr?.message || netErr);
      break;
    }
  }

  // Graceful fallback for offline, network issues, or pending table migration
  if (!insertResult) {
    insertResult = {
      id: id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'apt-' + Date.now()),
      ...payload,
      created_at: new Date().toISOString()
    };
  }

  const normalized = collection === 'appointments'
    ? normalizeAppointment(insertResult)
    : collection === 'payments'
      ? normalizePayment(insertResult, cache.clients || [])
      : collection === 'inquiries'
        ? normalizeInquiry(insertResult)
        : insertResult;
  const currentList = Array.isArray(cache[collection]) ? cache[collection] : [];
  const updatedList = [normalized, ...currentList.filter((x) => x.id !== normalized.id)];
  notifySubscribers(collection, updatedList);
  saveToStorage(collection, updatedList);

  return normalized;
}

// ─────────────────────────────────────────────
// UPDATE (Optimistic + Direct Cache Update)
// ─────────────────────────────────────────────
async function updateItem(collection, id, updates) {
  const table = TABLE_MAP[collection];
  if (!table) return null;

  let payload = collection === 'appointments'
    ? { ...sanitizeAppointmentsPayload(updates), updated_at: new Date().toISOString() }
    : collection === 'payments'
      ? { ...sanitizePaymentsPayload(updates), updated_at: new Date().toISOString() }
      : { ...updates, updated_at: new Date().toISOString() };
  delete payload.id;

  let updateResult = null;
  let attempts = 0;
  while (attempts < 20) {
    attempts++;
    try {
      let res = await supabase
        .from(table)
        .update(payload)
        .eq('id', id)
        .select();

      if (!res.error && Array.isArray(res.data) && res.data.length > 0) {
        updateResult = res.data[0];
        break;
      }

      // Try fallback to supabaseAdmin
      const adminRes = await supabaseAdmin
        .from(table)
        .update(payload)
        .eq('id', id)
        .select();
      if (!adminRes.error && Array.isArray(adminRes.data) && adminRes.data.length > 0) {
        updateResult = adminRes.data[0];
        break;
      }

      const activeErr = res.error || adminRes.error;
      if (activeErr) {
        const match = activeErr.message && activeErr.message.match(/Could not find the '([^']+)' column/i);
        if (match && match[1] && payload[match[1]] !== undefined) {
          delete payload[match[1]];
          continue;
        }
        console.warn(`Supabase update notice [${collection}]:`, activeErr.message);
        break;
      }
      break;
    } catch (netErr) {
      try {
        const adminRes = await supabaseAdmin
          .from(table)
          .update(payload)
          .eq('id', id)
          .select();
        if (!adminRes.error && Array.isArray(adminRes.data) && adminRes.data.length > 0) {
          updateResult = adminRes.data[0];
          break;
        }
      } catch (_) {}
      console.warn(`Supabase network issue on update [${collection}]:`, netErr?.message || netErr);
      break;
    }
  }

  // Fallback for offline or network issues
  if (!updateResult) {
    updateResult = {
      id,
      ...payload
    };
  }

  const normalized = collection === 'appointments'
    ? normalizeAppointment(updateResult)
    : collection === 'payments'
      ? normalizePayment(updateResult, cache.clients || [])
      : collection === 'inquiries'
        ? normalizeInquiry(updateResult)
        : updateResult;
  const currentList = Array.isArray(cache[collection]) ? cache[collection] : [];
  const updatedList = currentList.map((item) => (String(item.id) === String(id) ? { ...item, ...normalized } : item));
  notifySubscribers(collection, updatedList);
  saveToStorage(collection, updatedList);

  return normalized;
}

// ─────────────────────────────────────────────
// DELETE (Optimistic + Direct Cache Update)
// ─────────────────────────────────────────────
async function deleteItem(collection, id) {
  const table = TABLE_MAP[collection];
  if (!table) return false;

  let delError = null;
  try {
    const res = await supabase.from(table).delete().eq('id', id);
    if (res.error) {
      delError = res.error;
      const adminRes = await supabaseAdmin.from(table).delete().eq('id', id);
      if (!adminRes.error) {
        delError = null;
      }
    }
  } catch (err) {
    delError = err;
    try {
      const adminRes = await supabaseAdmin.from(table).delete().eq('id', id);
      if (!adminRes.error) {
        delError = null;
      }
    } catch (_) {}
  }

  if (delError && delError.code !== '22P02') {
    console.error(`Supabase delete error [${collection}]:`, delError);
    throw delError;
  }

  // Update in-memory cache directly
  const currentList = Array.isArray(cache[collection]) ? cache[collection] : [];
  const updatedList = currentList.filter((item) => String(item.id) !== String(id));
  notifySubscribers(collection, updatedList);
  saveToStorage(collection, updatedList);

  return true;
}

// ─────────────────────────────────────────────
// SUBSCRIBE (Reactive updates)
// ─────────────────────────────────────────────
function subscribe(collection, callback) {
  if (!subscribers[collection]) subscribers[collection] = [];
  subscribers[collection].push(callback);

  // Immediately call with cached data if available
  const cached = getCachedData(collection);
  if (cached !== null && cached !== undefined) {
    try {
      callback(cached);
    } catch (_) {}
  }

  // Return unsubscribe function
  return () => {
    if (subscribers[collection]) {
      subscribers[collection] = subscribers[collection].filter((cb) => cb !== callback);
    }
  };
}

// ─────────────────────────────────────────────
// NOTIFICATIONS helpers
// ─────────────────────────────────────────────
async function markNotificationRead(id) {
  try {
    await notificationService.markAsRead(id);
  } catch (_) {}
  const current = Array.isArray(cache.notifications) ? cache.notifications : [];
  const updated = current.map((n) => (n.id === id ? { ...n, is_read: true, read: true } : n));
  cache.notifications = updated;
  notifySubscribers('notifications', updated);
  return updated;
}

async function markAllNotificationsRead() {
  try {
    await notificationService.markAllAsRead();
  } catch (_) {}
  const current = Array.isArray(cache.notifications) ? cache.notifications : [];
  const updated = current.map((n) => ({ ...n, is_read: true, read: true }));
  cache.notifications = updated;
  notifySubscribers('notifications', updated);
  return updated;
}

// ─────────────────────────────────────────────
// WEBSITE CONTENT helper
// ─────────────────────────────────────────────
async function updateWebsiteSection(section, data) {
  const { error } = await supabase
    .from('website_content')
    .upsert({ section, data, updated_at: new Date().toISOString() }, { onConflict: 'section' });
  if (error) console.error('Website content update error:', error);

  const current = cache.website_content && typeof cache.website_content === 'object' ? cache.website_content : {};
  const updated = { ...current, [section]: data };
  notifySubscribers('website_content', updated);
}

// ─────────────────────────────────────────────
// SETTINGS helper
// ─────────────────────────────────────────────
async function updateSetting(key, value) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) console.error('Settings update error:', error);

  const current = cache.settings && typeof cache.settings === 'object' ? cache.settings : {};
  const updated = { ...current, [key]: value };
  notifySubscribers('settings', updated);
}

// ─────────────────────────────────────────────
// REAL-TIME SUBSCRIPTIONS (Debounced & Idempotent)
// ─────────────────────────────────────────────
const realtimeDebounceTimers = {};
const activeRealtimeChannels = {};
function enableRealtime(collections = ['appointments', 'clients', 'orders', 'payments', 'inquiries', 'notifications', 'activity_logs']) {
  collections.forEach((collection) => {
    const table = TABLE_MAP[collection];
    if (!table) return;

    if (activeRealtimeChannels[collection]) {
      try {
        supabase.removeChannel(activeRealtimeChannels[collection]);
      } catch (_) {}
      delete activeRealtimeChannels[collection];
    }

    try {
      const channel = supabase
        .channel(`rt_${collection}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
          // Instant reactive handler for notifications (0ms UI latency)
          if (collection === 'notifications') {
            if (payload.eventType === 'INSERT' && payload.new) {
              const newNotif = normalizeNotification(payload.new);
              if (!isStaticNotification(newNotif)) {
                const current = Array.isArray(cache.notifications) ? cache.notifications : [];
                const deduped = deduplicateNotifications([newNotif, ...current]);
                deduped.sort((a, b) => {
                  const timeA = new Date(a.created_at || a.createdAt || a.timestamp || a.date || 0).getTime();
                  const timeB = new Date(b.created_at || b.createdAt || b.timestamp || b.date || 0).getTime();
                  return timeB - timeA;
                });
                cache.notifications = deduped;
                saveToStorage('notifications', deduped);
                notifySubscribers('notifications', deduped);
              }
            } else if (payload.eventType === 'UPDATE' && payload.new) {
              const updatedNotif = normalizeNotification(payload.new);
              const current = Array.isArray(cache.notifications) ? cache.notifications : [];
              const updated = current.map((n) => (n.id === updatedNotif.id ? { ...n, ...updatedNotif } : n));
              cache.notifications = updated;
              saveToStorage('notifications', updated);
              notifySubscribers('notifications', updated);
            } else if (payload.eventType === 'DELETE' && payload.old) {
              const current = Array.isArray(cache.notifications) ? cache.notifications : [];
              const filtered = current.filter((n) => n.id !== payload.old.id);
              cache.notifications = filtered;
              saveToStorage('notifications', filtered);
              notifySubscribers('notifications', filtered);
            }
          }

          // If an event occurs on appointments, orders, payments, inquiries, or patients, also refresh notifications
          if (['appointments', 'orders', 'payments', 'inquiries', 'clients'].includes(collection)) {
            setTimeout(() => {
              fetchAll('notifications', { forceFresh: true });
            }, 500);
          }

          // Authoritative reconciliation fetch
          if (realtimeDebounceTimers[collection]) {
            clearTimeout(realtimeDebounceTimers[collection]);
          }
          realtimeDebounceTimers[collection] = setTimeout(() => {
            fetchAll(collection, { forceFresh: true });
          }, 350);
        })
        .subscribe();

      activeRealtimeChannels[collection] = channel;
    } catch (_) {}
  });
}

// ─────────────────────────────────────────────
// UPCOMING APPOINTMENTS (Single Source of Truth)
// ─────────────────────────────────────────────
async function fetchUpcomingAppointments() {
  const allAppointments = await fetchAll('appointments');
  return getUpcomingAppointments(allAppointments);
}

// ─────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────
export const supabaseDataService = {
  sanitizeCacheData,
  normalizePayment,
  normalizeInquiry,
  fetchAll,
  fetchUpcomingAppointments,
  getUpcomingAppointments,
  isAppointmentUpcoming,
  createItem,
  updateItem,
  deleteItem,
  subscribe,
  notifySubscribers,
  markNotificationRead,
  markAllNotificationsRead,
  updateWebsiteSection,
  updateSetting,
  enableRealtime,
  getCachedData,
  invalidateCache,
};

