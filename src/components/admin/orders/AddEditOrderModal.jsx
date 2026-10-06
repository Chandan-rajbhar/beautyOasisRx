import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Package,
  User,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminModal } from '../ui/AdminModal';
import { AdminButton } from '../ui/AdminButton';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '../../ui/select';
import { useAdminData } from '../../../context/AdminDataContext';
import {
  createOrder,
  updateOrder,
  fetchOrderStatuses,
  DEFAULT_ORDER_STATUSES
} from '../../../services/orderService';

export const AddEditOrderModal = ({
  isOpen,
  onClose,
  orderToEdit = null,
  patients: propPatients = [],
  products: propProducts = [],
  statuses: propStatuses = [],
  onOrderSaved
}) => {
  const isEditing = Boolean(orderToEdit);

  // Hook into admin context as dynamic fallback
  const adminData = useAdminData();
  const contextClients = adminData?.clients || [];
  const contextProducts = adminData?.products || [];

  const patients = propPatients && propPatients.length > 0 ? propPatients : contextClients;
  const products = propProducts && propProducts.length > 0 ? propProducts : contextProducts;

  // Dynamic statuses from Supabase
  const [dynamicStatuses, setDynamicStatuses] = useState(propStatuses);

  useEffect(() => {
    if (propStatuses && propStatuses.length > 0) {
      setDynamicStatuses(propStatuses);
    } else {
      fetchOrderStatuses().then((list) => {
        if (list && list.length > 0) setDynamicStatuses(list);
      });
    }
  }, [propStatuses]);

  const statusOptions = useMemo(() => {
    const list = dynamicStatuses && dynamicStatuses.length > 0 ? dynamicStatuses : DEFAULT_ORDER_STATUSES;
    const active = list.filter((s) => s.is_active !== false);
    if (!active.some((s) => s.name?.toLowerCase() === 'placed')) {
      active.unshift({ id: 'stat-placed', name: 'Placed', key: 'Placed' });
    }
    return active;
  }, [dynamicStatuses]);

  // Form states
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('Clinic Pickup (Allen, TX)');
  const [orderStatus, setOrderStatus] = useState('Pending');
  const [paymentStatus, setPaymentStatus] = useState('Pending');
  const [notes, setNotes] = useState('');

  // Line items state
  const [items, setItems] = useState([
    { productId: '', name: '', sku: '', type: 'Skincare', qty: 1, price: 0 }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    if (orderToEdit) {
      setSelectedPatientId(orderToEdit.clientId || orderToEdit.client_id || '');
      setClientName(orderToEdit.clientName || orderToEdit.client_name || '');
      setClientEmail(orderToEdit.clientEmail || orderToEdit.client_email || '');
      setClientPhone(orderToEdit.clientPhone || orderToEdit.client_phone || '');
      setShippingAddress(orderToEdit.shippingAddress || orderToEdit.shipping_address || 'Clinic Pickup (Allen, TX)');
      setOrderStatus(orderToEdit.orderStatus || orderToEdit.status || 'Placed');
      setPaymentStatus(orderToEdit.paymentStatus || orderToEdit.payment_status || 'Pending');
      setNotes(orderToEdit.notes || '');

      if (Array.isArray(orderToEdit.items) && orderToEdit.items.length > 0) {
        setItems(
          orderToEdit.items.map((i) => ({
            productId: i.id || i.productId || '',
            name: i.name || '',
            sku: i.sku || '',
            type: i.type || 'Skincare',
            qty: Number(i.qty || i.quantity || 1),
            price: Number(i.price || i.unitPrice || 0)
          }))
        );
      }
    } else {
      // Reset for new order: always start with Pending/Pending — status moves to
      // Placed/Paid automatically after successful payment.
      const initialPatient = patients[0] || null;
      setSelectedPatientId(initialPatient?.id || '');
      setClientName(initialPatient?.name || initialPatient?.full_name || '');
      setClientEmail(initialPatient?.email || '');
      setClientPhone(initialPatient?.phone || '');
      setShippingAddress(initialPatient?.address || 'Clinic Pickup (Allen, TX)');
      setOrderStatus('Pending');
      setPaymentStatus('Pending');
      setNotes('');

      if (products.length > 0) {
        const p = products[0];
        setItems([
          {
            productId: p.id,
            name: p.name || p.title,
            sku: p.sku || 'SKU-001',
            type: p.category || 'Skincare',
            qty: 1,
            price: Number(p.price || 0)
          }
        ]);
      } else {
        setItems([
          { productId: '', name: 'Bespoke Compounded Formula', sku: 'SKU-APOTH-01', type: 'Clinical Skincare', qty: 1, price: 75 }
        ]);
      }
    }
    setError(null);
  }, [isOpen, orderToEdit, patients, products]);

  // Handle Patient Selection Change via Shadcn Select
  const handlePatientSelect = (pId) => {
    setSelectedPatientId(pId);
    const found = patients.find((p) => p.id === pId);
    if (found) {
      setClientName(found.name || found.full_name || '');
      setClientEmail(found.email || '');
      setClientPhone(found.phone || '');
      if (found.address) setShippingAddress(found.address);
    }
  };

  // Line Item Management via Shadcn Select
  const handleProductSelect = (index, prodId) => {
    const prod = products.find((p) => p.id === prodId);
    const updated = [...items];
    if (prod) {
      updated[index] = {
        ...updated[index],
        productId: prod.id,
        name: prod.name || prod.title,
        sku: prod.sku || `SKU-${index + 1}`,
        type: prod.category || 'Skincare',
        price: Number(prod.price || 0)
      };
    } else {
      updated[index].productId = prodId;
    }
    setItems(updated);
  };

  const handleItemFieldChange = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleAddItem = () => {
    const defaultProd = products[0];
    setItems([
      ...items,
      {
        productId: defaultProd?.id || '',
        name: defaultProd?.name || 'Formulation Product',
        sku: defaultProd?.sku || `SKU-${items.length + 1}`,
        type: defaultProd?.category || 'Clinical Skincare',
        qty: 1,
        price: Number(defaultProd?.price || 50)
      }
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) {
      toast.error('Order must have at least one line item');
      return;
    }
    setItems(items.filter((_, idx) => idx !== index));
  };

  // Financial Computations
  const subtotal = items.reduce((acc, curr) => acc + (Number(curr.qty || 1) * Number(curr.price || 0)), 0);
  const tax = 0;
  const shippingFee = 0;
  const total = Number((subtotal + shippingFee).toFixed(2));

  // Handle Submit Form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clientName.trim()) {
      setError('Patient name is required');
      return;
    }

    if (items.some((i) => !i.name || Number(i.qty) <= 0)) {
      setError('All items must have a valid product name and quantity greater than 0');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload = {
      clientId: selectedPatientId || null,
      client_id: selectedPatientId || null,
      clientName: clientName.trim(),
      client_name: clientName.trim(),
      clientEmail: clientEmail.trim(),
      client_email: clientEmail.trim(),
      clientPhone: clientPhone.trim(),
      client_phone: clientPhone.trim(),
      shippingAddress: shippingAddress.trim() || 'Clinic Pickup (Allen, TX)',
      shipping_address: shippingAddress.trim() || 'Clinic Pickup (Allen, TX)',
      orderType: 'Online Apothecary Order',
      order_type: 'Online Apothecary Order',
      orderStatus,
      order_status: orderStatus,
      status: orderStatus,
      paymentStatus,
      payment_status: paymentStatus,
      items: items.map((i) => ({
        id: i.productId || undefined,
        productId: i.productId || undefined,
        name: i.name,
        sku: i.sku,
        type: i.type,
        qty: Number(i.qty),
        quantity: Number(i.qty),
        price: Number(i.price),
        unitPrice: Number(i.price),
        total: Number(i.qty) * Number(i.price)
      })),
      subtotal,
      tax,
      shipping: shippingFee,
      total,
      totalAmount: total,
      total_amount: total,
      trackingNumber: '',
      tracking_number: '',
      notes
    };

    try {
      let res;
      if (isEditing) {
        res = await updateOrder(orderToEdit.id, payload);
      } else {
        res = await createOrder(payload);
      }

      if (res.success) {
        toast.success(isEditing ? 'Order updated successfully' : 'New order created successfully');
        if (onOrderSaved) onOrderSaved(res.data);
        onClose();
      } else {
        throw new Error(res.error || 'Failed to save order');
      }
    } catch (err) {
      console.error('Error saving order:', err);
      setError(err.message || 'Error occurred while saving to Supabase');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Order #${orderToEdit.id}` : 'Create New Apothecary Order'}
      maxWidth="720px"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
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

        {/* Patient Selection & Details */}
        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#0f2942', fontWeight: 700, fontSize: '0.88rem' }}>
            <User size={16} color="#1e5aa8" /> Patient Information
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="admin-form-group">
              <label className="admin-form-label">Select Registered Patient</label>
              <Select
                value={selectedPatientId}
                onValueChange={handlePatientSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="-- Choose Patient / Client --">
                    {(() => {
                      const found = patients.find((p) => p.id === selectedPatientId);
                      return found
                        ? `${found.name || found.full_name || 'Patient'}${found.email ? ` (${found.email})` : ''}`
                        : '';
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent style={{ maxHeight: '220px', overflowY: 'auto' }}>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name || p.full_name || 'Patient'} {p.email ? `(${p.email})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Client Name *</label>
              <input
                type="text"
                className="admin-form-input"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Patient Full Name"
                required
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Client Email</label>
              <input
                type="email"
                className="admin-form-input"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="patient@example.com"
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Client Phone</label>
              <input
                type="text"
                className="admin-form-input"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="(555) 000-0000"
              />
            </div>
          </div>
        </div>

        {/* Line Items Selection */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f2942', fontWeight: 700, fontSize: '0.88rem' }}>
              <Package size={16} color="#1e5aa8" /> Purchased Products & Formulations
            </div>
            <button
              type="button"
              onClick={handleAddItem}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                border: 'none',
                background: '#e0f2fe',
                color: '#0284c7',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Plus size={13} /> Add Product
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2.5fr 1fr 1fr 1fr auto',
                  gap: '8px',
                  alignItems: 'center',
                  background: '#ffffff',
                  padding: '8px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}
              >
                <div>
                  {products.length > 0 ? (
                    <Select
                      value={item.productId || ''}
                      onValueChange={(val) => handleProductSelect(idx, val)}
                    >
                      <SelectTrigger style={{ height: '36px', fontSize: '0.82rem' }}>
                        <SelectValue placeholder="-- Choose Product Catalog --">
                          {(() => {
                            const found = products.find((p) => p.id === item.productId);
                            return found
                              ? `${found.name || found.title} ($${Number(found.price || 0).toFixed(2)})`
                              : item.name || '';
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent style={{ maxHeight: '220px', overflowY: 'auto' }}>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name || p.title} (${Number(p.price || 0).toFixed(2)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <input
                      type="text"
                      className="admin-form-input"
                      placeholder="Product Name"
                      value={item.name}
                      onChange={(e) => handleItemFieldChange(idx, 'name', e.target.value)}
                      style={{ fontSize: '0.82rem', padding: '6px 8px' }}
                    />
                  )}
                </div>

                <div>
                  <input
                    type="number"
                    min="1"
                    className="admin-form-input"
                    placeholder="Qty"
                    value={item.qty}
                    onChange={(e) => handleItemFieldChange(idx, 'qty', e.target.value)}
                    style={{ fontSize: '0.82rem', padding: '6px 8px', textAlign: 'center' }}
                  />
                </div>

                <div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="admin-form-input"
                    placeholder="Price"
                    value={item.price}
                    onChange={(e) => handleItemFieldChange(idx, 'price', e.target.value)}
                    style={{ fontSize: '0.82rem', padding: '6px 8px' }}
                  />
                </div>

                <div style={{ fontWeight: 700, color: '#15803d', fontSize: '0.88rem', textAlign: 'right' }}>
                  ${(Number(item.qty || 1) * Number(item.price || 0)).toFixed(2)}
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    style={{
                      border: 'none',
                      background: '#fee2e2',
                      color: '#b91c1c',
                      padding: '6px',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Statuses (Order Status & Payment Status) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="admin-form-group">
            <label className="admin-form-label">Order Status</label>
            {isEditing ? (
              <Select value={orderStatus} onValueChange={setOrderStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent style={{ maxHeight: '220px', overflowY: 'auto' }}>
                  {statusOptions.map((st) => (
                    <SelectItem key={st.id || st.name} value={st.name}>
                      {st.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 12px',
                    background: '#fefce8',
                    border: '1px solid #fde047',
                    borderRadius: '8px',
                    fontSize: '0.83rem',
                    fontWeight: 700,
                    color: '#854d0e',
                    cursor: 'default'
                  }}
                >
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: '#ca8a04',
                      flexShrink: 0
                    }}
                  />
                  Pending
                </div>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  Moves to &ldquo;Placed&rdquo; after payment
                </span>
              </div>
            )}
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Payment Status</label>
            {isEditing ? (
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                  <SelectItem value="Unpaid">Unpaid</SelectItem>
                  <SelectItem value="Refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 12px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '0.83rem',
                    fontWeight: 700,
                    color: '#475569',
                    cursor: 'default'
                  }}
                >
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: '#94a3b8',
                      flexShrink: 0
                    }}
                  />
                  Pending
                </div>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  Moves to &ldquo;Paid&rdquo; after payment
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Financial Summary Strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            fontSize: '0.86rem'
          }}
        >
          <div>
            <span style={{ color: '#64748b' }}>Subtotal: </span>
            <span style={{ fontWeight: 600, color: '#0f2942' }}>${subtotal.toFixed(2)}</span>
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#15803d' }}>
            Total: ${total.toFixed(2)}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <AdminButton variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </AdminButton>
          <AdminButton
            variant="primary"
            type="submit"
            disabled={isSubmitting}
            style={{ background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)', borderColor: '#15803d' }}
          >
            {isSubmitting ? 'Saving to Supabase...' : isEditing ? 'Save Changes' : 'Create Order'}
          </AdminButton>
        </div>
      </form>
    </AdminModal>
  );
};

export default AddEditOrderModal;
