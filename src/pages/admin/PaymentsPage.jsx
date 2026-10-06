import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DollarSign,
  Eye,
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  RotateCcw,
  MoreVertical,
  ExternalLink,
  User
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
  const navigate = useNavigate();
  const {
    payments = [],
    clients = [],
    orders = [],
    appointments = [],
    users = [],
    stats,
    updateItem,
    deleteItem,
    isLoading,
    error
  } = useAdminData();

  // Dynamic resolver for patient ID using live database records
  const getPatientId = (row) => {
    if (!row) return null;

    // 1. Direct ID on payment record
    const directId =
      (row.clientId && row.clientId !== 'guest' ? row.clientId : null) ||
      (row.client_id && row.client_id !== 'guest' ? row.client_id : null) ||
      (row.patient_id && row.patient_id !== 'guest' ? row.patient_id : null) ||
      (row.patientId && row.patientId !== 'guest' ? row.patientId : null) ||
      (row.user_id && row.user_id !== 'guest' ? row.user_id : null);

    if (directId) return directId;

    const email = (row.clientEmail || row.customer_email || row.client_email || '').trim().toLowerCase();
    const name = (row.clientName || row.customer_name || row.client_name || '').trim().toLowerCase();

    // 2. Match against clients loaded from database
    if (email && Array.isArray(clients) && clients.length > 0) {
      const match = clients.find(c => c.email && c.email.trim().toLowerCase() === email);
      if (match?.id) return match.id;
    }

    if (name && name !== 'guest patient' && Array.isArray(clients) && clients.length > 0) {
      const match = clients.find(c => {
        const cName = (c.name || c.full_name || '').trim().toLowerCase();
        return cName && cName === name;
      });
      if (match?.id) return match.id;
    }

    // 3. Match via linked orders
    if (row.order_id && Array.isArray(orders) && orders.length > 0) {
      const linkedOrder = orders.find(o => String(o.id) === String(row.order_id) || String(o.order_id) === String(row.order_id));
      if (linkedOrder) {
        const orderPatientId = linkedOrder.clientId || linkedOrder.client_id || linkedOrder.patient_id || linkedOrder.user_id;
        if (orderPatientId && orderPatientId !== 'guest') return orderPatientId;
      }
    }

    // 4. Match via linked appointments
    if (row.appointment_id && Array.isArray(appointments) && appointments.length > 0) {
      const linkedApt = appointments.find(a => String(a.id) === String(row.appointment_id));
      if (linkedApt) {
        const aptPatientId = linkedApt.clientId || linkedApt.client_id || linkedApt.patient_id || linkedApt.user_id;
        if (aptPatientId && aptPatientId !== 'guest') return aptPatientId;
      }
    }

    // 5. Match against users loaded from database
    if (email && Array.isArray(users) && users.length > 0) {
      const match = users.find(u => u.email && u.email.trim().toLowerCase() === email);
      if (match?.id) return match.id;
    }

    // 6. Local dynamic cache fallback
    try {
      const cached = localStorage.getItem('cached_dynamic_patients');
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list)) {
          if (email) {
            const match = list.find(c => c.email && c.email.trim().toLowerCase() === email);
            if (match?.id) return match.id;
          }
          if (name && name !== 'guest patient') {
            const match = list.find(c => {
              const cName = (c.name || c.full_name || '').trim().toLowerCase();
              return cName && cName === name;
            });
            if (match?.id) return match.id;
          }
        }
      }
    } catch (_) {}

    return null;
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [selectedPayment, setSelectedPayment] = useState(null);
  const [editPayment, setEditPayment] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const location = useLocation();

  // Auto-open payment details drawer when navigated from a notification
  useEffect(() => {
    const targetId = location.state?.selectedPaymentId || location.state?.highlightId;
    if (targetId && payments.length > 0) {
      const match = payments.find(p => 
        String(p.id).toLowerCase() === String(targetId).toLowerCase() ||
        String(p.transaction_id || '').toLowerCase() === String(targetId).toLowerCase()
      );
      if (match) {
        setSelectedPayment(match);
      }
    }
  }, [location.state, payments]);

  // Vertical Three-Dot Action Dropdown Menu State
  const [actionMenuPaymentId, setActionMenuPaymentId] = useState(null);
  const [actionMenuPosition, setActionMenuPosition] = useState(null);

  // Close Action Dropdown on click outside or window scroll
  useEffect(() => {
    const handleClose = () => {
      setActionMenuPaymentId(null);
      setActionMenuPosition(null);
    };
    window.addEventListener('click', handleClose);
    window.addEventListener('scroll', handleClose, true);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('scroll', handleClose, true);
    };
  }, []);

  const handleUpdateStatus = async (status) => {
    if (!editPayment) return;
    try {
      await updateItem('payments', editPayment.id, {
        status,
        payment_status: status.toLowerCase()
      });
      setEditPayment(null);
    } catch (err) {
      console.error('Failed to update payment status:', err);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmId) {
      try {
        await deleteItem('payments', deleteConfirmId);
        setDeleteConfirmId(null);
      } catch (err) {
        console.error('Failed to delete payment record:', err);
      }
    }
  };

  // Dynamic status options based on live payments data
  const statusOptions = useMemo(() => {
    const statusSet = new Set(['Paid', 'Pending', 'Refunded', 'Failed']);
    payments.forEach((p) => {
      if (p.status) statusSet.add(p.status);
    });
    return [
      { label: 'All Statuses', value: 'ALL' },
      ...Array.from(statusSet).map((st) => ({ label: st, value: st }))
    ];
  }, [payments]);

  // Dynamic Summary Metrics computed directly from Supabase payment data
  const summaryMetrics = useMemo(() => {
    let totalRevenue = 0;
    let settledCount = 0;
    let pendingRevenue = 0;
    let pendingCount = 0;
    let refundedRevenue = 0;
    let refundedCount = 0;

    payments.forEach((p) => {
      const amt = Number(p.amount ?? p.total_amount ?? 0);
      const st = String(p.status || p.payment_status || '').toLowerCase();
      if (st === 'paid') {
        totalRevenue += amt;
        settledCount += 1;
      } else if (st === 'pending') {
        pendingRevenue += amt;
        pendingCount += 1;
      } else if (st === 'refunded') {
        refundedRevenue += amt;
        refundedCount += 1;
      }
    });

    return {
      totalRevenue: totalRevenue || (stats?.totalRevenue ?? 0),
      settledCount,
      pendingRevenue: pendingRevenue || (stats?.pendingRevenue ?? 0),
      pendingCount,
      refundedRevenue: refundedRevenue || (stats?.refundedRevenue ?? 0),
      refundedCount
    };
  }, [payments, stats]);

  // Filtered Payments for search term and status
  const filteredPayments = useMemo(() => {
    return payments.filter((pay) => {
      const searchLower = searchTerm.trim().toLowerCase();
      const rawTxn = String(pay.transactionId || pay.transaction_id || pay.order_id || pay.stripe_payment_intent_id || '');
      const rawClient = String(pay.clientName || pay.customer_name || pay.client_name || '');
      const rawEmail = String(pay.clientEmail || pay.customer_email || pay.client_email || '');
      const rawMethod = String(pay.paymentMethod || pay.payment_method || pay.method || '');
      const rawStatus = String(pay.status || pay.payment_status || '');

      const matchSearch =
        !searchLower ||
        rawTxn.toLowerCase().includes(searchLower) ||
        rawClient.toLowerCase().includes(searchLower) ||
        rawEmail.toLowerCase().includes(searchLower) ||
        rawMethod.toLowerCase().includes(searchLower) ||
        rawStatus.toLowerCase().includes(searchLower);

      const matchStatus =
        statusFilter === 'ALL' ||
        rawStatus.toLowerCase() === statusFilter.toLowerCase();

      return matchSearch && matchStatus;
    });
  }, [payments, searchTerm, statusFilter]);

  // Active payment for currently open action menu
  const activePayment = useMemo(
    () => payments.find((p) => String(p.id) === String(actionMenuPaymentId)),
    [payments, actionMenuPaymentId]
  );

  // Table Columns - Appointment/Reference column removed
  const columns = [
    {
      header: 'Transaction ID',
      accessor: 'transactionId',
      sortable: true,
      width: '180px',
      minWidth: '150px',
      render: (row) => {
        const rawId = String(row.transactionId || '—');
        const shortId = rawId.length > 18 ? `${rawId.slice(0, 10)}...${rawId.slice(-4)}` : rawId;
        return (
          <span
            title={rawId}
            style={{
              fontWeight: 700,
              color: '#1e5aa8',
              fontFamily: 'monospace',
              fontSize: '0.82rem',
              letterSpacing: '-0.02em',
              background: '#f8fafc',
              padding: '3px 7px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              display: 'inline-block'
            }}
          >
            {shortId}
          </span>
        );
      }
    },
    {
      header: 'Client / Patient',
      accessor: 'clientName',
      sortable: true,
      minWidth: '160px',
      render: (row) => {
        const name = row.clientName || row.customer_name || 'Guest Patient';
        const email = row.clientEmail || row.customer_email || '';
        const patientId = getPatientId(row);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '200px' }}>
            {patientId ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/patients/${patientId}`);
                }}
                title={`View Patient Profile: ${name}`}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: '#0f2942',
                  fontSize: '0.86rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  maxWidth: '100%',
                  transition: 'color 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#1e5aa8'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#0f2942'; }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {name}
                </span>
                <ExternalLink size={12} color="#94a3b8" style={{ flexShrink: 0 }} />
              </button>
            ) : (
              <div style={{ fontWeight: 600, color: '#0f2942', fontSize: '0.86rem' }}>
                {name}
              </div>
            )}
            {email ? (
              <div style={{ fontSize: '0.74rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {email}
              </div>
            ) : null}
          </div>
        );
      }
    },
    {
      header: 'Amount',
      accessor: 'amount',
      sortable: true,
      width: '120px',
      minWidth: '100px',
      render: (row) => {
        const amt = Number(row.amount ?? row.total_amount ?? 0);
        return (
          <div style={{ fontWeight: 700, color: '#15803d', fontSize: '0.86rem', fontVariantNumeric: 'tabular-nums' }}>
            ${amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        );
      }
    },
    {
      header: 'Payment Method',
      accessor: 'paymentMethod',
      width: '160px',
      minWidth: '140px',
      render: (row) => (
        <span style={{ fontSize: '0.84rem', color: '#475569' }}>
          {row.paymentMethod || row.payment_method || 'Stripe'}
        </span>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      width: '120px',
      minWidth: '110px',
      render: (row) => <AdminBadge status={row.status} />
    },
    {
      header: 'Date & Time',
      accessor: 'date',
      sortable: true,
      width: '170px',
      minWidth: '150px',
      render: (row) => (
        <span style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>
          {row.date || '—'}
        </span>
      )
    },
    {
      header: 'Actions',
      align: 'right',
      width: '70px',
      minWidth: '60px',
      render: (row) => {
        const isMenuOpen = actionMenuPaymentId === row.id;
        return (
          <div style={{ display: 'inline-flex', justifyContent: 'flex-end', width: '100%', position: 'relative' }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (actionMenuPaymentId === row.id) {
                  setActionMenuPaymentId(null);
                  setActionMenuPosition(null);
                } else {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const dropdownHeight = 170;
                  const spaceBelow = window.innerHeight - rect.bottom;
                  const openUpward = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
                  setActionMenuPosition({
                    top: openUpward ? rect.top - dropdownHeight - 6 : rect.bottom + 6,
                    right: Math.max(16, window.innerWidth - rect.right)
                  });
                  setActionMenuPaymentId(row.id);
                }
              }}
              title="Payment Actions"
              aria-label="Payment actions menu"
              aria-haspopup="true"
              aria-expanded={isMenuOpen}
              style={{
                background: isMenuOpen ? '#e2e8f0' : '#f8fafc',
                border: '1px solid',
                borderColor: isMenuOpen ? '#94a3b8' : '#cbd5e1',
                padding: '6px',
                borderRadius: '6px',
                cursor: 'pointer',
                color: '#334155',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
            >
              <MoreVertical size={16} />
            </button>
          </div>
        );
      }
    }
  ];

  // Mobile Card Renderer for smaller screens
  const renderMobileCard = (row) => {
    const isMenuOpen = actionMenuPaymentId === row.id;
    const rawId = String(row.transactionId || '—');
    const shortId = rawId.length > 18 ? `${rawId.slice(0, 10)}...${rawId.slice(-4)}` : rawId;
    const amt = Number(row.amount ?? row.total_amount ?? 0);

    return (
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '14px 16px',
          boxShadow: '0 1px 3px rgba(15, 41, 66, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          position: 'relative'
        }}
      >
        {/* Top: Transaction ID + Action Trigger */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span
            title={rawId}
            style={{
              fontWeight: 700,
              color: '#1e5aa8',
              fontFamily: 'monospace',
              fontSize: '0.82rem',
              letterSpacing: '-0.02em',
              background: '#f8fafc',
              padding: '3px 7px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0'
            }}
          >
            {shortId}
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (actionMenuPaymentId === row.id) {
                setActionMenuPaymentId(null);
                setActionMenuPosition(null);
              } else {
                const rect = e.currentTarget.getBoundingClientRect();
                const dropdownHeight = 170;
                const spaceBelow = window.innerHeight - rect.bottom;
                const openUpward = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
                setActionMenuPosition({
                  top: openUpward ? rect.top - dropdownHeight - 6 : rect.bottom + 6,
                  right: Math.max(12, window.innerWidth - rect.right)
                });
                setActionMenuPaymentId(row.id);
              }
            }}
            title="Payment Actions"
            aria-label="Payment actions menu"
            style={{
              background: isMenuOpen ? '#e2e8f0' : '#f8fafc',
              border: '1px solid',
              borderColor: isMenuOpen ? '#94a3b8' : '#cbd5e1',
              borderRadius: '6px',
              padding: '5px 7px',
              cursor: 'pointer',
              color: '#334155',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <MoreVertical size={16} />
          </button>
        </div>

        {/* Client / Patient */}
        <div>
          {(() => {
            const patientId = getPatientId(row);
            const name = row.clientName || row.customer_name || 'Guest Patient';
            return patientId ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/patients/${patientId}`);
                }}
                title={`View Patient Profile: ${name}`}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  color: '#0f2942',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'color 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#1e5aa8'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#0f2942'; }}
              >
                <span>{name}</span>
                <ExternalLink size={12} color="#94a3b8" />
              </button>
            ) : (
              <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f2942' }}>
                {name}
              </div>
            );
          })()}
          {row.clientEmail && (
            <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
              {row.clientEmail}
            </div>
          )}
        </div>

        {/* Amount & Status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
          <div>
            <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
              Amount Settled
            </span>
            <div style={{ fontWeight: 700, color: '#15803d', fontSize: '0.92rem', fontVariantNumeric: 'tabular-nums' }}>
              ${amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <AdminBadge status={row.status} />
          </div>
        </div>

        {/* Method & Date Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b' }}>
          <span>{row.paymentMethod || row.payment_method || 'Stripe'}</span>
          <span>{row.date || '—'}</span>
        </div>
      </div>
    );
  };

  const formatCardAmount = (val) => {
    const num = Number(val || 0);
    return '$' + num.toLocaleString('en-US', {
      minimumFractionDigits: num % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    });
  };

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
          value={formatCardAmount(summaryMetrics.totalRevenue)}
          subtitle="All confirmed and settled transactions"
          icon={<DollarSign size={20} />}
          iconBg="#dcfce7"
          iconColor="#15803d"
          valueStyle={{ fontSize: '1.45rem', fontWeight: 700, letterSpacing: '-0.02em' }}
        />

        <AdminCard
          title="Settled Payments"
          value={summaryMetrics.settledCount}
          subtitle="Successfully processed transactions"
          icon={<CheckCircle size={20} />}
          iconBg="#f0fdf4"
          iconColor="#16a34a"
          valueStyle={{ fontSize: '1.45rem', fontWeight: 700, letterSpacing: '-0.02em' }}
        />

        <AdminCard
          title="Pending Payments"
          value={formatCardAmount(summaryMetrics.pendingRevenue)}
          subtitle={`${summaryMetrics.pendingCount} pending collection`}
          icon={<Clock size={20} />}
          iconBg="#fef3c7"
          iconColor="#b45309"
          valueStyle={{ fontSize: '1.45rem', fontWeight: 700, letterSpacing: '-0.02em' }}
        />

        <AdminCard
          title="Refunded Volume"
          value={formatCardAmount(summaryMetrics.refundedRevenue)}
          subtitle={`${summaryMetrics.refundedCount} refunded orders`}
          icon={<RotateCcw size={20} />}
          iconBg="#f1f5f9"
          iconColor="#475569"
          valueStyle={{ fontSize: '1.45rem', fontWeight: 700, letterSpacing: '-0.02em' }}
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
            options: statusOptions
          }
        ]}
      />

      <AdminTable
        columns={columns}
        data={filteredPayments}
        loading={isLoading}
        loadingMessage="Loading payment transactions..."
        error={error}
        itemsPerPage={10}
        emptyTitle="No transactions found"
        emptyDescription="No payment records match your selected criteria."
        renderMobileCard={renderMobileCard}
      />

      {/* Fixed Viewport Dropdown Menu for Actions */}
      {actionMenuPaymentId && actionMenuPosition && activePayment && (
        <div
          className="payment-action-dropdown-menu"
          style={{
            position: 'fixed',
            top: `${actionMenuPosition.top}px`,
            right: `${actionMenuPosition.right}px`,
            width: '185px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(15, 41, 66, 0.14), 0 8px 10px -6px rgba(15, 41, 66, 0.08)',
            zIndex: 99999,
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            textAlign: 'left'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 1. View Payment Details */}
          <button
            type="button"
            onClick={() => {
              setSelectedPayment(activePayment);
              setActionMenuPaymentId(null);
              setActionMenuPosition(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '8px 10px',
              border: 'none',
              background: 'transparent',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 500,
              color: '#0f2942',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f7ff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Eye size={15} color="#1e5aa8" />
            <span>View Payment Details</span>
          </button>

          {/* View Patient Profile */}
          {getPatientId(activePayment) && (
            <button
              type="button"
              onClick={() => {
                const targetPatientId = getPatientId(activePayment);
                setActionMenuPaymentId(null);
                setActionMenuPosition(null);
                navigate(`/patients/${targetPatientId}`);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '8px 10px',
                border: 'none',
                background: 'transparent',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 500,
                color: '#0f2942',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f7ff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <User size={15} color="#1e5aa8" />
              <span>View Patient Profile</span>
            </button>
          )}

          {/* 2. Edit Payment Status */}
          <button
            type="button"
            onClick={() => {
              setEditPayment(activePayment);
              setActionMenuPaymentId(null);
              setActionMenuPosition(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '8px 10px',
              border: 'none',
              background: 'transparent',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 500,
              color: '#0f2942',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f7ff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Edit2 size={15} color="#475569" />
            <span>Edit Payment</span>
          </button>



          <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 0' }} />

          {/* 4. Delete Payment */}
          <button
            type="button"
            onClick={() => {
              setDeleteConfirmId(activePayment.id);
              setActionMenuPaymentId(null);
              setActionMenuPosition(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '8px 10px',
              border: 'none',
              background: 'transparent',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 500,
              color: '#b91c1c',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Trash2 size={15} color="#b91c1c" />
            <span>Delete Payment</span>
          </button>
        </div>
      )}

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
                  ${Number(selectedPayment.amount || selectedPayment.total_amount || 0).toFixed(2)}
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
                  {(() => {
                    const patientId = getPatientId(selectedPayment);
                    const name = selectedPayment.clientName || 'Guest Patient';
                    return patientId ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPayment(null);
                          navigate(`/patients/${patientId}`);
                        }}
                        title={`View Patient Profile: ${name}`}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontWeight: 600,
                          color: '#1e5aa8',
                          fontSize: '0.84rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                      >
                        <span>{name}</span>
                        <ExternalLink size={12} />
                      </button>
                    ) : (
                      <span style={{ fontWeight: 600 }}>{name}</span>
                    );
                  })()}
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Payment Method</span>
                  <span>{selectedPayment.paymentMethod}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Origin / Purpose</span>
                  <span>{selectedPayment.type || (selectedPayment.order_id ? `Order #${selectedPayment.order_id}` : 'Direct Payment')}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Reference Code</span>
                  <span style={{ fontFamily: 'monospace' }}>{selectedPayment.referenceId || selectedPayment.order_id || selectedPayment.transactionId}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Processed Timestamp</span>
                  <span>{selectedPayment.date || '—'}</span>
                </div>
                {selectedPayment.clientEmail && (
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Email</span>
                    <span>{selectedPayment.clientEmail}</span>
                  </div>
                )}
                {selectedPayment.clientPhone && (
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Phone</span>
                    <span>{selectedPayment.clientPhone}</span>
                  </div>
                )}
                {selectedPayment.stripe_payment_intent_id && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Stripe Payment Intent</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', wordBreak: 'break-all' }}>{selectedPayment.stripe_payment_intent_id}</span>
                  </div>
                )}
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
