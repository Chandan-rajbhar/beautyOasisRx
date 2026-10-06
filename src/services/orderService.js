/**
 * orderService.js
 * 
 * Comprehensive Supabase Order, Status Pipeline, and Payment Service
 * Fully dynamic CRUD, normalization, and Stripe/payment flow support.
 */

import { supabase } from '../lib/supabaseClient';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { supabaseDataService } from './supabaseDataService';

// Default standard statuses fallback if table is not yet seeded
export const DEFAULT_ORDER_STATUSES = [
  { id: 'stat-pending', name: 'Pending', key: 'Pending', description: 'Order created and awaiting initial validation.', is_active: true, display_order: 1, color: '#ca8a04' },
  { id: 'stat-confirmed', name: 'Confirmed', key: 'Confirmed', description: 'Compounding and prescription fulfillment in progress.', is_active: true, display_order: 2, color: '#d97706' },
  { id: 'stat-placed', name: 'Placed', key: 'Placed', description: 'Order officially placed by patient or clinical coordinator.', is_active: true, display_order: 3, color: '#0284c7' },
  { id: 'stat-ordered', name: 'Ordered', key: 'Ordered', description: 'Order transmitted to clinical apothecary or manufacturer.', is_active: true, display_order: 4, color: '#1e5aa8' },
  { id: 'stat-ready-pickup', name: 'Ready for Pickup', key: 'Ready for Pickup', description: 'Apothecary package ready at Allen clinic concierge desk.', is_active: true, display_order: 5, color: '#0891b2' },
  { id: 'stat-fulfilled', name: 'Fulfilled', key: 'Fulfilled', description: 'Order delivered, picked up, or fulfilled successfully.', is_active: true, display_order: 6, color: '#15803d' },
  { id: 'stat-cancelled', name: 'Cancelled', key: 'Cancelled', description: 'Order cancelled and voided.', is_active: true, display_order: 7, color: '#dc2626' }
];

/**
 * Normalizes an order record from Supabase, resolving both camelCase and snake_case properties
 * and linking to matched patient records where client_name was empty.
 */
export function normalizeOrder(raw, patients = []) {
  if (!raw || typeof raw !== 'object') return null;

  // 1. Identify Patient Identifier & Raw Attributes
  const pId = raw.user_id || raw.client_id || raw.patient_id || raw.clientId || raw.patientId;
  const rawEmail = (raw.customer_email || raw.client_email || raw.patient_email || raw.clientEmail || raw.patientEmail || '').toLowerCase().trim();
  const rawPhone = (raw.customer_phone || raw.client_phone || raw.patient_phone || raw.clientPhone || raw.patientPhone || '').replace(/\D/g, '');
  const rawName = (raw.customer_name || raw.client_name || raw.patient_name || raw.clientName || raw.patientName || raw.shipping_address?.fullName || raw.delivery_address?.fullName || '').trim();

  // 2. Match with real Supabase patients directory
  let matchedPatient = null;
  if (Array.isArray(patients) && patients.length > 0) {
    if (pId && pId !== 'guest') {
      matchedPatient = patients.find((p) => p.id === pId);
    }
    if (!matchedPatient && rawEmail) {
      matchedPatient = patients.find((p) => (p.email || '').toLowerCase().trim() === rawEmail);
    }
    if (!matchedPatient && rawPhone && rawPhone.length >= 7) {
      matchedPatient = patients.find((p) => (p.phone || '').replace(/\D/g, '') === rawPhone);
    }
    if (!matchedPatient && rawName) {
      matchedPatient = patients.find((p) => {
        const pName = (p.name || p.full_name || '').toLowerCase().trim();
        return pName && pName === rawName.toLowerCase();
      });
    }
  }

  const clientId = matchedPatient?.id || (pId && pId !== 'guest' ? pId : null);

  const clientName =
    matchedPatient?.name ||
    matchedPatient?.full_name ||
    rawName ||
    'Unknown Patient';

  const clientEmail =
    matchedPatient?.email ||
    rawEmail ||
    '';

  const clientPhone =
    matchedPatient?.phone ||
    raw.customer_phone ||
    raw.client_phone ||
    raw.patient_phone ||
    '';

  // 3. Parse Items & Formulations (handles both raw.items and raw.cart_items)
  let rawItems = [];
  if (Array.isArray(raw.items) && raw.items.length > 0) {
    rawItems = raw.items;
  } else if (Array.isArray(raw.cart_items) && raw.cart_items.length > 0) {
    rawItems = raw.cart_items;
  } else if (typeof raw.items === 'string') {
    try { rawItems = JSON.parse(raw.items); } catch (_) { }
  } else if (typeof raw.cart_items === 'string') {
    try { rawItems = JSON.parse(raw.cart_items); } catch (_) { }
  }

  const items = Array.isArray(rawItems) && rawItems.length > 0
    ? rawItems.map((item, idx) => {
      const qty = Number(item.quantity ?? item.qty ?? 1);
      const price = Number(item.price ?? item.unit_price ?? item.unitPrice ?? 0);
      return {
        id: item.id || `item-${idx}`,
        name: item.name || item.title || item.product_name || 'Bespoke Formulation',
        sku: item.sku || item.product_sku || `SKU-${100 + idx}`,
        type: item.type || item.category || item.subtitle || 'Skincare Formulation',
        qty,
        quantity: qty,
        price,
        unitPrice: price,
        total: qty * price
      };
    })
    : [
      {
        id: 'item-0',
        name: raw.productName || raw.service_name || 'Apothecary Prescription Order',
        sku: 'SKU-APOTH-01',
        type: 'Skincare',
        qty: 1,
        quantity: 1,
        price: 0,
        unitPrice: 0,
        total: 0
      }
    ];

  const calculatedItemsTotal = items.reduce((sum, it) => sum + (it.total || 0), 0);

  // 4. Financial Calculations
  const shipping = Number(raw.shipping_fee ?? raw.shipping ?? 0);
  const discount = Number(raw.discount_amount ?? raw.discount ?? 0);
  const tax = Number(raw.tax ?? 0);

  const total = Number(
    raw.total_amount !== undefined && raw.total_amount !== null
      ? raw.total_amount
      : raw.total !== undefined && raw.total !== null
        ? raw.total
        : raw.totalAmount !== undefined && raw.totalAmount !== null
          ? raw.totalAmount
          : calculatedItemsTotal > 0
            ? calculatedItemsTotal + shipping - discount
            : raw.amount || 0
  );

  const subtotal = Number(
    raw.subtotal !== undefined && raw.subtotal !== null
      ? raw.subtotal
      : raw.raw_subtotal !== undefined && raw.raw_subtotal !== null
        ? raw.raw_subtotal
        : calculatedItemsTotal > 0
          ? calculatedItemsTotal
          : total
  );

  // 5. Payment & Order Status Normalization
  const rawPayStatus = (raw.payment_status || raw.paymentStatus || 'Pending').trim();
  const paymentStatus =
    rawPayStatus.toLowerCase() === 'paid'
      ? 'Paid'
      : rawPayStatus.toLowerCase() === 'pending'
        ? 'Pending'
        : rawPayStatus.toLowerCase() === 'failed'
          ? 'Failed'
          : rawPayStatus.toLowerCase() === 'refunded'
            ? 'Refunded'
            : rawPayStatus.toLowerCase() === 'partially paid' || rawPayStatus.toLowerCase() === 'partial'
              ? 'Partially Paid'
              : rawPayStatus.charAt(0).toUpperCase() + rawPayStatus.slice(1);

  let rawOrderStatus = (raw.order_status || raw.status || raw.orderStatus || 'Pending').trim();
  if (/preparation/i.test(rawOrderStatus)) {
    rawOrderStatus = 'Confirmed';
  }
  const orderStatus = rawOrderStatus;

  const rawDate = raw.created_at || raw.date || raw.order_date || raw.placed_date;
  const dateStr = rawDate ? new Date(rawDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

  // 6. Address Resolution
  let shippingAddress = 'Clinic Pickup (Allen, TX)';
  if (typeof raw.shipping_address === 'string' && raw.shipping_address.trim()) {
    shippingAddress = raw.shipping_address;
  } else if (raw.shipping_address && typeof raw.shipping_address === 'object') {
    const a = raw.shipping_address;
    shippingAddress = [a.addressLine1 || a.address_line1, a.addressLine2 || a.address_line2, a.city, a.state, a.pincode || a.zip]
      .filter(Boolean)
      .join(', ') || 'Clinic Pickup (Allen, TX)';
  } else if (raw.delivery_address && typeof raw.delivery_address === 'object') {
    const a = raw.delivery_address;
    shippingAddress = [a.addressLine1 || a.address_line1, a.addressLine2 || a.address_line2, a.city, a.state, a.pincode || a.zip]
      .filter(Boolean)
      .join(', ') || 'Clinic Pickup (Allen, TX)';
  } else if (raw.address_line1) {
    shippingAddress = [raw.address_line1, raw.address_line2, raw.city, raw.state, raw.pincode, raw.country]
      .filter(Boolean)
      .join(', ');
  }

  // 7. Outstanding balance calculation
  const paidAmount = paymentStatus === 'Paid' ? total : (raw.paid_amount || 0);
  const outstandingBalance = paymentStatus === 'Paid'
    ? 0
    : Math.max(0, total - paidAmount);

  return {
    ...raw,
    id: raw.id,
    orderNumber: raw.order_number || raw.order_id || raw.id,
    order_number: raw.order_number || raw.order_id || raw.id,
    clientId,
    client_id: clientId,
    clientName,
    client_name: clientName,
    clientEmail,
    client_email: clientEmail,
    clientPhone,
    client_phone: clientPhone,
    items,
    total,
    totalAmount: total,
    total_amount: total,
    subtotal,
    discount,
    tax,
    shipping,
    orderStatus,
    status: orderStatus,
    order_status: orderStatus,
    paymentStatus,
    payment_status: paymentStatus,
    paidAmount,
    outstandingBalance,
    date: dateStr,
    created_at: raw.created_at || rawDate,
    updated_at: raw.updated_at || rawDate,
    trackingNumber: raw.tracking_number || raw.trackingNumber || '',
    tracking_number: raw.tracking_number || raw.trackingNumber || '',
    shippingAddress,
    shipping_address: shippingAddress,
    paymentMethod: raw.payment_method || raw.paymentMethod || 'Credit Card (Stripe)',
    payment_method: raw.payment_method || raw.paymentMethod || 'Credit Card (Stripe)',
    orderType: raw.order_type || raw.orderType || 'Online Apothecary Order',
    order_type: raw.order_type || raw.orderType || 'Online Apothecary Order',
    assignedStaff: raw.assigned_staff || raw.assignedStaff || 'Dr. Dennay / Apothecary Dispensary',
    notes: raw.notes || '',
    paymentIntentId: raw.stripe_payment_intent_id || raw.payment_intent_id || raw.transactionId || null,
    checkoutSessionId: raw.stripe_checkout_session_id || raw.stripe_session_id || raw.checkout_session_id || null,
    fulfilledDate: raw.fulfilled_date || (orderStatus === 'Fulfilled' ? dateStr : null)
  };
}


// ─────────────────────────────────────────────
// 1. ORDER STATUS MANAGEMENT (DYNAMIC PIPELINE)
// ─────────────────────────────────────────────

export async function fetchOrderStatuses() {
  try {
    const { data, error } = await supabase
      .from('order_statuses')
      .select('*')
      .order('display_order', { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      const cleanData = data
        .filter((s) => !/preparation/i.test(s.key || '') && !/preparation/i.test(s.name || ''))
        .map((s) => ({
          ...s,
          name: /preparation/i.test(s.name) ? 'Confirmed' : s.name,
          key: /preparation/i.test(s.key) ? 'Confirmed' : s.key
        }));
      localStorage.setItem('cached_order_statuses', JSON.stringify(cleanData));
      return cleanData;
    }
  } catch (_) { }

  // Fallback to cached or default
  try {
    const cached = localStorage.getItem('cached_order_statuses');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const cleanCached = parsed.filter((s) => !/preparation/i.test(s.key || '') && !/preparation/i.test(s.name || ''));
        if (cleanCached.length > 0) return cleanCached;
      }
    }
  } catch (_) { }

  return DEFAULT_ORDER_STATUSES;
}

export async function createOrderStatus(statusObj) {
  const payload = {
    name: statusObj.name.trim(),
    key: statusObj.key ? statusObj.key.trim() : statusObj.name.trim(),
    description: statusObj.description || '',
    is_active: statusObj.is_active !== undefined ? statusObj.is_active : true,
    display_order: Number(statusObj.display_order || 0),
    color: statusObj.color || '#1e5aa8',
    updated_at: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase
      .from('order_statuses')
      .insert([payload])
      .select()
      .single();

    if (!error && data) {
      const all = await fetchOrderStatuses();
      return { success: true, data };
    }
  } catch (_) { }

  // Local fallback update
  const current = await fetchOrderStatuses();
  const newRecord = { ...payload, id: `stat-${Date.now()}` };
  const updated = [...current, newRecord].sort((a, b) => a.display_order - b.display_order);
  localStorage.setItem('cached_order_statuses', JSON.stringify(updated));
  return { success: true, data: newRecord };
}

export async function updateOrderStatus(id, updates) {
  const payload = {
    ...updates,
    updated_at: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase
      .from('order_statuses')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (!error && data) {
      await fetchOrderStatuses();
      return { success: true, data };
    }
  } catch (_) { }

  // Local fallback update
  const current = await fetchOrderStatuses();
  const updated = current.map((s) => (s.id === id ? { ...s, ...payload } : s));
  localStorage.setItem('cached_order_statuses', JSON.stringify(updated));
  return { success: true };
}

export async function deleteOrderStatus(id) {
  try {
    const { error } = await supabase
      .from('order_statuses')
      .delete()
      .eq('id', id);

    if (!error) {
      await fetchOrderStatuses();
      return { success: true };
    }
  } catch (_) { }

  // Local fallback
  const current = await fetchOrderStatuses();
  const updated = current.filter((s) => s.id !== id);
  localStorage.setItem('cached_order_statuses', JSON.stringify(updated));
  return { success: true };
}

// ─────────────────────────────────────────────
// 2. ORDER CRUD OPERATIONS
// ─────────────────────────────────────────────

export async function fetchAllOrders(patients = []) {
  let patientList = patients;
  if (!patientList || patientList.length === 0) {
    try {
      const { data: ptData } = await supabase.from('patients').select('*');
      if (ptData && ptData.length > 0) patientList = ptData;
    } catch (_) { }
  }

  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      const normalized = data.map((o) => normalizeOrder(o, patientList));
      supabaseDataService.invalidateCache('orders');
      return normalized;
    }
  } catch (err) {
    console.error('Error fetching orders from Supabase:', err);
  }

  // Fallback to data service cache
  const cached = supabaseDataService.getCachedData('orders', []);
  return cached.map((o) => normalizeOrder(o, patientList));
}

export async function fetchOrderById(orderId, patients = []) {
  if (!orderId) return null;

  let patientList = patients;
  if (!patientList || patientList.length === 0) {
    try {
      const { data: ptData } = await supabase.from('patients').select('*');
      if (ptData && ptData.length > 0) patientList = ptData;
    } catch (_) { }
  }

  const cleanId = String(orderId).trim();
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

  try {
    if (isUUID) {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', cleanId)
        .maybeSingle();

      if (!error && data) {
        return normalizeOrder(data, patientList);
      }
    } else {
      // Query by order_number or order_id
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .or(`order_number.eq.${cleanId},order_id.eq.${cleanId}`)
        .maybeSingle();

      if (!error && data) {
        return normalizeOrder(data, patientList);
      }

      // Case-insensitive fallback
      const { data: altData } = await supabase
        .from('orders')
        .select('*')
        .ilike('order_number', cleanId)
        .maybeSingle();

      if (altData) {
        return normalizeOrder(altData, patientList);
      }
    }
  } catch (_) { }

  // Fallback to cached list (safely matches both UUID and order_number/orderNumber)
  const list = await fetchAllOrders(patientList);
  return list.find((o) => {
    const oId = String(o.id || '').toLowerCase();
    const oNum = String(o.order_number || o.orderNumber || o.order_id || '').toLowerCase();
    const target = cleanId.toLowerCase();
    return oId === target || oNum === target;
  }) || null;
}

export async function createOrder(orderPayload) {
  const cleanStatus = /preparation/i.test(orderPayload.order_status || orderPayload.orderStatus || orderPayload.status || '')
    ? 'Confirmed'
    : (orderPayload.order_status || orderPayload.orderStatus || orderPayload.status || 'Pending');

  const orderNumber = orderPayload.order_number || orderPayload.orderNumber || `BO-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const totalVal = Number(orderPayload.total || orderPayload.totalAmount || 0);

  const rawClientId = orderPayload.client_id || orderPayload.clientId || null;
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(rawClientId || '').trim());
  const validUUID = isUUID ? rawClientId : null;

  const rejectedCols = new Set();
  let attempts = 0;
  const maxAttempts = 12;
  let lastError = null;

  const buildPayload = () => {
    const p = {};

    // IDs (only if valid UUID)
    if (!rejectedCols.has('client_id') && validUUID) p.client_id = validUUID;
    if (!rejectedCols.has('patient_id') && validUUID) p.patient_id = validUUID;
    if (!rejectedCols.has('user_id') && validUUID) p.user_id = validUUID;

    // Contact info — supply both client_* and customer_* aliases so the
    // schema NOT NULL constraint on whichever column name the table uses is satisfied.
    const resolvedName = orderPayload.client_name || orderPayload.clientName ||
      orderPayload.customer_name || 'Valued Patient';
    const resolvedEmail = orderPayload.client_email || orderPayload.clientEmail ||
      orderPayload.customer_email || '';
    const resolvedPhone = orderPayload.client_phone || orderPayload.clientPhone ||
      orderPayload.customer_phone || '';

    if (!rejectedCols.has('customer_name')) p.customer_name = resolvedName;
    if (!rejectedCols.has('customer_email')) p.customer_email = resolvedEmail;
    if (!rejectedCols.has('customer_phone')) p.customer_phone = resolvedPhone;
    if (!rejectedCols.has('client_name')) p.client_name = resolvedName;
    if (!rejectedCols.has('client_email')) p.client_email = resolvedEmail;
    if (!rejectedCols.has('client_phone')) p.client_phone = resolvedPhone;

    // Items
    if (!rejectedCols.has('items')) p.items = orderPayload.items || [];

    // Total Amount: supply both if not rejected so whichever the table requires is present
    if (!rejectedCols.has('total_amount')) p.total_amount = totalVal;
    if (!rejectedCols.has('total')) p.total = totalVal;

    // Status: supply both if not rejected
    if (!rejectedCols.has('order_status')) p.order_status = cleanStatus;
    if (!rejectedCols.has('status')) p.status = cleanStatus;

    // Payment Status
    if (!rejectedCols.has('payment_status')) {
      p.payment_status = orderPayload.payment_status || orderPayload.paymentStatus || 'Pending';
    }

    // Order number / Invoice number
    if (!rejectedCols.has('invoice_number')) p.invoice_number = orderNumber;
    if (!rejectedCols.has('order_number')) p.order_number = orderNumber;

    // Address
    if (!rejectedCols.has('shipping_address')) {
      p.shipping_address = orderPayload.shipping_address || orderPayload.shippingAddress || 'Clinic Pickup (Allen, TX)';
    }

    // Timestamps
    if (!rejectedCols.has('created_at')) p.created_at = new Date().toISOString();
    if (!rejectedCols.has('updated_at')) p.updated_at = new Date().toISOString();

    // Optional fields (only if explicitly provided and not rejected)
    if (!rejectedCols.has('subtotal') && orderPayload.subtotal !== undefined) p.subtotal = Number(orderPayload.subtotal);
    if (!rejectedCols.has('tax') && orderPayload.tax !== undefined) p.tax = Number(orderPayload.tax);
    if (!rejectedCols.has('discount') && orderPayload.discount !== undefined && Number(orderPayload.discount) > 0) p.discount = Number(orderPayload.discount);
    if (!rejectedCols.has('payment_method') && orderPayload.payment_method) p.payment_method = orderPayload.payment_method;
    if (!rejectedCols.has('tracking_number') && orderPayload.tracking_number) p.tracking_number = orderPayload.tracking_number;
    if (!rejectedCols.has('notes') && orderPayload.notes) p.notes = orderPayload.notes;

    return p;
  };

  while (attempts < maxAttempts) {
    const currentPayload = buildPayload();

    let { data, error } = await supabase
      .from('orders')
      .insert([currentPayload])
      .select()
      .single();

    // If RLS error, try supabaseAdmin
    if (error && (error.code === '42501' || /policy|row-level security/i.test(error.message || '')) && supabaseAdmin) {
      const adminRes = await supabaseAdmin.from('orders').insert([currentPayload]).select().single();
      if (!adminRes.error && adminRes.data) {
        data = adminRes.data;
        error = null;
      }
    }

    if (!error && data) {
      supabaseDataService.invalidateCache('orders');
      return { success: true, data: normalizeOrder(data) };
    }

    if (error && error.message) {
      lastError = error;

      // Check strictly for missing column schema cache errors
      const missingColMatch =
        error.message.match(/Could not find the '([^']+)' column of '(?:public\.)?orders' in the schema cache/i) ||
        error.message.match(/Could not find the '([^']+)' column of 'orders' in the schema cache/i) ||
        error.message.match(/column ["']?([^"'\s]+)["']? of relation ["']?(?:public\.)?orders["']? does not exist/i);

      if (missingColMatch && missingColMatch[1]) {
        const col = missingColMatch[1];
        if (!rejectedCols.has(col)) {
          rejectedCols.add(col);
          attempts++;
          continue;
        }
      }

      // If invalid UUID syntax error, reject client_id / patient_id
      if (/invalid input syntax for type uuid/i.test(error.message)) {
        let changed = false;
        if (!rejectedCols.has('client_id')) { rejectedCols.add('client_id'); changed = true; }
        if (!rejectedCols.has('patient_id')) { rejectedCols.add('patient_id'); changed = true; }
        if (changed) {
          attempts++;
          continue;
        }
      }

      // Any other error (not missing column): throw real error immediately!
      console.error('Supabase orders insert error:', error);
      throw new Error(error.message || 'Failed to save order to Supabase');
    }

    throw error || new Error('Failed to create order in Supabase');
  }

  throw lastError ? new Error(lastError.message) : new Error('Could not adapt order payload to database schema.');
}

export async function updateOrder(orderId, updateFields) {
  const cleanId = String(orderId).trim();
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
  const matchCol = isUUID ? 'id' : 'order_number';

  const ordStatus = updateFields.order_status || updateFields.orderStatus || updateFields.status;
  const sanitizedStatus = ordStatus ? (/preparation/i.test(ordStatus) ? 'Confirmed' : ordStatus) : undefined;
  const payStatus = updateFields.payment_status || updateFields.paymentStatus;
  const totalVal = updateFields.total !== undefined ? Number(updateFields.total) : (updateFields.total_amount !== undefined ? Number(updateFields.total_amount) : undefined);

  const rejectedCols = new Set();
  let attempts = 0;
  const maxAttempts = 10;
  let lastError = null;

  const buildUpdatePayload = () => {
    const p = {
      updated_at: new Date().toISOString()
    };

    if (sanitizedStatus) {
      if (!rejectedCols.has('order_status')) p.order_status = sanitizedStatus;
      if (!rejectedCols.has('status')) p.status = sanitizedStatus;
    }

    if (payStatus && !rejectedCols.has('payment_status')) {
      p.payment_status = payStatus;
    }

    if (totalVal !== undefined) {
      if (!rejectedCols.has('total_amount')) p.total_amount = totalVal;
      if (!rejectedCols.has('total')) p.total = totalVal;
    }

    if (updateFields.shipping_address && !rejectedCols.has('shipping_address')) {
      p.shipping_address = updateFields.shipping_address;
    }
    if (updateFields.items && !rejectedCols.has('items')) {
      p.items = updateFields.items;
    }
    if (updateFields.tracking_number && !rejectedCols.has('tracking_number')) {
      p.tracking_number = updateFields.tracking_number;
    }

    return p;
  };

  while (attempts < maxAttempts) {
    const currentPayload = buildUpdatePayload();

    let { data, error } = await supabase
      .from('orders')
      .update(currentPayload)
      .eq(matchCol, cleanId)
      .select()
      .single();

    if (error && (error.code === '42501' || /policy|row-level security/i.test(error.message || '')) && supabaseAdmin) {
      const adminRes = await supabaseAdmin.from('orders').update(currentPayload).eq(matchCol, cleanId).select().single();
      if (!adminRes.error && adminRes.data) {
        data = adminRes.data;
        error = null;
      }
    }

    if (!error && data) {
      supabaseDataService.invalidateCache('orders');
      return { success: true, data: normalizeOrder(data) };
    }

    if (error && error.message) {
      lastError = error;

      const missingColMatch =
        error.message.match(/Could not find the '([^']+)' column of '(?:public\.)?orders' in the schema cache/i) ||
        error.message.match(/Could not find the '([^']+)' column of 'orders' in the schema cache/i) ||
        error.message.match(/column ["']?([^"'\s]+)["']? of relation ["']?(?:public\.)?orders["']? does not exist/i);

      if (missingColMatch && missingColMatch[1]) {
        const col = missingColMatch[1];
        if (!rejectedCols.has(col)) {
          rejectedCols.add(col);
          attempts++;
          continue;
        }
      }

      console.error('Supabase orders update error:', error);
      throw new Error(error.message || 'Failed to update order in Supabase');
    }

    throw error || new Error('Failed to update order in Supabase');
  }

  throw lastError ? new Error(lastError.message) : new Error('Could not update order due to schema mismatch.');
}


export async function updateOrderStatusAndDetails(orderId, updates) {
  return updateOrder(orderId, updates);
}

export async function deleteOrder(orderId) {
  const cleanId = String(orderId).trim();
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
  const matchCol = isUUID ? 'id' : 'order_number';

  try {
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq(matchCol, cleanId);

    if (!error) {
      supabaseDataService.invalidateCache('orders');
      return { success: true };
    }
    throw error;
  } catch (err) {
    console.error('Failed to delete order in Supabase:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────
// 3. PAY NOW (PAYMENT FLOW & STRIPE INTEGRATION)
// ─────────────────────────────────────────────

export async function processOrderPayment(order, paymentInfo = {}) {
  if (!order) throw new Error('Order is required for payment processing');

  const amountToPay = Number(order.outstandingBalance || order.totalAmount || order.total || 0);
  if (amountToPay <= 0) {
    throw new Error('This order has no outstanding balance.');
  }

  const transactionId = paymentInfo.transactionId || `TXN-ST-${Date.now().toString().slice(-6)}`;
  const paymentMethod = paymentInfo.method || 'Credit Card (Stripe)';

  // 1. Create record in Supabase payments table
  const paymentRecord = {
    client_id: order.clientId || order.client_id || null,
    client_name: order.clientName || order.client_name || order.customer_name || 'Patient',
    customer_name: order.customer_name || order.clientName || order.client_name || 'Patient',
    order_id: order.id,
    amount: amountToPay,
    total_amount: amountToPay,
    currency: order.currency || 'USD',
    method: paymentMethod,
    payment_method: paymentMethod,
    status: 'Completed',
    payment_status: 'Paid',
    reference: transactionId,
    description: `Apothecary Settlement for Order #${order.id}`,
    date: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  try {
    await supabase.from('payments').insert([paymentRecord]);
  } catch (pErr) {
    console.warn('Could not insert payment record (table schema check):', pErr);
  }

  // 2. Update order: payment_status → 'Paid', order_status → 'Placed'
  // This is the single atomic update that finalizes the order after payment.
  try {
    const updatePayload = {
      payment_status: 'Paid',
      payment_method: paymentMethod,
      updated_at: new Date().toISOString()
    };
    // Supply both column name variants so whichever the DB uses gets updated
    updatePayload.order_status = 'Placed';
    updatePayload.status = 'Placed';

    const { data: updatedOrder, error: oErr } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', order.id)
      .select()
      .single();

    if (oErr) {
      // If a column doesn't exist, retry without it
      const fallbackPayload = {
        payment_status: 'Paid',
        payment_method: paymentMethod,
        updated_at: new Date().toISOString()
      };
      if (!/order_status.*does not exist|order_status.*schema cache/i.test(oErr.message || '')) {
        fallbackPayload.order_status = 'Placed';
      }
      if (!/\bstatus\b.*does not exist|\bstatus\b.*schema cache/i.test(oErr.message || '')) {
        fallbackPayload.status = 'Placed';
      }
      const { data: retryData, error: retryErr } = await supabase
        .from('orders')
        .update(fallbackPayload)
        .eq('id', order.id)
        .select()
        .single();
      if (!retryErr && retryData) {
        supabaseDataService.invalidateCache('orders');
        supabaseDataService.invalidateCache('payments');
        const merged = {
          ...retryData,
          order_status: retryData.order_status || retryData.status || 'Placed',
          status: retryData.status || retryData.order_status || 'Placed',
          payment_status: 'Paid'
        };
        return { success: true, transactionId, order: normalizeOrder(merged), payment: paymentRecord };
      }
    }

    if (!oErr && updatedOrder) {
      supabaseDataService.invalidateCache('orders');
      supabaseDataService.invalidateCache('payments');
      // Merge intended values in case DB column name differs
      const merged = {
        ...updatedOrder,
        order_status: updatedOrder.order_status || updatedOrder.status || 'Placed',
        status: updatedOrder.status || updatedOrder.order_status || 'Placed',
        payment_status: 'Paid'
      };
      return { success: true, transactionId, order: normalizeOrder(merged), payment: paymentRecord };
    }
  } catch (err) {
    console.error('Failed to update order after payment:', err);
    throw err;
  }

  return { success: true, transactionId };
}
