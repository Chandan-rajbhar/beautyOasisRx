import React from 'react';
import { StripeCheckoutModal } from '../stripe/StripeCheckoutModal';

/**
 * Apothecary Order Stripe Payment Modal
 * Powered by Supabase Edge Functions & Real Stripe.js Elements
 */
export const StripeOrderPaymentModal = ({
  isOpen,
  onClose,
  order,
  onPaymentSuccess
}) => {
  return (
    <StripeCheckoutModal
      isOpen={isOpen}
      onClose={onClose}
      recordType="order"
      record={order}
      onPaymentSuccess={onPaymentSuccess}
    />
  );
};

export default StripeOrderPaymentModal;
