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
  users: 'users',
  website_content: 'website_content',
  settings: 'settings',
};

// Cache TTL: 45 seconds for active queries
const CACHE_TTL_MS = 45 * 1000;

// In-memory cache, timestamps, in-flight promises, and subscribers
const cache = {};
const cacheTimestamps = {};
const inFlightRequests = {};
const subscribers = {};

// Helper: load initial cache from localStorage if present
function loadFromStorage(collection) {
  try {
    const raw = localStorage.getItem(`bo_cache_${collection}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (Array.isArray(parsed) || typeof parsed === 'object')) {
        cache[collection] = parsed;
        cacheTimestamps[collection] = Date.now() - (CACHE_TTL_MS / 2); // Warm cache
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
      localStorage.setItem(`bo_cache_${collection}`, JSON.stringify(data));
    }
  } catch (_) {}
}

// Notify subscribers of state changes
function notifySubscribers(collection, data) {
  cache[collection] = data;
  cacheTimestamps[collection] = Date.now();
  saveToStorage(collection, data);

  if (subscribers[collection]) {
    subscribers[collection].forEach((cb) => {
      try {
        cb(data);
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
        const apptRes = await supabase.from('appointments').select('*').order('created_at', { ascending: false });
        if (apptRes.error) {
          const fallbackRes = await supabase.from('appointments').select('*');
          if (fallbackRes.error) {
            error = fallbackRes.error;
          } else {
            data = (fallbackRes.data || []).map(normalizeAppointment);
          }
        } else {
          data = (apptRes.data || []).map(normalizeAppointment);
        }
      } else {
        let query = supabase.from(table).select('*');
        if (collection === 'notifications') query = query.order('created_at', { ascending: false });
        else if (collection === 'categories') query = query.order('name', { ascending: true });
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
      }

      if (error) {
        console.error(`Supabase fetch error [${collection}]:`, error);
        return getCachedData(collection, []);
      }

      const result = data || [];
      notifySubscribers(collection, result);
      return result;
    } catch (err) {
      console.error(`Supabase network error [${collection}]:`, err);
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
  let payload = { ...rest, updated_at: new Date().toISOString() };

  let insertResult = null;
  let attempts = 0;
  while (attempts < 5) {
    attempts++;
    try {
      const { data, error } = await supabase.from(table).insert(payload).select().single();
      if (!error && data) {
        insertResult = data;
        break;
      }
      if (error) {
        const match = error.message && error.message.match(/Could not find the '([^']+)' column/i);
        if (match && match[1] && payload[match[1]] !== undefined) {
          delete payload[match[1]];
          continue;
        }
        console.warn(`Supabase create notice [${collection}]:`, error.message);
        break;
      }
    } catch (netErr) {
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

  const normalized = collection === 'appointments' ? normalizeAppointment(insertResult) : insertResult;
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

  let payload = { ...updates, updated_at: new Date().toISOString() };
  delete payload.id;

  let updateResult = null;
  let attempts = 0;
  while (attempts < 5) {
    attempts++;
    try {
      const { data, error } = await supabase
        .from(table)
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (!error && data) {
        updateResult = data;
        break;
      }
      if (error) {
        const match = error.message && error.message.match(/Could not find the '([^']+)' column/i);
        if (match && match[1] && payload[match[1]] !== undefined) {
          delete payload[match[1]];
          continue;
        }
        console.warn(`Supabase update notice [${collection}]:`, error.message);
        break;
      }
    } catch (netErr) {
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

  const normalized = collection === 'appointments' ? normalizeAppointment(updateResult) : updateResult;
  const currentList = Array.isArray(cache[collection]) ? cache[collection] : [];
  const updatedList = currentList.map((item) => (item.id === id ? { ...item, ...normalized } : item));
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

  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) {
    console.error(`Supabase delete error [${collection}]:`, error);
    throw error;
  }

  // Update in-memory cache directly
  const currentList = Array.isArray(cache[collection]) ? cache[collection] : [];
  const updatedList = currentList.filter((item) => item.id !== id);
  notifySubscribers(collection, updatedList);

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
  return updateItem('notifications', id, { is_read: true });
}

async function markAllNotificationsRead() {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false);
  if (error) console.error('Mark all notifications read error:', error);

  const current = Array.isArray(cache.notifications) ? cache.notifications : [];
  const updated = current.map((n) => ({ ...n, is_read: true, read: true }));
  notifySubscribers('notifications', updated);
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
// REAL-TIME SUBSCRIPTIONS (Debounced)
// ─────────────────────────────────────────────
const realtimeDebounceTimers = {};
function enableRealtime(collections = ['appointments', 'clients', 'inquiries', 'notifications']) {
  collections.forEach((collection) => {
    const table = TABLE_MAP[collection];
    if (!table) return;

    supabase
      .channel(`realtime:${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        if (realtimeDebounceTimers[collection]) {
          clearTimeout(realtimeDebounceTimers[collection]);
        }
        realtimeDebounceTimers[collection] = setTimeout(() => {
          fetchAll(collection, { forceFresh: true });
        }, 350);
      })
      .subscribe();
  });
}

// ─────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────
export const supabaseDataService = {
  fetchAll,
  createItem,
  updateItem,
  deleteItem,
  subscribe,
  markNotificationRead,
  markAllNotificationsRead,
  updateWebsiteSection,
  updateSetting,
  enableRealtime,
  getCachedData,
  invalidateCache,
};
