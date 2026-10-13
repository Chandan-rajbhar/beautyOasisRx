/**
 * storageManager.js
 *
 * Centralized, quota-safe storage management for BeautyOasisRx.
 *
 * Handles:
 * 1. Resilient storage adapter for Supabase Auth (with automatic quota recovery,
 *    sessionStorage fallback, and in-memory persistence).
 * 2. Automated purge of non-essential transient caches (image caches, API response caches).
 * 3. Proactive quota checks to guarantee that Admin login is NEVER blocked by QuotaExceededError.
 */

// In-memory fallback map when all browser storage fails
const memoryStore = new Map();

/**
 * Check if an error is a storage quota / full error
 */
export const isStorageQuotaError = (error) => {
  if (!error) return false;
  const message = String(error?.message || error || '').toLowerCase();
  const name = String(error?.name || '').toLowerCase();
  const code = error?.code;

  return (
    name === 'quotaexceedederror' ||
    name === 'ns_error_dom_quota_reached' ||
    code === 22 ||
    code === 1014 ||
    message.includes('quota') ||
    message.includes('exceeded the storage') ||
    message.includes('storage is full') ||
    message.includes('persistent storage limit')
  );
};

/**
 * Determine if a key is a protected authentication / core preference key
 * that must NEVER be deleted during cache cleanup.
 */
const isProtectedKey = (key) => {
  if (!key) return false;
  const lower = key.toLowerCase();

  // Supabase auth tokens (e.g., sb-tuepzwlxgnmtbjijtgta-auth-token)
  if (lower.startsWith('sb-') && lower.includes('auth-token')) return true;
  if (lower === 'supabase.auth.token') return true;

  // Active admin fallback session
  if (lower === 'bo_admin_fallback_session') return true;

  // User UI theme
  if (lower === 'theme' || lower === 'beautyoasis_theme') return true;

  return false;
};

/**
 * Calculate approximate usage of localStorage in bytes
 */
export const getStorageUsageBytes = () => {
  if (typeof window === 'undefined' || !window.localStorage) return 0;
  let total = 0;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key) {
        const val = window.localStorage.getItem(key) || '';
        total += (key.length + val.length) * 2; // UTF-16 characters = ~2 bytes
      }
    }
  } catch (_) {}
  return total;
};

/**
 * Purge non-essential transient caches from localStorage.
 * Keeps Supabase Auth session keys completely safe.
 *
 * @param {Object} options
 * @param {boolean} options.forceAll - If true, clears EVERYTHING except protected auth keys.
 * @returns {{ freedKeys: number, freedBytesApprox: number }}
 */
export const purgeNonEssentialStorage = ({ forceAll = false } = {}) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { freedKeys: 0, freedBytesApprox: 0 };
  }

  let freedKeys = 0;
  let freedBytesApprox = 0;

  try {
    const keysToRemove = [];
    const totalKeys = window.localStorage.length;

    for (let i = 0; i < totalKeys; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;

      // Always protect auth keys!
      if (isProtectedKey(key)) continue;

      if (forceAll) {
        keysToRemove.push(key);
        continue;
      }

      const lowerKey = key.toLowerCase();

      // High-priority cleanup: Image caches & inline photo strings
      const isImageCache =
        lowerKey.startsWith('product_img_') ||
        lowerKey.startsWith('patient_photo_') ||
        lowerKey.startsWith('user_photo_') ||
        lowerKey.startsWith('bo_cache_inline_img_');

      // Medium-priority cleanup: Transient Supabase API response caches
      const isTransientApiCache =
        lowerKey.startsWith('bo_cache_') ||
        lowerKey.startsWith('cached_dynamic_') ||
        lowerKey.startsWith('cached_order_statuses') ||
        lowerKey.startsWith('cached_product_categories') ||
        lowerKey.startsWith('bo_appointment_times_cache') ||
        lowerKey.startsWith('bo_clinicians_cache') ||
        lowerKey.startsWith('bo_treatment_categories_cache') ||
        lowerKey.startsWith('bo_durations_cache') ||
        lowerKey.startsWith('bo_treatment_protocols_cache') ||
        lowerKey.startsWith('patient_status_') ||
        lowerKey.startsWith('msgs_cache_') ||
        lowerKey.startsWith('inquiries_cache');

      // Mock/seed database caches from older dataService
      const isSeedCache = lowerKey.startsWith('beautyoasis_');

      if (isImageCache || isTransientApiCache || isSeedCache) {
        keysToRemove.push(key);
      } else {
        // Check if value is a massive base64 or data image
        try {
          const val = window.localStorage.getItem(key) || '';
          if (val.length > 50000 || /^data:image\//i.test(val)) {
            keysToRemove.push(key);
          }
        } catch (_) {}
      }
    }

    keysToRemove.forEach((key) => {
      try {
        const val = window.localStorage.getItem(key) || '';
        freedBytesApprox += (key.length + val.length) * 2;
        window.localStorage.removeItem(key);
        freedKeys++;
      } catch (_) {}
    });

    console.info(`[StorageManager] Purged ${freedKeys} non-essential storage keys (~${Math.round(freedBytesApprox / 1024)} KB freed).`);
  } catch (err) {
    console.warn('[StorageManager] Error during storage purge:', err);
  }

  return { freedKeys, freedBytesApprox };
};

/**
 * Proactively check if localStorage is near or at quota, and auto-prune if needed.
 */
export const autoPruneStorageIfFull = () => {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    // Test write a small token to verify storage availability
    const testKey = '__bo_quota_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);

    // If usage is high (> 3 MB out of typical 5 MB browser limit), prune proactively
    const usageBytes = getStorageUsageBytes();
    if (usageBytes > 3 * 1024 * 1024) {
      console.warn(`[StorageManager] LocalStorage usage high (${Math.round(usageBytes / 1024)} KB). Running proactive cleanup...`);
      purgeNonEssentialStorage();
    }
  } catch (quotaErr) {
    if (isStorageQuotaError(quotaErr)) {
      console.warn('[StorageManager] LocalStorage test write threw quota error! Executing emergency purge...');
      purgeNonEssentialStorage({ forceAll: true });
    }
  }
};

/**
 * Resilient Storage Adapter for Supabase Auth
 * Conforms to Supabase's SupportedStorage interface: getItem, setItem, removeItem
 */
export const safeSupabaseStorage = {
  getItem: (key) => {
    if (typeof window === 'undefined') return memoryStore.get(key) || null;

    // 1. Try localStorage
    try {
      const val = window.localStorage.getItem(key);
      if (val !== null && val !== undefined) return val;
    } catch (_) {}

    // 2. Try sessionStorage
    try {
      const sessVal = window.sessionStorage?.getItem(key);
      if (sessVal !== null && sessVal !== undefined) return sessVal;
    } catch (_) {}

    // 3. Try in-memory store
    return memoryStore.get(key) || null;
  },

  setItem: (key, value) => {
    if (typeof window === 'undefined') {
      memoryStore.set(key, value);
      return;
    }

    // Always keep an in-memory copy as safety fallback
    memoryStore.set(key, value);

    // Attempt 1: Normal localStorage write
    try {
      window.localStorage.setItem(key, value);
      return;
    } catch (writeErr) {
      console.warn('[SafeSupabaseStorage] localStorage.setItem failed:', writeErr);

      // Attempt 2: Purge non-essential storage and retry localStorage
      try {
        purgeNonEssentialStorage({ forceAll: true });
        window.localStorage.setItem(key, value);
        console.info('[SafeSupabaseStorage] Saved to localStorage after purging non-essential cache.');
        return;
      } catch (retryErr) {
        console.warn('[SafeSupabaseStorage] Retry to localStorage failed. Falling back to sessionStorage...', retryErr);

        // Attempt 3: Gracefully save to sessionStorage
        try {
          if (window.sessionStorage) {
            window.sessionStorage.setItem(key, value);
            console.info('[SafeSupabaseStorage] Session successfully saved to sessionStorage.');
            return;
          }
        } catch (sessErr) {
          console.warn('[SafeSupabaseStorage] sessionStorage also failed. Using in-memory session only.', sessErr);
        }
      }
    }
  },

  removeItem: (key) => {
    memoryStore.delete(key);
    if (typeof window === 'undefined') return;

    try { window.localStorage.removeItem(key); } catch (_) {}
    try { window.sessionStorage?.removeItem(key); } catch (_) {}
  },
};

// Run proactive prune on load
if (typeof window !== 'undefined') {
  try {
    autoPruneStorageIfFull();
  } catch (_) {}
}
