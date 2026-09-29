import React, { useState, useMemo } from 'react';
import {
  ShoppingCart,
  Eye,
  Edit2,
  Trash2,
  Package,
  Truck,
  DollarSign,
  User,
  Calendar
} from 'lucide-react';
import { useAdminData } from '../../context/AdminDataContext';
import { AdminTable } from '../../components/admin/ui/AdminTable';
import { AdminToolbar } from '../../components/admin/ui/AdminToolbar';
import { AdminBadge } from '../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../components/admin/ui/AdminButton';
import { AdminModal } from '../../components/admin/ui/AdminModal';
import { AdminDrawer } from '../../components/admin/ui/AdminDrawer';
import { AdminConfirmDialog } from '../../components/admin/ui/AdminConfirmDialog';

export const OrdersPage = () => {
  const { orders, updateItem, deleteItem, isLoading } = useAdminData();

  const [searchTerm, setSearchTerm] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL');

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editOrder, setEditOrder] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const handleUpdateStatus = (orderStatus, paymentStatus, trackingNumber) => {
    if (!editOrder) return;
    updateItem('orders', editOrder.id, {
      orderStatus,
      paymentStatus,
      trackingNumber
    });
    setEditOrder(null);
  };

  const handleDelete = () => {
    if (deleteConfirmId) {
      deleteItem('orders', deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      const searchLower = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        ord.id.toLowerCase().includes(searchLower) ||
        (ord.clientName && ord.clientName.toLowerCase().includes(searchLower)) ||
        (ord.trackingNumber && ord.trackingNumber.toLowerCase().includes(searchLower));

      const matchOrder = orderStatusFilter === 'ALL' || ord.orderStatus === orderStatusFilter;
      const matchPayment = paymentStatusFilter === 'ALL' || ord.paymentStatus === paymentStatusFilter;

      return matchSearch && matchOrder && matchPayment;
    });
  }, [orders, searchTerm, orderStatusFilter, paymentStatusFilter]);

  const columns = [
    {
      header: 'Order ID',
      accessor: 'id',
      sortable: true,
      render: (row) => (
        <span style={{ fontWeight: 700, color: '#1e5aa8', fontFamily: 'monospace' }}>
          #{row.id}
        </span>
      )
    },
    {
      header: 'Client / Patient',
      accessor: 'clientName',
      sortable: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f2942' }}>{row.clientName}</div>
          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{row.clientEmail}</div>
        </div>
      )
    },
    {
      header: 'Purchased Items',
      accessor: 'items',
      render: (row) => (
        <div style={{ fontSize: '0.84rem', color: '#334155' }}>
          {row.items?.map((item, idx) => (
            <div key={idx}>
              {item.qty}x {item.name}
            </div>
          )) || '1x Formulation'}
        </div>
      )
    },
    {
      header: 'Total Amount',
      accessor: 'totalAmount',
      sortable: true,
      render: (row) => (
        <div style={{ fontWeight: 700, color: '#15803d', fontSize: '0.9rem' }}>
          ${row.totalAmount}
        </div>
      )
    },
    {
      header: 'Payment Status',
      accessor: 'paymentStatus',
      sortable: true,
      render: (row) => <AdminBadge status={row.paymentStatus} />
    },
    {
      header: 'Order Status',
      accessor: 'orderStatus',
      sortable: true,
      render: (row) => <AdminBadge status={row.orderStatus} />
    },
    {
      header: 'Date',
      accessor: 'date',
      sortable: true,
      render: (row) => (
        <span style={{ fontSize: '0.84rem', color: '#475569' }}>
          {row.date}
        </span>
      )
    },
    {
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setSelectedOrder(row)}
            title="View Order Details"
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              padding: '6px 8px',
              borderRadius: '6px',
              cursor: 'pointer',
              color: '#1e5aa8',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Eye size={14} />
          </button>

          <button
            onClick={() => setEditOrder(row)}
            title="Update Status"
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              padding: '6px 8px',
              borderRadius: '6px',
              cursor: 'pointer',
              color: '#334155',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Edit2 size={14} />
          </button>

          <button
            onClick={() => setDeleteConfirmId(row.id)}
            title="Delete Order"
            style={{
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              padding: '6px 8px',
              borderRadius: '6px',
              cursor: 'pointer',
              color: '#b91c1c',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Apothecary Orders & Shipments</h1>
          <p>Fulfill online apothecary orders, review line items, and manage customer shipments.</p>
        </div>
      </div>

      <AdminToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by order ID, client name, tracking number..."
        hasActiveFilters={Boolean(searchTerm) || orderStatusFilter !== 'ALL' || paymentStatusFilter !== 'ALL'}
        onClearFilters={() => {
          setSearchTerm('');
          setOrderStatusFilter('ALL');
          setPaymentStatusFilter('ALL');
        }}
        filters={[
          {
            id: 'orderStatus',
            value: orderStatusFilter,
            onChange: setOrderStatusFilter,
            options: [
              { label: 'All Order Status', value: 'ALL' },
              { label: 'Pending', value: 'Pending' },
              { label: 'Processing', value: 'Processing' },
              { label: 'Completed', value: 'Completed' },
              { label: 'Cancelled', value: 'Cancelled' }
            ]
          },
          {
            id: 'paymentStatus',
            value: paymentStatusFilter,
            onChange: setPaymentStatusFilter,
            options: [
              { label: 'All Payment Status', value: 'ALL' },
              { label: 'Paid', value: 'Paid' },
              { label: 'Pending', value: 'Pending' },
              { label: 'Refunded', value: 'Refunded' },
              { label: 'Failed', value: 'Failed' }
            ]
          }
        ]}
      />

      <AdminTable
        columns={columns}
        data={filteredOrders}
        loading={isLoading}
        itemsPerPage={8}
        emptyTitle="No orders found"
        emptyDescription="There are currently no customer orders matching your filter."
      />

      {/* Edit Order Status Modal */}
      {editOrder && (
        <AdminModal
          isOpen={Boolean(editOrder)}
          onClose={() => setEditOrder(null)}
          title={`Update Order #${editOrder.id}`}
          maxWidth="480px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="admin-form-group">
              <label className="admin-form-label">Order Fulfillment Status</label>
              <select className="admin-form-select" defaultValue={editOrder.orderStatus} id="edit-order-status">
                <option value="Pending">Pending</option>
                <option value="Processing">Processing</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Payment Status</label>
              <select className="admin-form-select" defaultValue={editOrder.paymentStatus} id="edit-payment-status">
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Refunded">Refunded</option>
                <option value="Failed">Failed</option>
              </select>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Carrier Tracking Number</label>
              <input
                type="text"
                className="admin-form-input"
                defaultValue={editOrder.trackingNumber || ''}
                id="edit-tracking-num"
                placeholder="e.g. FEDEX-8829104"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <AdminButton variant="secondary" onClick={() => setEditOrder(null)}>
                Cancel
              </AdminButton>
              <AdminButton
                variant="primary"
                onClick={() => {
                  const oStatus = document.getElementById('edit-order-status').value;
                  const pStatus = document.getElementById('edit-payment-status').value;
                  const tracking = document.getElementById('edit-tracking-num').value;
                  handleUpdateStatus(oStatus, pStatus, tracking);
                }}
              >
                Save Order Changes
              </AdminButton>
            </div>
          </div>
        </AdminModal>
      )}

      {/* View Order Drawer */}
      <AdminDrawer
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        title={`Order #${selectedOrder?.id}`}
        subtitle={`Placed on ${selectedOrder?.date}`}
        footer={
          <AdminButton variant="primary" onClick={() => setSelectedOrder(null)}>
            Close
          </AdminButton>
        }
      >
        {selectedOrder && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Order Status
                </span>
                <div style={{ marginTop: '4px' }}>
                  <AdminBadge status={selectedOrder.orderStatus} />
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Payment Status
                </span>
                <div style={{ marginTop: '4px' }}>
                  <AdminBadge status={selectedOrder.paymentStatus} />
                </div>
              </div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: '#0f2942', fontWeight: 700 }}>
                Customer & Shipping
              </h4>
              <div style={{ fontSize: '0.84rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div><strong>Client:</strong> {selectedOrder.clientName}</div>
                <div><strong>Email:</strong> {selectedOrder.clientEmail}</div>
                <div><strong>Destination:</strong> {selectedOrder.shippingAddress || 'Clinic Pickup (Allen, TX)'}</div>
                <div><strong>Tracking:</strong> {selectedOrder.trackingNumber || 'Pending dispatch'}</div>
              </div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.88rem', color: '#0f2942', fontWeight: 700 }}>
                Line Items
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selectedOrder.items?.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Qty: {item.qty}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: '#0f2942' }}>
                      ${item.price * item.qty}
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', fontSize: '0.95rem', fontWeight: 700 }}>
                  <span>Total Amount</span>
                  <span style={{ color: '#15803d' }}>${selectedOrder.totalAmount}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </AdminDrawer>

      <AdminConfirmDialog
        isOpen={Boolean(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDelete}
        title="Delete Order Record"
        message="Are you sure you want to delete this order? Transaction records will remain in payments ledger."
      />
    </div>
  );
};
