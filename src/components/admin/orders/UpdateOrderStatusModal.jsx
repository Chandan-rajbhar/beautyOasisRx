import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  RefreshCw,
  Truck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { AdminModal } from '../ui/AdminModal';
import { AdminButton } from '../ui/AdminButton';
import { AdminBadge } from '../ui/AdminBadge';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '../../ui/select';
import {
  fetchOrderById,
  fetchOrderStatuses,
  updateOrderStatusAndDetails
} from '../../../services/orderService';

export const UpdateOrderStatusModal = ({
  isOpen,
  onClose,
  order,
  onStatusUpdated
}) => {
  const [currentOrder, setCurrentOrder] = useState(order);
  const [loadingFresh, setLoadingFresh] = useState(false);
  const [statuses, setStatuses] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // 1. When modal opens, load dynamic statuses and re-fetch latest order from Supabase
  useEffect(() => {
    if (!isOpen || !order?.id) return;

    let isMounted = true;
    setError(null);
    let initStatus = order.orderStatus || order.order_status || order.status || 'Pending';
    if (/preparation/i.test(initStatus)) initStatus = 'Confirmed';
    setSelectedStatus(initStatus);
    setSelectedPaymentStatus(order.paymentStatus || order.payment_status || 'Pending');
    setTrackingNumber(order.trackingNumber || order.tracking_number || '');
    setCurrentOrder(order);

    // Fetch dynamic statuses configuration from Supabase
    fetchOrderStatuses().then((list) => {
      if (isMounted) setStatuses(list || []);
    });

    // Re-fetch fresh order directly from Supabase so current status is never stale
    setLoadingFresh(true);
    fetchOrderById(order.id)
      .then((fresh) => {
        if (isMounted && fresh) {
          setCurrentOrder(fresh);
          let freshSt = fresh.orderStatus || fresh.order_status || fresh.status || 'Pending';
          if (/preparation/i.test(freshSt)) freshSt = 'Confirmed';
          setSelectedStatus(freshSt);
          setSelectedPaymentStatus(fresh.paymentStatus || fresh.payment_status || 'Pending');
          setTrackingNumber(fresh.trackingNumber || fresh.tracking_number || '');
        }
      })
      .catch((err) => {
        console.warn('Could not re-fetch fresh order status:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingFresh(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, order?.id]);

  if (!isOpen || !order) return null;

  let currentStatusDisplay = currentOrder?.orderStatus || currentOrder?.order_status || currentOrder?.status || 'Pending';
  if (/preparation/i.test(currentStatusDisplay)) {
    currentStatusDisplay = 'Confirmed';
  }
  const currentPaymentDisplay = currentOrder?.paymentStatus || currentOrder?.payment_status || 'Pending';

  // Filter active statuses from configuration
  const activeStatuses = statuses.filter(
    (s) => s.is_active !== false && !/preparation/i.test(s.key || '') && !/preparation/i.test(s.name || '')
  );

  // Fallback default statuses if table is empty
  const statusOptions = activeStatuses.length > 0
    ? activeStatuses
    : [
        { id: 'st-1', name: 'Pending', description: 'Order created, awaiting verification' },
        { id: 'st-2', name: 'Confirmed', description: 'Compounding in progress' },
        { id: 'st-3', name: 'Placed', description: 'Order officially placed' },
        { id: 'st-4', name: 'Ordered', description: 'Transmitted to clinical dispensary' },
        { id: 'st-5', name: 'Ready for Pickup', description: 'Ready for client pickup' },
        { id: 'st-6', name: 'Fulfilled', description: 'Order completed and delivered' },
        { id: 'st-7', name: 'Cancelled', description: 'Order cancelled' }
      ];

  const paymentOptions = [
    { value: 'Paid', label: 'Paid' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Unpaid', label: 'Unpaid' },
    { value: 'Refunded', label: 'Refunded' },
    { value: 'Failed', label: 'Failed' },
    { value: 'Partially Paid', label: 'Partially Paid' }
  ];

  // Handle Save Status
  const handleSave = async () => {
    if (!selectedStatus) {
      setError('Please select an order status.');
      return;
    }

    // Gracefully handle if no change was made
    const isStatusSame = selectedStatus.toLowerCase() === currentStatusDisplay.toLowerCase();
    const isPaymentSame = selectedPaymentStatus.toLowerCase() === currentPaymentDisplay.toLowerCase();
    const isTrackingSame = (trackingNumber || '').trim() === (currentOrder.trackingNumber || currentOrder.tracking_number || '').trim();

    if (isStatusSame && isPaymentSame && isTrackingSame) {
      toast('Status is already up to date.', { icon: 'ℹ️' });
      onClose();
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updates = {
        order_status: selectedStatus,
        payment_status: selectedPaymentStatus,
        tracking_number: trackingNumber.trim()
      };

      const result = await updateOrderStatusAndDetails(order.id, updates);

      if (!result.success || !result.data) {
        throw new Error('Supabase did not return updated order data.');
      }

      const updatedOrder = result.data;

      // Immediately update local modal current status
      setCurrentOrder(updatedOrder);

      toast.success(`Order #${order.orderNumber || order.id} status updated to ${selectedStatus}!`);

      // Notify parent to refresh table and context
      if (onStatusUpdated) {
        onStatusUpdated(updatedOrder);
      }

      onClose();
    } catch (err) {
      console.error('Error updating order status in Supabase:', err);
      setError(err.message || 'Failed to update order status in Supabase. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Update Order #${order.orderNumber || order.id}`}
      maxWidth="500px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && (
          <div
            style={{
              padding: '10px 14px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#b91c1c',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Current Status Badge Display */}
        <div className="admin-form-group">
          <label className="admin-form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Current Status</span>
            {loadingFresh && (
              <span style={{ fontSize: '0.72rem', color: '#1e5aa8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <RefreshCw size={11} className="animate-spin" /> Syncing with Supabase...
              </span>
            )}
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}
          >
            <div>
              <AdminBadge status={currentStatusDisplay} />
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Payment: <strong style={{ color: '#0f2942' }}>{currentPaymentDisplay}</strong>
            </div>
          </div>
        </div>

        {/* Select New Order Status via Shadcn Select */}
        <div className="admin-form-group">
          <label className="admin-form-label">Select New Order Status</label>
          <Select
            value={selectedStatus}
            onValueChange={(val) => {
              setSelectedStatus(val);
              setError(null);
            }}
          >
            <SelectTrigger
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '9px 12px',
                fontSize: '0.86rem',
                color: '#0f2942',
                fontWeight: 500,
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
              }}
            >
              <SelectValue placeholder="Choose order fulfillment status..." />
            </SelectTrigger>
            <SelectContent
              style={{
                maxHeight: '260px',
                overflowY: 'auto',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                boxShadow: '0 10px 25px -5px rgba(15, 41, 66, 0.15)'
              }}
            >
              {statusOptions.map((st) => (
                <SelectItem key={st.id || st.name} value={st.name}>
                  <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                    <span style={{ fontWeight: 600, color: '#0f2942' }}>{st.name}</span>
                    {st.description && (
                      <span style={{ fontSize: '0.74rem', color: '#64748b' }}>{st.description}</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Select Payment Status via Shadcn Select */}
        <div className="admin-form-group">
          <label className="admin-form-label">Payment Status</label>
          <Select
            value={selectedPaymentStatus}
            onValueChange={setSelectedPaymentStatus}
          >
            <SelectTrigger
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '9px 12px',
                fontSize: '0.86rem',
                color: '#0f2942',
                fontWeight: 500,
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
              }}
            >
              <SelectValue placeholder="Select payment status..." />
            </SelectTrigger>
            <SelectContent
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                boxShadow: '0 10px 25px -5px rgba(15, 41, 66, 0.15)'
              }}
            >
              {paymentOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span style={{ fontWeight: 500 }}>{opt.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Carrier Tracking Number */}
        <div className="admin-form-group">
          <label className="admin-form-label">Carrier Tracking Number</label>
          <input
            type="text"
            className="admin-form-input"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="e.g. FEDEX-8829104"
          />
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
          <AdminButton variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </AdminButton>
          <AdminButton
            variant="primary"
            onClick={handleSave}
            disabled={isSaving}
            style={{ minWidth: '130px' }}
          >
            {isSaving ? 'Updating...' : 'Update Status'}
          </AdminButton>
        </div>
      </div>
    </AdminModal>
  );
};

export default UpdateOrderStatusModal;
