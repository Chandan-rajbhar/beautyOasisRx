import { loadStripe } from '@stripe/stripe-js';
import { supabase } from '../lib/supabaseClient';

// Public Stripe Test Key (Safe for client-side frontend initialization)
export const STRIPE_PUBLISHABLE_KEY =
  'pk_test_51TvWuvRqr5Bm8S73DuYSlYSb7VjhqBUP95UymSflLHGv9Ig56M8GOz4hJqdIBB9IvGjLCVks2nNSt7XyaFk2ZYqO00J5XlozJm';

// Singleton Stripe promise for Stripe.js
export const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

const EDGE_FUNCTION_URL = 'https://tuepzwlxgnmtbjijtgta.supabase.co/functions/v1/stripe-payment';

/**
 * Request creation of a Stripe Payment Intent via Supabase Edge Function
 * Never sends or receives the Secret Key. Recalculates amount server-side.
 */
export async function createPaymentIntent({
  recordType,
  recordId,
  customerEmail,
  customerName
}) {
  if (!recordType || !recordId) {
    throw new Error('Record type and Record ID are required to initialize Stripe payment.');
  }

  // First attempt via supabase.functions.invoke
  try {
    const { data, error } = await supabase.functions.invoke('stripe-payment', {
      body: {
        action: 'create-payment-intent',
        recordType,
        recordId,
        customerEmail,
        customerName
      }
    });

    if (!error && data && data.clientSecret) {
      return data;
    }

    if (data?.error) {
      throw new Error(data.error);
    }
    if (error) {
      throw error;
    }
  } catch (fnErr) {
    console.warn('supabase.functions.invoke error, trying direct fetch fallback:', fnErr);
  }

  // Fallback to direct fetch with anon key header
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    },
    body: JSON.stringify({
      action: 'create-payment-intent',
      recordType,
      recordId,
      customerEmail,
      customerName
    })
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json.error || `Payment intent initialization failed (${res.status})`);
  }

  return json;
}

/**
 * Server-side verification of payment intent status via Supabase Edge Function
 * Ensures status is 'succeeded' in Stripe before marking Paid in Supabase.
 */
export async function verifyPaymentIntent({
  paymentIntentId,
  recordType,
  recordId
}) {
  if (!paymentIntentId) {
    throw new Error('Payment Intent ID is required for server verification.');
  }

  try {
    const { data, error } = await supabase.functions.invoke('stripe-payment', {
      body: {
        action: 'verify-payment',
        paymentIntentId,
        recordType,
        recordId
      }
    });

    if (!error && data) {
      return data;
    }
    if (data?.error) {
      throw new Error(data.error);
    }
  } catch (fnErr) {
    console.warn('Edge function invoke verify error, trying direct fetch:', fnErr);
  }

  const res = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    },
    body: JSON.stringify({
      action: 'verify-payment',
      paymentIntentId,
      recordType,
      recordId
    })
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Payment verification failed (${res.status})`);
  }

  return json;
}
