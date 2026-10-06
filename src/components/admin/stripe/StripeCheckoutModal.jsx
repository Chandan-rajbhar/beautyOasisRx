import React, { useState, useEffect } from 'react';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import {
  CreditCard,
  Lock,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  Calendar,
  User,
  Package,
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminModal } from '../ui/AdminModal';
import { AdminButton } from '../ui/AdminButton';
import { stripePromise, createPaymentIntent, verifyPaymentIntent } from '../../../services/stripeService';
import { supabaseDataService } from '../../../services/supabaseDataService';

/**
 * Inner Stripe payment form (requires Elements context)
 */
const StripePaymentForm = ({
  recordType,
  record,
  amount,
  formattedAmount,
  clientSecret,
  paymentIntentId,
  onSuccess,
  onCancel,
  customerName,
  customerEmail
}) => {
  const stripe = useStripe();
  const elements = useElements();

  const [cardholderName, setCardholderName] = useState(customerName || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setErrorMessage('Stripe.js has not initialized yet. Please wait a moment.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setProcessingStatus('Validating card details with Stripe...');

    try {
      // 1. Submit Elements to validate card inputs
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setErrorMessage(submitError.message || 'Please complete all required card fields.');
        setIsProcessing(false);
        return;
      }

      setProcessingStatus('Authorizing payment with 256-bit Stripe encryption...');

      // 2. Confirm payment on client with Stripe using clientSecret
      const result = await stripe.confirmPayment({
        elements,
        clientSecret,
        redirect: 'if_required',
        confirmParams: {
          return_url: window.location.href,
          payment_method_data: {
            billing_details: {
              name: cardholderName || customerName || 'Valued Patient',
              email: customerEmail || undefined
            }
          }
        }
      });

      if (result.error) {
        console.error('Stripe payment confirmation failed:', result.error);
        setErrorMessage(result.error.message || 'Payment declined. Your card was not charged.');
        setIsProcessing(false);
        return;
      }

      if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
        setProcessingStatus('Verifying payment settlement with Supabase server...');

        // 3. Server-side verification via Supabase Edge Function
        // Never mark an appointment/order as Paid purely from client-side assertion
        const verifyRes = await verifyPaymentIntent({
          paymentIntentId: result.paymentIntent.id,
          recordType,
          recordId: record.id
        });

        if (!verifyRes.verified && verifyRes.status !== 'succeeded') {
          throw new Error(verifyRes.message || 'Server-side payment verification could not be completed.');
        }

        // 4. Update local cache and notify listeners
        const collection = recordType === 'appointment' ? 'appointments' : 'orders';
        const updatePayload = {
          payment_status: 'Paid',
          paymentStatus: 'Paid',
          stripe_payment_intent_id: result.paymentIntent.id,
          updated_at: new Date().toISOString()
        };

        if (recordType === 'order') {
          updatePayload.order_status = 'Placed';
          updatePayload.status = 'Placed';
          updatePayload.outstandingBalance = 0;
        }

        try {
          await supabaseDataService.updateItem(collection, record.id, updatePayload);
          supabaseDataService.invalidateCache(collection);
          supabaseDataService.invalidateCache('payments');
        } catch (syncErr) {
          console.warn('Local cache sync notification (non-blocking):', syncErr);
        }

        toast.success(`Payment of ${formattedAmount} verified via Stripe!`);

        onSuccess({
          paymentIntent: result.paymentIntent,
          amount,
          last4: result.paymentIntent.payment_method?.card?.last4 || '4242',
          date: new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        });
      } else {
        setErrorMessage(`Payment status: ${result.paymentIntent?.status || 'Processing'}. Please check your payment details.`);
        setIsProcessing(false);
      }
    } catch (err) {
      console.error('Payment error:', err);
      setErrorMessage(err.message || 'Payment processing failed. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Error alert banner */}
      {errorMessage && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '8px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Cardholder Name */}
      <div className="admin-form-group">
        <label className="admin-form-label" style={{ fontWeight: 600, fontSize: '0.82rem', color: '#334155', marginBottom: '6px' }}>
          Cardholder Name
        </label>
        <input
          type="text"
          className="admin-form-input"
          placeholder="Full Name as shown on card"
          value={cardholderName}
          onChange={(e) => setCardholderName(e.target.value)}
          disabled={isProcessing}
          required
        />
      </div>

      {/* Real Stripe Payment Element */}
      <div className="admin-form-group">
        <label className="admin-form-label" style={{ fontWeight: 600, fontSize: '0.82rem', color: '#334155', marginBottom: '6px' }}>
          Payment Card Details
        </label>
        <div
          style={{
            padding: '14px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: '#ffffff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <PaymentElement
            id="payment-element"
            options={{
              layout: 'tabs',
              defaultValues: {
                billingDetails: {
                  name: cardholderName || customerName || '',
                  email: customerEmail || ''
                }
              }
            }}
          />
        </div>
      </div>

      {/* Processing Status Banner */}
      {isProcessing && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#166534',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
          <span>{processingStatus || 'Processing transaction securely...'}</span>
        </div>
      )}

      {/* Security Badge */}
      <div
        style={{
          padding: '10px 14px',
          borderRadius: '8px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.76rem',
          color: '#64748b'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldCheck size={16} color="#16a34a" />
          <span>PCI-DSS Level 1 Encrypted via Stripe Checkout</span>
        </div>
        <div style={{ fontWeight: 800, color: '#635bff', letterSpacing: '0.5px' }}>
          stripe
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '6px' }}>
        <AdminButton
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isProcessing}
        >
          Cancel
        </AdminButton>
        <AdminButton
          type="submit"
          variant="primary"
          disabled={isProcessing || !stripe || !elements}
          loading={isProcessing}
          icon={<Lock size={15} />}
          style={{ background: '#16a34a', borderColor: '#16a34a' }}
        >
          {isProcessing ? 'Processing...' : `Pay ${formattedAmount} via Stripe`}
        </AdminButton>
      </div>
    </form>
  );
};

/**
 * Top-level Stripe Checkout Modal
 * Manages Payment Intent creation via Supabase Edge Function & renders Stripe Elements
 */
export const StripeCheckoutModal = ({
  isOpen,
  onClose,
  recordType, // 'appointment' | 'order'
  record,
  onPaymentSuccess
}) => {
  const [initLoading, setInitLoading] = useState(false);
  const [initError, setInitError] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [paymentIntentId, setPaymentIntentId] = useState(null);
  const [paymentSuccessData, setPaymentSuccessData] = useState(null);

  // Initialize payment intent on modal open
  useEffect(() => {
    if (!isOpen || !record) {
      setClientSecret(null);
      setPaymentIntentId(null);
      setInitError(null);
      setPaymentSuccessData(null);
      return;
    }

    let isMounted = true;

    async function initIntent() {
      setInitLoading(true);
      setInitError(null);
      setPaymentSuccessData(null);

      // 1. Check if already marked as Paid
      const currentPayStatus = String(record.payment_status || record.paymentStatus || '').toLowerCase();
      if (currentPayStatus === 'paid') {
        setInitError('This item is already marked as Paid in Supabase.');
        setInitLoading(false);
        return;
      }

      // 2. Validate amount > 0
      const amountVal = recordType === 'appointment'
        ? Number(record.price ?? record.amount ?? 0)
        : Number(record.outstandingBalance ?? record.totalAmount ?? record.total ?? 0);

      if (amountVal <= 0) {
        setInitError('Payment amount must be greater than $0.00.');
        setInitLoading(false);
        return;
      }

      try {
        const customerName = recordType === 'appointment'
          ? (record.patient_name || record.client_name || record.clientName)
          : (record.client_name || record.customer_name || record.clientName);

        const customerEmail = recordType === 'appointment'
          ? (record.patient_email || record.client_email || record.clientEmail)
          : (record.client_email || record.customer_email || record.clientEmail);

        // Call Supabase Edge Function: stripe-payment
        const intentRes = await createPaymentIntent({
          recordType,
          recordId: record.id,
          customerEmail,
          customerName
        });

        if (!isMounted) return;

        if (intentRes.isAlreadyPaid) {
          setInitError('This record was already verified as Paid in Stripe.');
          return;
        }

        if (!intentRes.clientSecret) {
          throw new Error('No client secret received from Stripe Payment function.');
        }

        setClientSecret(intentRes.clientSecret);
        setPaymentIntentId(intentRes.paymentIntentId);
      } catch (err) {
        if (!isMounted) return;
        console.error('Failed to initialize Stripe Payment Intent:', err);
        setInitError(err.message || 'Could not connect to Stripe payment service. Please try again.');
      } finally {
        if (isMounted) setInitLoading(false);
      }
    }

    initIntent();

    return () => {
      isMounted = false;
    };
  }, [isOpen, record, recordType]);

  if (!isOpen || !record) return null;

  const rawAmount = recordType === 'appointment'
    ? Number(record.price ?? record.amount ?? 0)
    : Number(record.outstandingBalance ?? record.totalAmount ?? record.total ?? 0);

  const formattedAmount = `$${rawAmount.toFixed(2)}`;

  const customerName = recordType === 'appointment'
    ? (record.patient_name || record.client_name || record.clientName || 'Valued Patient')
    : (record.client_name || record.customer_name || record.clientName || 'Valued Patient');

  const customerEmail = recordType === 'appointment'
    ? (record.patient_email || record.client_email || record.clientEmail || '')
    : (record.client_email || record.customer_email || record.clientEmail || '');

  const titleText = recordType === 'appointment'
    ? (record.protocol_title || record.service_name || record.serviceName || 'Clinical Protocol')
    : `Apothecary Order #${record.order_number || record.orderNumber || (record.id ? record.id.substring(0, 8).toUpperCase() : '')}`;

  const handlePaymentFormSuccess = (successInfo) => {
    setPaymentSuccessData(successInfo);
    if (onPaymentSuccess) {
      const updated = {
        ...record,
        payment_status: 'Paid',
        paymentStatus: 'Paid',
        stripe_payment_intent_id: successInfo.paymentIntent?.id || paymentIntentId
      };
      if (recordType === 'order') {
        updated.order_status = 'Placed';
        updated.status = 'Placed';
        updated.outstandingBalance = 0;
      }
      onPaymentSuccess(updated, successInfo.paymentIntent);
    }
  };

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title={paymentSuccessData ? 'Payment Receipt' : 'Stripe Secure Checkout'}
      maxWidth="560px"
    >
      {paymentSuccessData ? (
        /* ── RECEIPT SCREEN (Server-Verified) ── */
        <div style={{ textAlign: 'center', padding: '16px 8px' }}>
          <div
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              background: '#dcfce7',
              color: '#15803d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 4px 12px rgba(22, 163, 74, 0.15)'
            }}
          >
            <CheckCircle size={38} />
          </div>

          <h3 style={{ margin: '0 0 6px', fontSize: '1.3rem', color: '#0f2942', fontWeight: 700 }}>
            Payment Verified & Completed
          </h3>
          <p style={{ margin: '0 0 20px', fontSize: '0.88rem', color: '#64748b' }}>
            The {recordType === 'appointment' ? 'appointment' : 'order'} has been confirmed as <strong>Paid</strong> in Supabase.
          </p>

          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '18px',
              textAlign: 'left',
              marginBottom: '20px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.88rem' }}>
              <span style={{ color: '#64748b' }}>Total Paid:</span>
              <span style={{ fontWeight: 800, color: '#15803d', fontSize: '1.05rem' }}>
                {formattedAmount} USD
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.84rem' }}>
              <span style={{ color: '#64748b' }}>Customer:</span>
              <span style={{ fontWeight: 600, color: '#0f2942' }}>{customerName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.84rem' }}>
              <span style={{ color: '#64748b' }}>{recordType === 'appointment' ? 'Service' : 'Order'}:</span>
              <span style={{ fontWeight: 600, color: '#1e5aa8' }}>{titleText}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.84rem' }}>
              <span style={{ color: '#64748b' }}>Stripe Intent:</span>
              <span style={{ fontFamily: 'monospace', color: '#0f2942', fontWeight: 600, fontSize: '0.8rem' }}>
                {paymentSuccessData.paymentIntent?.id || paymentIntentId}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
              <span style={{ color: '#64748b' }}>Date & Time:</span>
              <span style={{ color: '#334155' }}>{paymentSuccessData.date}</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <AdminButton variant="primary" onClick={onClose}>
              Done & Return to {recordType === 'appointment' ? 'Appointments' : 'Orders'}
            </AdminButton>
          </div>
        </div>
      ) : (
        /* ── STRIPE CHECKOUT FORM ── */
        <div>
          {/* Summary Box */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '18px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', fontWeight: 700 }}>
                  {recordType === 'appointment' ? 'Clinical Protocol' : 'Apothecary Order'}
                </span>
                <div style={{ fontWeight: 700, color: '#0f2942', fontSize: '1rem', marginTop: '2px' }}>
                  {titleText}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', fontWeight: 700 }}>
                  {recordType === 'appointment' ? 'Total Due' : 'Outstanding Due'}
                </span>
                <div style={{ fontWeight: 800, color: '#15803d', fontSize: '1.28rem', marginTop: '2px' }}>
                  {formattedAmount}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.8rem', color: '#475569', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={13} color="#64748b" />
                <span>{customerName}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {recordType === 'appointment' ? (
                  <>
                    <Calendar size={13} color="#64748b" />
                    <span>{record.date || record.appointment_date || 'Upcoming'} at {record.time || record.appointment_time || 'Scheduled'}</span>
                  </>
                ) : (
                  <>
                    <Package size={13} color="#64748b" />
                    <span>{record.items?.length || 1} line item(s)</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Loading Intent State */}
          {initLoading && (
            <div style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b' }}>
              <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px', color: '#1e5aa8', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontWeight: 600, color: '#0f2942', fontSize: '0.95rem' }}>
                Connecting to Stripe...
              </div>
              <p style={{ fontSize: '0.82rem', margin: '4px 0 0', color: '#64748b' }}>
                Verifying amount via Supabase Edge Function and creating Payment Intent.
              </p>
            </div>
          )}

          {/* Init Error State */}
          {initError && !initLoading && (
            <div style={{ padding: '20px 0' }}>
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '8px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  fontSize: '0.86rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '16px'
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{initError}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <AdminButton variant="secondary" onClick={onClose}>
                  Close
                </AdminButton>
              </div>
            </div>
          )}

          {/* Active Stripe Elements Form */}
          {clientSecret && !initLoading && (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#0f2942',
                    colorBackground: '#ffffff',
                    colorText: '#0f2942',
                    colorDanger: '#b91c1c',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    borderRadius: '8px'
                  }
                }
              }}
            >
              <StripePaymentForm
                recordType={recordType}
                record={record}
                amount={rawAmount}
                formattedAmount={formattedAmount}
                clientSecret={clientSecret}
                paymentIntentId={paymentIntentId}
                onSuccess={handlePaymentFormSuccess}
                onCancel={onClose}
                customerName={customerName}
                customerEmail={customerEmail}
              />
            </Elements>
          )}
        </div>
      )}
    </AdminModal>
  );
};
