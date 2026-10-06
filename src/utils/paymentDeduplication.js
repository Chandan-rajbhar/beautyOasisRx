/**
 * Robust deduplication of patient payment records.
 * Ensures the same transaction appears only once across database payments,
 * order synthesis, Stripe intents, and appointment payment records.
 *
 * @param {Array} payments - Raw or synthesized payment records
 * @param {Array} orders - Patient orders for canonical ID linking
 * @param {Array} appointments - Patient appointments for canonical ID linking
 * @returns {Array} Deduplicated payments array
 */
export function deduplicatePatientPayments(payments, orders = [], appointments = []) {
  if (!Array.isArray(payments) || payments.length === 0) return [];

  // 1. Build canonical key mapping for orders: maps every identifier -> canonical entity key
  const orderCanonicalMap = new Map();
  orders.forEach((ord) => {
    if (!ord) return;
    const canonicalKey = 'order_' + String(ord.id || ord.order_number || ord.orderNumber || '').toLowerCase().trim();
    const allIds = [
      ord.id,
      ord.order_number,
      ord.orderNumber,
      ord.invoice_number,
      ord.invoiceNumber,
      ord.stripe_payment_intent_id,
      ord.stripePaymentIntentId,
      ord.stripe_session_id,
      ord.stripeSessionId
    ].filter(Boolean).map((s) => String(s).toLowerCase().trim());

    allIds.forEach((id) => orderCanonicalMap.set(id, canonicalKey));
  });

  // 2. Build canonical key mapping for appointments
  const apptCanonicalMap = new Map();
  appointments.forEach((apt) => {
    if (!apt) return;
    const canonicalKey = 'appt_' + String(apt.id || '').toLowerCase().trim();
    const allIds = [
      apt.id,
      apt.stripe_payment_intent_id,
      apt.stripePaymentIntentId,
      apt.stripe_checkout_session_id
    ].filter(Boolean).map((s) => String(s).toLowerCase().trim());

    allIds.forEach((id) => apptCanonicalMap.set(id, canonicalKey));
  });

  // 3. Prioritize real database/Stripe payments over synthetic fallback objects (pay-ord-*, pay-apt-*)
  const prioritized = [...payments].sort((a, b) => {
    const aIsSynth = String(a.id || '').startsWith('pay-ord-') || String(a.id || '').startsWith('pay-apt-');
    const bIsSynth = String(b.id || '').startsWith('pay-ord-') || String(b.id || '').startsWith('pay-apt-');
    if (aIsSynth && !bIsSynth) return 1;
    if (!aIsSynth && bIsSynth) return -1;

    const aHasStripe = Boolean(a.stripe_payment_intent_id || (a.transactionId && String(a.transactionId).startsWith('pi_')));
    const bHasStripe = Boolean(b.stripe_payment_intent_id || (b.transactionId && String(b.transactionId).startsWith('pi_')));
    if (!aHasStripe && bHasStripe) return 1;
    if (aHasStripe && !bHasStripe) return -1;

    return 0;
  });

  const seenTxnIds = new Set();
  const seenCanonicalEntities = new Set();
  const deduplicated = [];

  for (const p of prioritized) {
    if (!p) continue;

    // --- Check 1: Stripe / Transaction ID deduplication ---
    const rawTxn =
      p.stripe_payment_intent_id ||
      p.stripePaymentIntentId ||
      p.transactionId ||
      p.transaction_id ||
      p.reference;
    const cleanTxn =
      rawTxn && typeof rawTxn === 'string' && !rawTxn.startsWith('TXN-N/A')
        ? rawTxn.trim().toLowerCase()
        : null;

    // --- Check 2: Canonical entity (order or appointment) deduplication ---
    const pOrderId = p.order_id || p.orderId;
    const cleanOrderId = pOrderId ? String(pOrderId).trim().toLowerCase() : null;
    const orderKey = cleanOrderId
      ? orderCanonicalMap.get(cleanOrderId) || `order_${cleanOrderId}`
      : cleanTxn
        ? orderCanonicalMap.get(cleanTxn) || null
        : null;

    const pApptId = p.appointment_id || p.appointmentId;
    const cleanApptId = pApptId ? String(pApptId).trim().toLowerCase() : null;
    const apptKey = cleanApptId
      ? apptCanonicalMap.get(cleanApptId) || `appt_${cleanApptId}`
      : cleanTxn
        ? apptCanonicalMap.get(cleanTxn) || null
        : null;

    const entityKey = orderKey || apptKey;

    // Skip if this Stripe transaction ID was already recorded
    if (cleanTxn && seenTxnIds.has(cleanTxn)) {
      continue;
    }

    // Skip if this order/appointment payment was already recorded
    if (entityKey && seenCanonicalEntities.has(entityKey)) {
      continue;
    }

    if (cleanTxn) seenTxnIds.add(cleanTxn);
    if (entityKey) seenCanonicalEntities.add(entityKey);

    // Resolve the authoritative amount: prefer total_amount over amount
    const resolvedAmt = Number(p.total_amount ?? p.amount ?? p.raw_subtotal ?? p.totalAmount ?? 0);
    deduplicated.push({
      ...p,
      amount: resolvedAmt,
      total_amount: resolvedAmt
    });
  }

  // Sort newest-first
  return deduplicated.sort((a, b) => {
    const dateA = a.date || a.created_at || '';
    const dateB = b.date || b.created_at || '';
    return String(dateB).localeCompare(String(dateA));
  });
}
