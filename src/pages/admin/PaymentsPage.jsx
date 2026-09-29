import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  DollarSign,
  ArrowUpRight,
  Eye,
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { useAdminData } from '../../context/AdminDataContext';
import { AdminCard } from '../../components/admin/ui/AdminCard';
import { AdminTable } from '../../components/admin/ui/AdminTable';
import { AdminToolbar } from '../../components/admin/ui/AdminToolbar';
import { AdminBadge } from '../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../components/admin/ui/AdminButton';
import { AdminModal } from '../../components/admin/ui/AdminModal';
import { AdminDrawer } from '../../components/admin/ui/AdminDrawer';
import { AdminConfirmDialog } from '../../components/admin/ui/AdminConfirmDialog';

export const PaymentsPage = () => {
  const { payments, stats, updateItem, deleteItem, isLoading } = useAdminData();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [selectedPayment, setSelectedPayment] = useState(null);
  const [editPayment, setEditPayment] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const handleUpdateStatus = (status) => {
    if (!editPayment) return;
    updateItem('payments', editPayment.id, { status });
    setEditPayment(null);
  };

  const handleDelete = () => {
    if (deleteConfirmId) {
      deleteItem('payments', deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const filteredPayments = useMemo(() => {
    return payments.filter((pay) => {
      const searchLower = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        pay.transactionId.toLowerCase().includes(searchLower) ||
        (pay.clientName && pay.clientName.toLowerCase().includes(searchLower)) ||
        (pay.paymentMethod && pay.paymentMethod.toLowerCase().includes(searchLower)) ||
        (pay.type && pay.type.toLowerCase().includes(searchLower));

      const matchStatus = statusFilter === 'ALL' || pay.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [payments, searchTerm, statusFilter]);

  const columns = [
    {
      header: 'Transaction ID',
      accessor: 'transactionId',
      sortable: true,
      render: (row) => (
        <span style={{ fontWeight: 700, color: '#1e5aa8', fontFamily: 'monospace' }}>
          {row.transactionId}
        </span>
      )
    },
    {
      header: 'Client / Patient',
      accessor: 'clientName',
      sortable: true,
      render: (row) => (
        <div style={{ fontWeight: 600, color: '#0f2942' }}>
          {row.clientName}
        </div>
      )
    },
    {
      header: 'Appointment / Reference',
      accessor: 'type',
      render: (row) => (
        <div>
          <div style={{ fontSize: '0.84rem', color: '#334155' }}>{row.type}</div>
          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Ref: {row.referenceId}</div>
        </div>
      )
    },
    {
      header: 'Amount',
      accessor: 'amount',
      sortable: true,
      render: (row) => (
        <div style={{ fontWeight: 700, color: '#15803d', fontSize: '0.9rem' }}>
          ${row.amount}
        </div>
      )
    },
    {
      header: 'Payment Method',
      accessor: 'paymentMethod',
      render: (row) => (
        <span style={{ fontSize: '0.84rem', color: '#475569' }}>
          {row.paymentMethod}
        </span>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      render: (row) => <AdminBadge status={row.status} />
    },
    {
      header: 'Date & Time',
      accessor: 'date',
      sortable: true,
      render: (row) => (
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
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
            onClick={() => setSelectedPayment(row)}
            title="View Transaction Receipt"
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
            onClick={() => setEditPayment(row)}
            title="Modify Status"
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
            title="Delete Record"
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
          <h1>Payments & Financial Transactions</h1>
          <p>Real-time audit log of protocol deposits, completed treatment fees, and apothecary sales.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="admin-stats-grid">
        <AdminCard
          title="Total Collected Revenue"
          value={`$${stats.totalRevenue.toLocaleString()}`}
          subtitle="All confirmed and settled transactions"
          icon={<DollarSign size={20} />}
          iconBg="#dcfce7"
          iconColor="#15803d"
        />

        <AdminCard
          title="Settled Payments"
          value={payments.filter(p => p.status === 'Paid').length}
          subtitle="Successfully processed transactions"
          icon={<CheckCircle size={20} />}
          iconBg="#f0fdf4"
          iconColor="#16a34a"
        />

        <AdminCard
          title="Pending Payments"
          value={`$${stats.pendingRevenue.toLocaleString()}`}
          subtitle={`${payments.filter(p => p.status === 'Pending').length} pending collection`}
          icon={<Clock size={20} />}
          iconBg="#fef3c7"
          iconColor="#b45309"
        />

        <AdminCard
          title="Refunded Volume"
          value={`$${stats.refundedRevenue.toLocaleString()}`}
          subtitle={`${payments.filter(p => p.status === 'Refunded').length} refunded orders`}
          icon={<RotateCcw size={20} />}
          iconBg="#f1f5f9"
          iconColor="#475569"
        />
      </div>

      <AdminToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by transaction ID, client, method..."
        hasActiveFilters={Boolean(searchTerm) || statusFilter !== 'ALL'}
        onClearFilters={() => {
          setSearchTerm('');
          setStatusFilter('ALL');
        }}
        filters={[
          {
            id: 'status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { label: 'All Statuses', value: 'ALL' },
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
        data={filteredPayments}
        loading={isLoading}
        itemsPerPage={8}
        emptyTitle="No transactions found"
        emptyDescription="No payment records match your selected criteria."
      />

      {/* Edit Status Modal */}
      {editPayment && (
        <AdminModal
          isOpen={Boolean(editPayment)}
          onClose={() => setEditPayment(null)}
          title={`Update Transaction ${editPayment.transactionId}`}
          maxWidth="460px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="admin-form-group">
              <label className="admin-form-label">Payment Status</label>
              <select className="admin-form-select" defaultValue={editPayment.status} id="edit-pay-status">
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Refunded">Refunded</option>
                <option value="Failed">Failed</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <AdminButton variant="secondary" onClick={() => setEditPayment(null)}>
                Cancel
              </AdminButton>
              <AdminButton
                variant="primary"
                onClick={() => {
                  const s = document.getElementById('edit-pay-status').value;
                  handleUpdateStatus(s);
                }}
              >
                Save Status
              </AdminButton>
            </div>
          </div>
        </AdminModal>
      )}

      {/* View Transaction Receipt Drawer */}
      <AdminDrawer
        isOpen={Boolean(selectedPayment)}
        onClose={() => setSelectedPayment(null)}
        title="Transaction Receipt"
        subtitle={`Ref: ${selectedPayment?.transactionId}`}
        footer={
          <AdminButton variant="primary" onClick={() => setSelectedPayment(null)}>
            Close
          </AdminButton>
        }
      >
        {selectedPayment && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Payment Status
                </span>
                <div style={{ marginTop: '4px' }}>
                  <AdminBadge status={selectedPayment.status} />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Amount Settled
                </span>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#15803d' }}>
                  ${selectedPayment.amount}
                </div>
              </div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: '#0f2942', fontWeight: 700 }}>
                Transaction Specifications
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.84rem' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Client</span>
                  <span style={{ fontWeight: 600 }}>{selectedPayment.clientName}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Payment Method</span>
                  <span>{selectedPayment.paymentMethod}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Origin / Purpose</span>
                  <span>{selectedPayment.type}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Reference Code</span>
                  <span style={{ fontFamily: 'monospace' }}>{selectedPayment.referenceId}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Processed Timestamp</span>
                  <span>{selectedPayment.date}</span>
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
        title="Remove Transaction"
        message="Are you sure you want to delete this payment record from the financial log?"
      />
    </div>
  );
};
