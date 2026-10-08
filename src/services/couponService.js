/**
 * couponService.js
 *
 * Dedicated, resilient Supabase service for the BeautyOasis Coupons Module:
 * - Dynamic CRUD directly against Supabase `coupons` table
 * - Dual-layer support for both `supabase` and `supabaseAdmin` clients
 * - Resilient column schema auto-adaptor (supports `code` / `coupon_code`, `discount_type` / `type`, etc.)
 * - Auto-generation of unique, clinical-luxury coupon codes with Supabase collision validation
 * - Dynamic status evaluation (Active, Inactive, Expired, Exhausted)
 */

import { supabase } from '../lib/supabaseClient';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { supabaseDataService } from './supabaseDataService';

/**
 * Normalizes a raw Supabase coupon record into standard UI model
 */
export function normalizeCoupon(item) {
  if (!item || typeof item !== 'object') return item;

  const code = String(item.code || item.coupon_code || '').trim().toUpperCase();
  const rawType = String(item.discount_type || item.type || (item.discount_percent ? 'percentage' : 'fixed')).toLowerCase();
  const discountType = rawType.includes('percent') ? 'percentage' : 'fixed';

  const discountValue = Number(
    item.discount_value !== undefined && item.discount_value !== null
      ? item.discount_value
      : item.discount_amount !== undefined && item.discount_amount !== null
        ? item.discount_amount
        : item.discount_percent !== undefined && item.discount_percent !== null
          ? item.discount_percent
          : item.discount || 0
  );

  const minOrderAmount = Number(
    item.min_order_amount !== undefined && item.min_order_amount !== null
      ? item.min_order_amount
      : item.min_spend !== undefined && item.min_spend !== null
        ? item.min_spend
        : item.minimum_spend || 0
  );

  const usageLimit = item.usage_limit !== undefined && item.usage_limit !== null
    ? Number(item.usage_limit)
    : item.max_uses !== undefined && item.max_uses !== null
      ? Number(item.max_uses)
      : null;

  const usageCount = Number(
    item.usage_count !== undefined && item.usage_count !== null
      ? item.usage_count
      : item.times_used !== undefined && item.times_used !== null
        ? item.times_used
        : item.usage || 0
  );

  const rawStatus = (item.status || 'Active').trim();
  const rawStatusLower = rawStatus.toLowerCase();
  const startDate = item.start_date || item.created_at || null;
  const expiryDate = item.expiry_date || item.end_date || item.expires_at || null;

  // Compute live status — manual Inactive overrides auto-computed states
  let computedStatus;
  const isPastExpiry = expiryDate && new Date(expiryDate).getTime() < Date.now();
  const isExhausted = usageLimit !== null && usageLimit > 0 && usageCount >= usageLimit;

  if (rawStatusLower === 'inactive') {
    computedStatus = 'Inactive';
  } else if (isPastExpiry) {
    computedStatus = 'Expired';
  } else if (isExhausted) {
    computedStatus = 'Exhausted';
  } else {
    computedStatus = 'Active';
  }

  return {
    ...item,
    id: item.id || `cpn-${Date.now()}`,
    code,
    coupon_code: code,
    description: item.description || item.title || '',
    discount_type: discountType,
    type: discountType,
    discount_value: discountValue,
    discount_amount: discountType === 'fixed' ? discountValue : null,
    discount_percent: discountType === 'percentage' ? discountValue : null,
    min_order_amount: minOrderAmount,
    min_spend: minOrderAmount,
    usage_limit: usageLimit,
    max_uses: usageLimit,
    usage_count: usageCount,
    times_used: usageCount,
    status: computedStatus,
    raw_status: rawStatus,
    start_date: startDate,
    expiry_date: expiryDate,
    end_date: expiryDate,
    created_at: item.created_at || new Date().toISOString(),
    updated_at: item.updated_at || new Date().toISOString(),
  };
}

/**
 * Helper: Extract missing column name from any PostgREST or PostgreSQL error string
 */
function extractMissingColumn(errorMessage) {
  if (!errorMessage || typeof errorMessage !== 'string') return null;
  const m1 = errorMessage.match(/Could not find the '([^']+)' column/i);
  if (m1 && m1[1]) return m1[1];
  const m2 = errorMessage.match(/column "([^"]+)" of relation/i);
  if (m2 && m2[1]) return m2[1];
  const m3 = errorMessage.match(/column "([^"]+)" does not exist/i);
  if (m3 && m3[1]) return m3[1];
  const m4 = errorMessage.match(/column '([^']+)' does not exist/i);
  if (m4 && m4[1]) return m4[1];
  return null;
}

/**
 * Fetch all coupons from Supabase
 */
export async function fetchCoupons() {
  try {
    let res = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (res.error) {
      // Try admin client
      const adminRes = await supabaseAdmin
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });

      if (!adminRes.error && Array.isArray(adminRes.data)) {
        return adminRes.data.map(normalizeCoupon);
      }

      // Check if table missing
      if (res.error.code === 'PGRST205' || res.error.message?.includes('schema cache') || res.error.message?.includes('does not exist')) {
        console.warn('[Coupons] Table "coupons" does not exist in Supabase yet. Please execute create_coupons_table.sql in Supabase SQL editor.');
        const cached = supabaseDataService.getCachedData('coupons', []);
        return cached.map(normalizeCoupon);
      }

      throw res.error;
    }

    return (res.data || []).map(normalizeCoupon);
  } catch (err) {
    console.error('[couponService] Error fetching coupons:', err);
    const cached = supabaseDataService.getCachedData('coupons', []);
    return cached.map(normalizeCoupon);
  }
}

/**
 * Check if a coupon code already exists in Supabase
 */
export async function checkCodeExists(candidateCode, excludeId = null) {
  if (!candidateCode || !candidateCode.trim()) return false;
  const cleanCode = candidateCode.trim().toUpperCase();

  try {
    let query = supabase
      .from('coupons')
      .select('id, code')
      .ilike('code', cleanCode);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;
    if (!error && Array.isArray(data) && data.length > 0) {
      return true;
    }

    // Secondary check with column `coupon_code` in case that's the primary schema column
    const { data: altData, error: altErr } = await supabase
      .from('coupons')
      .select('id, coupon_code')
      .ilike('coupon_code', cleanCode);

    if (!altErr && Array.isArray(altData) && altData.length > 0) {
      if (!excludeId || altData.some(d => d.id !== excludeId)) {
        return true;
      }
    }

    // Also check cached coupons for offline / optimistic safety
    const cached = supabaseDataService.getCachedData('coupons', []);
    if (Array.isArray(cached) && cached.some(c => {
      const cCode = String(c.code || c.coupon_code || '').trim().toUpperCase();
      return cCode === cleanCode && (!excludeId || String(c.id) !== String(excludeId));
    })) {
      return true;
    }

    return false;
  } catch (_) {
    return false;
  }
}

/**
 * Auto-generate a unique coupon code and check against Supabase
 */
export async function generateUniqueCouponCode(options = {}) {
  const {
    prefix = 'OASIS',
    discountValue = null,
    discountType = 'percentage',
    existingList = []
  } = options;

  const existingSet = new Set(
    existingList.map(c => String(c.code || c.coupon_code || '').toUpperCase().trim()).filter(Boolean)
  );

  const cleanPrefix = (prefix || 'OASIS').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  for (let attempt = 0; attempt < 30; attempt++) {
    let candidate = '';
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const randomNum = Math.floor(1000 + Math.random() * 9000);

    if (attempt === 0 && discountValue && Number(discountValue) > 0) {
      candidate = `${cleanPrefix}-${Number(discountValue)}${discountType === 'percentage' ? 'OFF' : 'USD'}`;
    } else if (attempt === 1 && discountValue && Number(discountValue) > 0) {
      candidate = `SAVE${Number(discountValue)}-${randomSuffix.slice(0, 3)}`;
    } else if (attempt % 2 === 0) {
      candidate = `${cleanPrefix}-${randomSuffix}`;
    } else {
      candidate = `${cleanPrefix}-${randomNum}`;
    }

    // 1. In-memory deduplication check
    if (existingSet.has(candidate)) continue;

    // 2. Supabase remote uniqueness check
    const existsInDb = await checkCodeExists(candidate);
    if (!existsInDb) {
      return candidate;
    }
  }

  // Fallback timestamp code
  return `${cleanPrefix}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
}

/**
 * Create a new coupon in Supabase
 */
export async function createCoupon(couponData) {
  const code = String(couponData.code || couponData.coupon_code || '').trim().toUpperCase();
  if (!code) throw new Error('Coupon code is required.');

  // Check uniqueness before insert
  const exists = await checkCodeExists(code);
  if (exists) {
    throw new Error(`Coupon code "${code}" already exists in the database. Please use a unique code.`);
  }

  const now = new Date().toISOString();
  const discValue = Number(couponData.discount_value || couponData.discount_amount || couponData.discount_percent || 0);
  const isPercent = String(couponData.discount_type || couponData.type || 'percentage').toLowerCase().includes('percent');

  // Start with clean, canonical columns
  const payload = {
    code,
    description: couponData.description?.trim() || '',
    discount_type: isPercent ? 'percentage' : 'fixed',
    discount_value: discValue,
    min_order_amount: Number(couponData.min_order_amount ?? 0),
    usage_limit: couponData.usage_limit ? Number(couponData.usage_limit) : null,
    usage_count: Number(couponData.usage_count || 0),
    status: couponData.status || 'Active',
    start_date: couponData.start_date || now,
    expiry_date: couponData.expiry_date || null,
    created_at: now,
    updated_at: now,
  };

  // Resilient column adaptation loop
  let insertResult = null;
  let attempts = 0;
  let lastError = null;
  const sanitized = { ...payload };

  while (attempts < 25) {
    attempts++;
    try {
      // 1. Try with primary logged-in client
      let res = await supabase.from('coupons').insert([sanitized]).select();
      if (!res.error && Array.isArray(res.data) && res.data.length > 0) {
        insertResult = res.data[0];
        break;
      }
      if (!res.error && res.data && !Array.isArray(res.data)) {
        insertResult = res.data;
        break;
      }

      // 2. Try with admin/anon client
      const adminRes = await supabaseAdmin.from('coupons').insert([sanitized]).select();
      if (!adminRes.error && Array.isArray(adminRes.data) && adminRes.data.length > 0) {
        insertResult = adminRes.data[0];
        break;
      }
      if (!adminRes.error && adminRes.data && !Array.isArray(adminRes.data)) {
        insertResult = adminRes.data;
        break;
      }

      const activeErr = res.error || adminRes.error;
      lastError = activeErr;

      if (activeErr) {
        // Duplicate code unique constraint violation
        if (activeErr.code === '23505' || activeErr.message?.includes('duplicate key') || activeErr.message?.includes('unique constraint')) {
          throw new Error(`Coupon code "${code}" already exists in the database. Please use a unique coupon code.`);
        }

        // Table not found or schema cache error -> break to fallback
        if (activeErr.code === 'PGRST205' || activeErr.message?.includes('schema cache') || activeErr.message?.includes('does not exist')) {
          console.warn('[couponService] Table "coupons" does not exist in Supabase yet. Run create_coupons_table.sql in Supabase SQL Editor.');
          break;
        }

        const missingCol = extractMissingColumn(activeErr.message);
        if (missingCol) {
          if (missingCol === 'code' && sanitized.code) {
            sanitized.coupon_code = sanitized.code;
            delete sanitized.code;
            continue;
          }
          if (missingCol === 'discount_type' && sanitized.discount_type) {
            sanitized.type = sanitized.discount_type;
            delete sanitized.discount_type;
            continue;
          }
          if (missingCol === 'status' && sanitized.status) {
            sanitized.is_active = String(sanitized.status).toLowerCase() === 'active';
            delete sanitized.status;
            continue;
          }
          if (missingCol === 'start_date') {
            delete sanitized.start_date;
            continue;
          }
          if (missingCol === 'discount_value') {
            if (isPercent) sanitized.discount_percent = discValue;
            else sanitized.discount_amount = discValue;
            delete sanitized.discount_value;
            continue;
          }
          if (missingCol === 'min_order_amount') {
            sanitized.min_spend = sanitized.min_order_amount;
            delete sanitized.min_order_amount;
            continue;
          }
          if (missingCol === 'expiry_date') {
            sanitized.end_date = sanitized.expiry_date;
            delete sanitized.expiry_date;
            continue;
          }
          if (missingCol === 'usage_limit') {
            sanitized.max_uses = sanitized.usage_limit;
            delete sanitized.usage_limit;
            continue;
          }
          if (missingCol === 'usage_count') {
            sanitized.times_used = sanitized.usage_count;
            delete sanitized.usage_count;
            continue;
          }

          if (sanitized[missingCol] !== undefined) {
            delete sanitized[missingCol];
            continue;
          }
        }

        // If not a column issue, log notice
        console.warn('[couponService] Supabase insert notice:', activeErr.message);
        break;
      }
    } catch (netErr) {
      lastError = netErr;
      console.warn('[couponService] Supabase network notice:', netErr?.message || netErr);
      break;
    }
  }

  // Graceful fallback via supabaseDataService (syncs cache, subscribers, local storage)
  if (!insertResult) {
    try {
      insertResult = await supabaseDataService.createItem('coupons', {
        ...payload,
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cpn-${Date.now()}`
      });
    } catch (_) {}
  }

  if (!insertResult) {
    insertResult = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cpn-${Date.now()}`,
      ...payload,
      created_at: now,
      updated_at: now
    };
  }

  return normalizeCoupon(insertResult);
}

/**
 * Update an existing coupon in Supabase
 */
export async function updateCoupon(id, updates) {
  if (!id) throw new Error('Coupon ID is required for update.');

  const now = new Date().toISOString();
  const isPercent = updates.discount_type !== undefined
    ? String(updates.discount_type).toLowerCase().includes('percent')
    : undefined;

  const discValue = updates.discount_value !== undefined ? Number(updates.discount_value) : undefined;

  const payload = {
    ...updates,
    updated_at: now,
  };

  if (payload.code) {
    payload.code = String(payload.code).trim().toUpperCase();

    // Check duplicate code excluding current coupon
    const exists = await checkCodeExists(payload.code, id);
    if (exists) {
      throw new Error(`Coupon code "${payload.code}" already exists in the database. Please use a unique code.`);
    }
  }

  if (discValue !== undefined) {
    payload.discount_value = discValue;
    if (isPercent !== undefined) {
      payload.discount_type = isPercent ? 'percentage' : 'fixed';
    }
  }

  delete payload.id;

  let updateResult = null;
  let attempts = 0;
  const sanitized = { ...payload };

  while (attempts < 25) {
    attempts++;
    try {
      let res = await supabase
        .from('coupons')
        .update(sanitized)
        .eq('id', id)
        .select();

      if (!res.error && Array.isArray(res.data) && res.data.length > 0) {
        updateResult = res.data[0];
        break;
      }
      if (!res.error && res.data && !Array.isArray(res.data)) {
        updateResult = res.data;
        break;
      }

      // Try supabaseAdmin
      const adminRes = await supabaseAdmin
        .from('coupons')
        .update(sanitized)
        .eq('id', id)
        .select();

      if (!adminRes.error && Array.isArray(adminRes.data) && adminRes.data.length > 0) {
        updateResult = adminRes.data[0];
        break;
      }
      if (!adminRes.error && adminRes.data && !Array.isArray(adminRes.data)) {
        updateResult = adminRes.data;
        break;
      }

      const activeErr = res.error || adminRes.error;
      if (activeErr) {
        if (activeErr.code === '23505' || activeErr.message?.includes('duplicate key') || activeErr.message?.includes('unique constraint')) {
          throw new Error(`Coupon code "${sanitized.code || payload.code || ''}" already exists in the database. Please use a unique coupon code.`);
        }

        const missingCol = extractMissingColumn(activeErr.message);
        if (missingCol) {
          if (missingCol === 'code' && sanitized.code) {
            sanitized.coupon_code = sanitized.code;
            delete sanitized.code;
            continue;
          }
          if (missingCol === 'discount_type' && sanitized.discount_type) {
            sanitized.type = sanitized.discount_type;
            delete sanitized.discount_type;
            continue;
          }
          if (missingCol === 'status' && sanitized.status) {
            sanitized.is_active = String(sanitized.status).toLowerCase() === 'active';
            delete sanitized.status;
            continue;
          }
          if (missingCol === 'start_date') {
            delete sanitized.start_date;
            continue;
          }
          if (missingCol === 'discount_value' && sanitized.discount_value !== undefined) {
            if (isPercent) sanitized.discount_percent = discValue;
            else sanitized.discount_amount = discValue;
            delete sanitized.discount_value;
            continue;
          }
          if (missingCol === 'min_order_amount' && sanitized.min_order_amount !== undefined) {
            sanitized.min_spend = sanitized.min_order_amount;
            delete sanitized.min_order_amount;
            continue;
          }
          if (missingCol === 'expiry_date' && sanitized.expiry_date !== undefined) {
            sanitized.end_date = sanitized.expiry_date;
            delete sanitized.expiry_date;
            continue;
          }
          if (missingCol === 'usage_limit' && sanitized.usage_limit !== undefined) {
            sanitized.max_uses = sanitized.usage_limit;
            delete sanitized.usage_limit;
            continue;
          }
          if (missingCol === 'usage_count' && sanitized.usage_count !== undefined) {
            sanitized.times_used = sanitized.usage_count;
            delete sanitized.usage_count;
            continue;
          }
          if (sanitized[missingCol] !== undefined) {
            delete sanitized[missingCol];
            continue;
          }
        }
        break;
      }
    } catch (_) {
      break;
    }
  }

  // Graceful fallback via supabaseDataService
  if (!updateResult) {
    try {
      updateResult = await supabaseDataService.updateItem('coupons', id, sanitized);
    } catch (_) {}
  }

  if (!updateResult) {
    updateResult = {
      id,
      ...sanitized
    };
  }

  return normalizeCoupon(updateResult);
}

/**
 * Toggle coupon status between 'Active' and 'Inactive'
 * Directly updates Supabase and re-fetches to confirm the change.
 */
export async function toggleCouponStatus(id, currentStatus) {
  if (!id) throw new Error('Coupon ID is required.');

  const newStatus = String(currentStatus).toLowerCase() === 'active' ? 'Inactive' : 'Active';
  const now = new Date().toISOString();

  // Try primary client first
  let res = await supabase
    .from('coupons')
    .update({ status: newStatus, updated_at: now })
    .eq('id', id)
    .select();

  // Fallback to admin client
  if (res.error || !res.data || res.data.length === 0) {
    const adminRes = await supabaseAdmin
      .from('coupons')
      .update({ status: newStatus, updated_at: now })
      .eq('id', id)
      .select();

    if (!adminRes.error && adminRes.data && adminRes.data.length > 0) {
      return normalizeCoupon(adminRes.data[0]);
    }

    // If update returned no rows (RLS returning=minimal), do a fresh fetch
    const fetchRes = await supabase.from('coupons').select('*').eq('id', id).single();
    if (!fetchRes.error && fetchRes.data) {
      return normalizeCoupon(fetchRes.data);
    }

    const fetchAdmin = await supabaseAdmin.from('coupons').select('*').eq('id', id).single();
    if (!fetchAdmin.error && fetchAdmin.data) {
      return normalizeCoupon(fetchAdmin.data);
    }

    // If all Supabase attempts fail, throw with a clear message
    throw new Error(
      res.error?.message || adminRes.error?.message || 'Failed to update coupon status in Supabase.'
    );
  }

  return normalizeCoupon(res.data[0]);
}

/**
 * Delete a coupon permanently from Supabase
 */
export async function deleteCoupon(id) {
  if (!id) throw new Error('Coupon ID is required for deletion.');

  let res = await supabase.from('coupons').delete().eq('id', id);
  if (res.error) {
    const adminRes = await supabaseAdmin.from('coupons').delete().eq('id', id);
    if (adminRes.error) {
      try {
        await supabaseDataService.deleteItem('coupons', id);
        return true;
      } catch (_) {
        throw adminRes.error;
      }
    }
  }

  try {
    await supabaseDataService.deleteItem('coupons', id);
  } catch (_) {}

  return true;
}
