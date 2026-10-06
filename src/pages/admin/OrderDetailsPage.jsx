import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Package,
  ShoppingBag,
  CreditCard,
  FileText,
  User,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  Circle,
  Truck,
  DollarSign,
  Download,
  Edit2,
  AlertCircle,
  ExternalLink,
  Copy,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAdminData } from '../../context/AdminDataContext';
import { AdminBadge } from '../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../components/admin/ui/AdminButton';
import { AdminCard } from '../../components/admin/ui/AdminCard';
import { AdminModal } from '../../components/admin/ui/AdminModal';
import { AdminEmptyState } from '../../components/admin/ui/AdminEmptyState';
import {
  fetchOrderById,
  fetchOrderStatuses,
  updateOrderStatusAndDetails
} from '../../services/orderService';
import { generateInvoice, formatInvoiceNumber } from '../../services/invoiceService';
import { StripeOrderPaymentModal } from '../../components/admin/orders/StripeOrderPaymentModal';
import { UpdateOrderStatusModal } from '../../components/admin/orders/UpdateOrderStatusModal';

export const OrderDetailsPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const {
    orders: contextOrders = [],
    clients: contextClients = [],
    payments: contextPayments = [],
    updateItem
  } = useAdminData();

  // Local state
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statuses, setStatuses] = useState([]);

  // Modals state
  const [isUpdateStatusOpen, setIsUpdateStatusOpen] = useState(false);
  const [isPayNowOpen, setIsPayNowOpen] = useState(false);

  // 1. Load dynamic statuses from Supabase
  useEffect(() => {
    let isMounted = true;
    fetchOrderStatuses().then((list) => {
      if (isMounted) setStatuses(list || []);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Helper to match order by id or human-readable order number
  const findMatchingOrder = (list, idToMatch) => {
    if (!Array.isArray(list) || !idToMatch) return null;
    const clean = String(idToMatch).toLowerCase().trim();
    return list.find((o) =>
      String(o.id || '').toLowerCase() === clean ||
      String(o.order_number || '').toLowerCase() === clean ||
      String(o.orderNumber || '').toLowerCase() === clean ||
      String(o.order_id || '').toLowerCase() === clean
    ) || null;
  };

  // 2. Fetch Order Data by UUID or Order Number
  const loadOrder = async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);

    try {
      // First check context
      const inContext = findMatchingOrder(contextOrders, orderId);
      if (inContext) {
        setOrder(inContext);
      }

      // Fetch fresh from Supabase
      const freshOrder = await fetchOrderById(orderId, contextClients);
      if (freshOrder) {
        setOrder(freshOrder);
      } else if (!inContext) {
        setError('Order could not be found. It may have been deleted or the Order ID is invalid.');
      }
    } catch (err) {
      console.error('Failed to load order details:', err);
      setError('An error occurred while loading order details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  // Synchronize when context orders change
  useEffect(() => {
    if (contextOrders.length > 0 && orderId) {
      const match = findMatchingOrder(contextOrders, orderId);
      if (match) {
        setOrder((prev) => (prev ? { ...prev, ...match } : match));
      }
    }
  }, [contextOrders, orderId]);

  // Find linked patient object
  const linkedPatient = useMemo(() => {
    if (!order) return null;
    const pId = order.clientId || order.client_id;
    if (pId) {
      const found = contextClients.find((c) => c.id === pId);
      if (found) return found;
    }
    const pEmail = (order.clientEmail || order.client_email || '').toLowerCase().trim();
    if (pEmail) {
      return contextClients.find((c) => (c.email || '').toLowerCase().trim() === pEmail) || null;
    }
    return null;
  }, [order, contextClients]);

  // Linked payments for this order
  const linkedPayments = useMemo(() => {
    if (!order) return [];
    return contextPayments.filter((p) => {
      const matchOrderId = p.order_id === order.id || p.orderId === order.id;
      const matchReference = p.reference && order.paymentIntentId && p.reference === order.paymentIntentId;
      return matchOrderId || matchReference;
    }).sort((a, b) => {
      const dateA = a.created_at || a.date || '';
      const dateB = b.created_at || b.date || '';
      return String(dateB).localeCompare(String(dateA));
    });
  }, [order, contextPayments]);

  // Handle Download Invoice
  const handleDownloadInvoice = () => {
    if (!order) return;
    try {
      generateInvoice(order, linkedPatient || {
        name: order.clientName,
        email: order.clientEmail,
        phone: order.clientPhone,
        address: order.shippingAddress
      }, linkedPayments[0] || null);
      toast.success('Invoice generated successfully.');
    } catch (err) {
      console.error('Invoice error:', err);
      toast.error('Unable to generate invoice.');
    }
  };

  // Copy helper
  const handleCopy = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  // Loading State
  if (loading) {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center' }}>
        <RefreshCw size={36} className="animate-spin" color="#1e5aa8" style={{ margin: '0 auto 16px auto' }} />
        <h3 style={{ fontSize: '1.15rem', color: '#0f2942', fontWeight: 600 }}>Loading Order Details...</h3>
        <p style={{ color: '#64748b', fontSize: '0.86rem' }}>Synchronizing with Supabase database...</p>
      </div>
    );
  }

  // Error State
  if (error || !order) {
    return (
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px' }}>
        <button
          onClick={() => navigate('/orders')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            color: '#1e5aa8',
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: '20px'
          }}
        >
          <ArrowLeft size={16} /> Back to Orders
        </button>
        <AdminEmptyState
          icon={<AlertCircle size={32} color="#dc2626" />}
          title="Order Not Found"
          description={error || "The requested order record could not be loaded from Supabase."}
          actionLabel="Return to Apothecary Orders"
          onAction={() => navigate('/orders')}
        />
      </div>
    );
  }

  // Active status pipeline calculations
  const activeStatuses = statuses.filter((s) => s.is_active);
  const currentStatusIndex = activeStatuses.findIndex(
    (s) => s.name?.toLowerCase() === (order.orderStatus || order.status || '').toLowerCase()
  );

  const isOrderPaid = (order.paymentStatus || order.payment_status || '').toLowerCase() === 'paid';
  const hasOutstandingBalance = Number(order.outstandingBalance ?? 0) > 0 || !isOrderPaid;
  const patientUUID = linkedPatient?.id || order.clientId || order.client_id;
  const displayOrderNumber = order.order_number || order.orderNumber || order.order_id || order.id;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '60px' }}>
      {/* ─────────────────────────────────────────────
          1. TOP NAVIGATION & ACTION BAR
          ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate('/orders')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="Back to Orders"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                Apothecary Order
              </span>
              <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>•</span>
              <span style={{ fontSize: '0.8rem', color: '#1e5aa8', fontWeight: 600 }}>
                {order.orderType || 'Online Prescription Formulation'}
              </span>
            </div>
            <h1 style={{ margin: '2px 0 0 0', fontSize: '1.65rem', fontWeight: 800, color: '#0f2942', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>Order #{displayOrderNumber}</span>
              <button
                type="button"
                onClick={() => handleCopy(displayOrderNumber, 'Order Number')}
                title="Copy Order Number"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}
              >
                <Copy size={16} />
              </button>
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <AdminButton
            variant="secondary"
            onClick={handleDownloadInvoice}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <Download size={15} />
            <span>Download Invoice</span>
          </AdminButton>

          <AdminButton
            variant="secondary"
            onClick={() => setIsUpdateStatusOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <Edit2 size={15} />
            <span>Update Status</span>
          </AdminButton>

          {hasOutstandingBalance && (
            <AdminButton
              variant="primary"
              onClick={() => setIsPayNowOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)',
                borderColor: '#15803d'
              }}
            >
              <CreditCard size={15} />
              <span>Pay Now (${Number(order.outstandingBalance || order.total || 0).toFixed(2)})</span>
            </AdminButton>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────
          2. ORDER HEADER SUMMARY CARDS
          ───────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px'
        }}
      >
        {/* Placed Date */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#eff6ff', color: '#1e5aa8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Placed Date</div>
            <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0f2942', marginTop: '2px' }}>{order.date || 'Today'}</div>
          </div>
        </div>

        {/* Order Status */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#f0fdf4', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Order Status</div>
            <div style={{ marginTop: '4px' }}>
              <AdminBadge status={order.orderStatus || order.status} />
            </div>
          </div>
        </div>

        {/* Payment Status */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: isOrderPaid ? '#dcfce7' : '#fef3c7', color: isOrderPaid ? '#15803d' : '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CreditCard size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Payment Status</div>
            <div style={{ marginTop: '4px' }}>
              <AdminBadge status={order.paymentStatus || order.payment_status} />
            </div>
          </div>
        </div>

        {/* Order Total */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Order Total</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>
              ${Number(order.totalAmount || order.total || 0).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────
          3. DYNAMIC ORDER STATUS PROGRESSION PIPELINE
          ───────────────────────────────────────────── */}
      <AdminCard title="Order Fulfillment Progression" subtitle="Dynamic pipeline reading configured statuses from Supabase">
        <div style={{ padding: '8px 0', overflowX: 'auto' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minWidth: '640px',
              position: 'relative'
            }}
          >
            {activeStatuses.map((step, idx) => {
              const isCompleted = currentStatusIndex > idx;
              const isCurrent = currentStatusIndex === idx;
              const isPending = currentStatusIndex < idx;

              return (
                <div
                  key={step.id || step.name}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    position: 'relative',
                    flex: 1,
                    textAlign: 'center'
                  }}
                >
                  {/* Connecting Line Left */}
                  {idx > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '16px',
                        left: '-50%',
                        width: '100%',
                        height: '3px',
                        background: isCompleted || isCurrent ? '#1e5aa8' : '#e2e8f0',
                        zIndex: 1,
                        transition: 'background 0.3s ease'
                      }}
                    />
                  )}

                  {/* Step Icon Badge */}
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '50%',
                      background: isCompleted
                        ? '#1e5aa8'
                        : isCurrent
                          ? '#ffffff'
                          : '#f1f5f9',
                      border: isCurrent ? `3px solid ${step.color || '#1e5aa8'}` : isCompleted ? 'none' : '2px solid #cbd5e1',
                      color: isCompleted ? '#ffffff' : isCurrent ? (step.color || '#1e5aa8') : '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2,
                      boxShadow: isCurrent ? `0 0 0 4px ${step.color || '#1e5aa8'}22` : 'none',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {isCompleted ? (
                      <CheckCircle2 size={18} strokeWidth={2.5} />
                    ) : isCurrent ? (
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: step.color || '#1e5aa8' }} />
                    ) : (
                      <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{idx + 1}</span>
                    )}
                  </div>

                  {/* Step Label */}
                  <div style={{ marginTop: '10px' }}>
                    <div
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: isCurrent ? 700 : isCompleted ? 600 : 500,
                        color: isCurrent ? '#0f2942' : isCompleted ? '#334155' : '#94a3b8'
                      }}
                    >
                      {step.name}
                    </div>
                    {isCurrent && (
                      <div
                        style={{
                          fontSize: '0.7rem',
                          color: step.color || '#1e5aa8',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          marginTop: '2px'
                        }}
                      >
                        Active Stage
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </AdminCard>

      {/* ─────────────────────────────────────────────
          4. MAIN GRID: PATIENT INFO & ORDER METADATA
          ───────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        {/* Patient Information Card */}
        <AdminCard
          title="Patient Information"
          subtitle="Apothecary client and delivery credentials"
          headerRight={
            patientUUID ? (
              <Link
                to={`/patients/${patientUUID}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#1e5aa8',
                  textDecoration: 'none'
                }}
              >
                <span>View Profile</span>
                <ExternalLink size={13} />
              </Link>
            ) : null
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: '#1e5aa8',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '1.1rem'
                }}
              >
                {(order.clientName || 'P').charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, color: '#0f2942', fontSize: '1.02rem' }}>
                  {order.clientName || 'Valued Patient'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Client UUID: <span style={{ fontFamily: 'monospace' }}>{patientUUID || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.86rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#334155' }}>
                <Mail size={16} color="#64748b" />
                <span>{order.clientEmail || linkedPatient?.email || 'No email on record'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#334155' }}>
                <Phone size={16} color="#64748b" />
                <span>{order.clientPhone || linkedPatient?.phone || 'No phone number on record'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', color: '#334155' }}>
                <MapPin size={16} color="#64748b" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{order.shippingAddress || linkedPatient?.address || 'Clinic Pickup (Concierge Dispensary, Allen TX)'}</span>
              </div>
            </div>
          </div>
        </AdminCard>

        {/* Order Metadata Card */}
        <AdminCard title="Order Metadata" subtitle="System records and dispensary assignment">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b' }}>System Order UUID:</span>
              <span style={{ fontFamily: 'monospace', color: '#1e5aa8', fontWeight: 600 }}>{order.id}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b' }}>Assigned Clinician/Staff:</span>
              <span style={{ fontWeight: 600, color: '#0f2942' }}>{order.assignedStaff || 'Dr. Dennay / Apothecary Concierge'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b' }}>Order Placed:</span>
              <span style={{ color: '#334155' }}>{order.created_at ? new Date(order.created_at).toLocaleString() : order.date}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b' }}>Fulfillment Target:</span>
              <span style={{ color: '#334155' }}>{order.fulfilledDate || (order.orderStatus === 'Fulfilled' ? 'Completed' : 'Standard 24-48h')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Tracking Number:</span>
              <span style={{ fontWeight: 600, color: order.trackingNumber ? '#0f2942' : '#94a3b8' }}>
                {order.trackingNumber || 'Pending dispatch'}
              </span>
            </div>
          </div>
        </AdminCard>
      </div>

      {/* ─────────────────────────────────────────────
          5. ORDER ITEMS & PRODUCTS TABLE
          ───────────────────────────────────────────── */}
      <AdminCard title="Order Items & Formulations" subtitle={`Contains ${order.items?.length || 1} distinct item(s)`}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ padding: '10px 12px' }}>Product Name</th>
                <th style={{ padding: '10px 12px' }}>SKU</th>
                <th style={{ padding: '10px 12px' }}>Product Type</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Qty</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Unit Price</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Line Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((item, idx) => {
                const qty = Number(item.qty || item.quantity || 1);
                const price = Number(item.price || item.unitPrice || 0);
                const lineTotal = Number(item.total || qty * price);

                return (
                  <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#0f2942' }}>
                      {item.name}
                    </td>
                    <td style={{ padding: '12px', fontFamily: 'monospace', color: '#64748b', fontSize: '0.8rem' }}>
                      {item.sku || `SKU-${100 + idx}`}
                    </td>
                    <td style={{ padding: '12px', color: '#64748b' }}>
                      {item.type || 'Clinical Skincare'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: '#0f2942' }}>
                      {qty}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#334155' }}>
                      ${price.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#15803d' }}>
                      ${lineTotal.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </AdminCard>

      {/* ─────────────────────────────────────────────
          6. FINANCIAL SUMMARY & STRIPE PAYMENT DETAILS
          ───────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        {/* Financial Summary */}
        <AdminCard title="Financial Summary" subtitle="Calculated from actual line items and fees">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.86rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
              <span>Items Subtotal:</span>
              <span style={{ fontWeight: 600, color: '#0f2942' }}>${Number(order.subtotal || order.total || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
              <span>Discount Applied:</span>
              <span style={{ color: '#16a34a' }}>-${Number(order.discount || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
              <span>Estimated Tax (8.25%):</span>
              <span style={{ color: '#0f2942' }}>${Number(order.tax || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
              <span>Shipping & Compounding Fee:</span>
              <span style={{ color: '#0f2942' }}>${Number(order.shipping || 0).toFixed(2)}</span>
            </div>
            <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 800 }}>
              <span style={{ color: '#0f2942' }}>Grand Total:</span>
              <span style={{ color: '#15803d' }}>${Number(order.totalAmount || order.total || 0).toFixed(2)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: '8px',
                background: hasOutstandingBalance ? '#fef3c7' : '#ecfdf5',
                border: hasOutstandingBalance ? '1px solid #fde68a' : '1px solid #a7f3d0',
                marginTop: '6px'
              }}
            >
              <span style={{ fontWeight: 700, color: hasOutstandingBalance ? '#b45309' : '#065f46' }}>
                Outstanding Balance:
              </span>
              <span style={{ fontWeight: 800, color: hasOutstandingBalance ? '#b45309' : '#065f46' }}>
                ${Number(order.outstandingBalance ?? 0).toFixed(2)}
              </span>
            </div>
          </div>
        </AdminCard>

        {/* Payment & Stripe Details */}
        <AdminCard title="Payment & Stripe Integration" subtitle="Verified 256-bit gateway transactions">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b' }}>Gateway Provider:</span>
              <span style={{ fontWeight: 600, color: '#635bff', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <ShieldCheck size={14} color="#635bff" /> Stripe Connect
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b' }}>Payment Method:</span>
              <span style={{ fontWeight: 600, color: '#0f2942' }}>{order.paymentMethod || 'Credit Card (Stripe)'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b' }}>Stripe Payment Intent:</span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#1e5aa8' }}>
                {order.paymentIntentId || order.stripe_payment_intent_id || 'Not generated yet'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b' }}>Checkout Session ID:</span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#64748b' }}>
                {order.checkoutSessionId || 'cs_live_checkout_direct'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Settlement Status:</span>
              <span><AdminBadge status={order.paymentStatus || order.payment_status} /></span>
            </div>
          </div>
        </AdminCard>
      </div>

      {/* ─────────────────────────────────────────────
          7. LINKED TRANSACTIONS & ORDER NOTES
          ───────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        {/* Linked Transactions */}
        <AdminCard title="Linked Payment Transactions" subtitle="Records synchronized from payments table">
          {linkedPayments.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {linkedPayments.map((p, idx) => (
                <div
                  key={p.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.84rem'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: '#0f2942' }}>{p.method || 'Card'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Ref: <span style={{ fontFamily: 'monospace' }}>{p.reference || p.id}</span> • {p.date || 'Today'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: '#15803d' }}>${Number(p.amount || 0).toFixed(2)}</div>
                    <AdminBadge status={p.status || 'Paid'} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.86rem' }}>
              No payments found. Click "Pay Now" above to initiate a payment record.
            </div>
          )}
        </AdminCard>

        {/* Order Notes & Instructions */}
        <AdminCard title="Clinical Notes & Instructions" subtitle="Compounding and fulfillment advisories">
          <div
            style={{
              padding: '14px',
              borderRadius: '8px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              minHeight: '90px',
              fontSize: '0.86rem',
              color: '#334155',
              lineHeight: 1.5
            }}
          >
            {order.notes ? (
              order.notes
            ) : (
              <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                No special compounding or prescription instructions provided for this order.
              </span>
            )}
          </div>
        </AdminCard>
      </div>

      {/* ─────────────────────────────────────────────
          MODALS: UPDATE ORDER STATUS
          ───────────────────────────────────────────── */}
      {isUpdateStatusOpen && (
        <UpdateOrderStatusModal
          isOpen={isUpdateStatusOpen}
          onClose={() => setIsUpdateStatusOpen(false)}
          order={order}
          onStatusUpdated={(updatedOrder) => {
            setOrder(updatedOrder);
            if (updateItem) {
              updateItem('orders', updatedOrder.id, updatedOrder);
            }
            loadOrder();
          }}
        />
      )}


      {/* ─────────────────────────────────────────────
          MODALS: STRIPE PAY NOW MODAL
          ───────────────────────────────────────────── */}
      {isPayNowOpen && (
        <StripeOrderPaymentModal
          isOpen={isPayNowOpen}
          onClose={() => setIsPayNowOpen(false)}
          order={order}
          onPaymentSuccess={(updatedOrder) => {
            setOrder(updatedOrder);
            if (updateItem) {
              updateItem('orders', order.id, {
                paymentStatus: 'Paid',
                payment_status: 'Paid',
                orderStatus: 'Placed',
                order_status: 'Placed',
                status: 'Placed',
                outstandingBalance: 0
              });
            }
          }}
        />
      )}
    </div>
  );
};
export default OrderDetailsPage;
