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
  providers: 'providers',
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
      let query = supabase.from(table).select('*');

      // Special ordering for specific tables
      if (collection === 'appointments') query = query.order('date', { ascending: false });
      else if (collection === 'notifications') query = query.order('created_at', { ascending: false });
      else if (collection === 'categories') query = query.order('name', { ascending: true });
      else if (collection === 'website_content') {
        const { data, error } = await query;
        if (error) {
          console.error(`Supabase fetch error [${collection}]:`, error);
          return cache[collection] || {};
        }
        const obj = {};
        (data || []).forEach((row) => { obj[row.section] = row.data; });
        notifySubscribers(collection, obj);
        return obj;
      } else if (collection === 'settings') {
        const { data, error } = await query;
        if (error) {
          console.error(`Supabase fetch error [${collection}]:`, error);
          return cache[collection] || {};
        }
        const obj = {};
        (data || []).forEach((row) => { obj[row.key] = row.value; });
        notifySubscribers(collection, obj);
        return obj;
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;
      if (error) {
        console.error(`Supabase fetch error [${collection}]:`, error);
        // Fall back to memory or localStorage cache if available
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
  const payload = { ...rest, updated_at: new Date().toISOString() };

  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) {
    console.error(`Supabase create error [${collection}]:`, error);
    throw error;
  }

  // Update in-memory cache directly without full table refetch
  const currentList = Array.isArray(cache[collection]) ? cache[collection] : [];
  const updatedList = [data, ...currentList.filter((x) => x.id !== data.id)];
  notifySubscribers(collection, updatedList);

  return data;
}

// ─────────────────────────────────────────────
// UPDATE (Optimistic + Direct Cache Update)
// ─────────────────────────────────────────────
async function updateItem(collection, id, updates) {
  const table = TABLE_MAP[collection];
  if (!table) return null;

  const payload = { ...updates, updated_at: new Date().toISOString() };
  delete payload.id;

  const { data, error } = await supabase
    .from(table)
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error(`Supabase update error [${collection}]:`, error);
    throw error;
  }

  // Update in-memory cache directly
  const currentList = Array.isArray(cache[collection]) ? cache[collection] : [];
  const updatedList = currentList.map((item) => (item.id === id ? { ...item, ...data } : item));
  notifySubscribers(collection, updatedList);

  return data;
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
