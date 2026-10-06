import React from 'react';
import { StripeCheckoutModal } from '../stripe/StripeCheckoutModal';

/**
 * Appointment Stripe Payment Modal
 * Powered by Supabase Edge Functions & Real Stripe.js Elements
 */
export const StripePaymentModal = ({
  isOpen,
  onClose,
  appointment,
  onPaymentSuccess
}) => {
  return (
    <StripeCheckoutModal
      isOpen={isOpen}
      onClose={onClose}
      recordType="appointment"
      record={appointment}
      onPaymentSuccess={onPaymentSuccess}
    />
  );
};

export default StripePaymentModal;
