import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Eye,
  Edit2,
  Trash2,
  Package,
  Truck,
  DollarSign,
  User,
  Calendar,
  MoreVertical,
  Plus,
  CreditCard,
  Settings,
  RefreshCw,
  ExternalLink,
  Copy
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAdminData } from '../../context/AdminDataContext';
import { AdminTable } from '../../components/admin/ui/AdminTable';
import { AdminToolbar } from '../../components/admin/ui/AdminToolbar';
import { AdminBadge } from '../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../components/admin/ui/AdminButton';
import { AdminModal } from '../../components/admin/ui/AdminModal';
import { AdminConfirmDialog } from '../../components/admin/ui/AdminConfirmDialog';
import {
  fetchAllOrders,
  fetchOrderStatuses,
  deleteOrder,
  updateOrderStatusAndDetails,
  normalizeOrder
} from '../../services/orderService';
import { AddEditOrderModal } from '../../components/admin/orders/AddEditOrderModal';
import { ManageOrderStatusesModal } from '../../components/admin/orders/ManageOrderStatusesModal';
import { StripeOrderPaymentModal } from '../../components/admin/orders/StripeOrderPaymentModal';
import { UpdateOrderStatusModal } from '../../components/admin/orders/UpdateOrderStatusModal';

export const OrdersPage = () => {
  const navigate = useNavigate();
  const {
    orders: contextOrders = [],
    clients: contextClients = [],
    products: contextProducts = [],
    updateItem,
    deleteItem,
    isLoading: contextLoading
  } = useAdminData();

  // Local state
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [statuses, setStatuses] = useState([]);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL');

  // Action Menu State (Fixed Viewport Positioned Dropdown)
  const [actionMenuOrderId, setActionMenuOrderId] = useState(null);
  const [actionMenuPosition, setActionMenuPosition] = useState(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState(null);
  const [orderToUpdateStatus, setOrderToUpdateStatus] = useState(null);
  const [isManageStatusesOpen, setIsManageStatusesOpen] = useState(false);
  const [orderForPayment, setOrderForPayment] = useState(null);
  const [deleteConfirmOrder, setDeleteConfirmOrder] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Close Action Dropdown on click outside or scroll
  useEffect(() => {
    const handleClose = () => {
      setActionMenuOrderId(null);
      setActionMenuPosition(null);
    };
    window.addEventListener('click', handleClose);
    window.addEventListener('scroll', handleClose, true);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('scroll', handleClose, true);
    };
  }, []);

  // 1. Fetch Orders from Supabase dynamically
  const loadOrders = async () => {
    try {
      setLoadingOrders(true);
      const data = await fetchAllOrders(contextClients);
      setOrders(data);
    } catch (err) {
      console.error('Failed to load orders from Supabase:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  // 2. Fetch Order Statuses dynamically
  const loadStatuses = async () => {
    try {
      const st = await fetchOrderStatuses();
      setStatuses(st || []);
    } catch (err) {
      console.error('Failed to load order statuses:', err);
    }
  };

  useEffect(() => {
    loadOrders();
    loadStatuses();
  }, [contextClients]);

  // Synchronize when context orders change
  useEffect(() => {
    if (contextOrders && contextOrders.length > 0) {
      const normalized = contextOrders.map((o) => normalizeOrder(o, contextClients));
      setOrders(normalized);
    }
  }, [contextOrders, contextClients]);

  // Handle Delete Order
  const handleDeleteOrder = async () => {
    if (!deleteConfirmOrder) return;
    setIsDeleting(true);
    try {
      const res = await deleteOrder(deleteConfirmOrder.id);
      if (res.success) {
        toast.success(`Order #${deleteConfirmOrder.id} deleted successfully`);
        setOrders((prev) => prev.filter((o) => o.id !== deleteConfirmOrder.id));
        if (deleteItem) deleteItem('orders', deleteConfirmOrder.id);
        setDeleteConfirmOrder(null);
      } else {
        toast.error('Failed to delete order record');
      }
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Error deleting order');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      const searchLower = searchTerm.toLowerCase();

      // Search across Order ID, Client Name, Tracking Number, Product Names
      const matchSearch =
        !searchTerm ||
        ord.id.toLowerCase().includes(searchLower) ||
        (ord.clientName && ord.clientName.toLowerCase().includes(searchLower)) ||
        (ord.clientEmail && ord.clientEmail.toLowerCase().includes(searchLower)) ||
        (ord.trackingNumber && ord.trackingNumber.toLowerCase().includes(searchLower)) ||
        (Array.isArray(ord.items) && ord.items.some((it) => it.name && it.name.toLowerCase().includes(searchLower)));

      const matchOrder =
        orderStatusFilter === 'ALL' ||
        (ord.orderStatus || ord.status || '').toLowerCase() === orderStatusFilter.toLowerCase();

      const matchPayment =
        paymentStatusFilter === 'ALL' ||
        (ord.paymentStatus || ord.payment_status || '').toLowerCase() === paymentStatusFilter.toLowerCase();

      return matchSearch && matchOrder && matchPayment;
    });
  }, [orders, searchTerm, orderStatusFilter, paymentStatusFilter]);

  // Order Status options for toolbar dropdown
  const statusFilterOptions = useMemo(() => {
    const list = [{ label: 'All Order Status', value: 'ALL' }];
    statuses.forEach((s) => {
      list.push({ label: s.name, value: s.name });
    });
    return list;
  }, [statuses]);

  // Helper to copy Order ID
  const handleCopyOrderId = (e, id) => {
    e.stopPropagation();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(id);
      toast.success('Order ID copied to clipboard');
    }
  };

  // Define Table Columns (Enhanced Layout & Controlled Wrapping)
  const columns = [
    {
      header: 'Order ID',
      accessor: 'id',
      sortable: true,
      width: '145px',
      minWidth: '135px',
      render: (row) => {
        const rawId = String(row.id || '');
        const shortId = rawId.length > 14 ? `#${rawId.slice(0, 8)}...${rawId.slice(-4)}` : `#${rawId}`;
        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              onClick={() => navigate(`/orders/${row.id}`)}
              title={`Order #${rawId} • Click to view details`}
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '3px 7px',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: 700,
                fontSize: '0.78rem',
                color: '#1e5aa8',
                fontFamily: 'monospace',
                letterSpacing: '-0.02em',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                maxWidth: '115px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#eff6ff';
                e.currentTarget.style.borderColor = '#bfdbfe';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {shortId}
              </span>
            </button>
            <button
              type="button"
              onClick={(e) => handleCopyOrderId(e, rawId)}
              title="Copy full Order ID"
              style={{
                background: 'none',
                border: 'none',
                padding: '3px',
                cursor: 'pointer',
                color: '#94a3b8',
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: '4px',
                transition: 'color 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#1e5aa8'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
            >
              <Copy size={12} />
            </button>
          </div>
        );
      }
    },
    {
      header: 'Client / Patient',
      accessor: 'clientName',
      sortable: true,
      width: '185px',
      minWidth: '155px',
      render: (row) => {
        const patientUUID = row.clientId || row.client_id;
        const name = row.clientName || 'Unknown Patient';
        const email = row.clientEmail || '';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '175px' }}>
            {patientUUID ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/patients/${patientUUID}`);
                }}
                title={`View Patient Profile: ${name}`}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  color: '#0f2942',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  maxWidth: '100%'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#1e5aa8'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#0f2942'; }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {name}
                </span>
                <ExternalLink size={11} color="#94a3b8" style={{ flexShrink: 0 }} />
              </button>
            ) : (
              <div
                title={name}
                style={{
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  color: '#0f2942',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {name}
              </div>
            )}
            {email ? (
              <div
                title={email}
                style={{
                  fontSize: '0.74rem',
                  color: '#64748b',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {email}
              </div>
            ) : (
              <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>—</div>
            )}
          </div>
        );
      }
    },
    {
      header: 'Purchased Items',
      accessor: 'items',
      width: '230px',
      minWidth: '190px',
      render: (row) => {
        const items = Array.isArray(row.items) ? row.items : [];
        if (items.length === 0) {
          return <div style={{ fontSize: '0.82rem', color: '#64748b' }}>1× Formulation</div>;
        }

        const allItemsTooltip = items
          .map((it) => `${it.qty || it.quantity || 1}× ${it.name || 'Prescription Formulation'}`)
          .join('\n');

        const firstItem = items[0];
        const firstItemLabel = `${firstItem.qty || firstItem.quantity || 1}× ${firstItem.name || 'Prescription'}`;
        const extraCount = items.length - 1;

        return (
          <div
            title={allItemsTooltip}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              maxWidth: '220px'
            }}
          >
            <div
              style={{
                fontSize: '0.83rem',
                color: '#1e293b',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {firstItemLabel}
            </div>
            {items.length === 2 ? (
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#64748b',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {items[1].qty || items[1].quantity || 1}× {items[1].name || 'Prescription'}
              </div>
            ) : extraCount > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/orders/${row.id}`);
                  }}
                  title={allItemsTooltip}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '1px 7px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: '#1e5aa8',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e0f2fe';
                    e.currentTarget.style.borderColor = '#bae6fd';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  +{extraCount} more items
                </button>
              </div>
            ) : null}
          </div>
        );
      }
    },
    {
      header: 'Total Amount',
      accessor: 'totalAmount',
      sortable: true,
      width: '105px',
      minWidth: '95px',
      render: (row) => (
        <div
          style={{
            fontWeight: 700,
            color: '#15803d',
            fontSize: '0.88rem',
            whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          ${Number(row.totalAmount || row.total || 0).toFixed(2)}
        </div>
      )
    },
    {
      header: 'Payment Status',
      accessor: 'paymentStatus',
      sortable: true,
      width: '120px',
      minWidth: '105px',
      render: (row) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          <AdminBadge status={row.paymentStatus || row.payment_status} />
        </div>
      )
    },
    {
      header: 'Order Status',
      accessor: 'orderStatus',
      sortable: true,
      width: '135px',
      minWidth: '115px',
      render: (row) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          <AdminBadge status={row.orderStatus || row.status} />
        </div>
      )
    },
    {
      header: 'Date',
      accessor: 'date',
      sortable: true,
      width: '100px',
      minWidth: '90px',
      render: (row) => (
        <span style={{ fontSize: '0.8rem', color: '#475569', whiteSpace: 'nowrap' }}>
          {row.date}
        </span>
      )
    },
    {
      header: 'Actions',
      align: 'right',
      width: '55px',
      minWidth: '50px',
      render: (row) => {
        const isMenuOpen = actionMenuOrderId === row.id;
        const isPaid = (row.paymentStatus || row.payment_status || '').toLowerCase() === 'paid';
        const needsPayment = !isPaid || Number(row.outstandingBalance ?? 0) > 0;

        return (
          <div style={{ display: 'inline-flex', justifyContent: 'flex-end', width: '100%' }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (actionMenuOrderId === row.id) {
                  setActionMenuOrderId(null);
                  setActionMenuPosition(null);
                } else {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const dropdownHeight = needsPayment ? 210 : 175;
                  const spaceBelow = window.innerHeight - rect.bottom;
                  const openUpward = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
                  setActionMenuPosition({
                    top: openUpward ? rect.top - dropdownHeight - 6 : rect.bottom + 6,
                    right: Math.max(16, window.innerWidth - rect.right)
                  });
                  setActionMenuOrderId(row.id);
                }
              }}
              title="Order Actions"
              aria-label="Order actions menu"
              aria-haspopup="true"
              aria-expanded={isMenuOpen}
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

  // Mobile Card Renderer (Compact responsive presentation)
  const renderMobileCard = (row) => {
    const isMenuOpen = actionMenuOrderId === row.id;
    const isPaid = (row.paymentStatus || row.payment_status || '').toLowerCase() === 'paid';
    const needsPayment = !isPaid || Number(row.outstandingBalance ?? 0) > 0;
    const patientUUID = row.clientId || row.client_id;
    const rawId = String(row.id || '');
    const shortId = rawId.length > 14 ? `#${rawId.slice(0, 8)}...${rawId.slice(-4)}` : `#${rawId}`;
    const items = Array.isArray(row.items) ? row.items : [];
    const firstItem = items[0] || null;
    const extraCount = Math.max(0, items.length - 1);
    const allItemsTooltip = items
      .map((it) => `${it.qty || it.quantity || 1}× ${it.name || 'Prescription Formulation'}`)
      .join('\n');

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
        {/* 1. Header: Order ID (left) + Three-Dot Action Trigger (right) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              onClick={() => navigate(`/orders/${row.id}`)}
              title={`Order #${rawId} • Click to view details`}
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '3px 8px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.8rem',
                color: '#1e5aa8',
                fontFamily: 'monospace',
                display: 'inline-flex',
                alignItems: 'center'
              }}
            >
              <span>{shortId}</span>
            </button>
            <button
              type="button"
              onClick={(e) => handleCopyOrderId(e, rawId)}
              title="Copy full Order ID"
              style={{
                background: 'none',
                border: 'none',
                padding: '3px',
                cursor: 'pointer',
                color: '#94a3b8',
                display: 'inline-flex',
                alignItems: 'center'
              }}
            >
              <Copy size={12} />
            </button>
          </div>

          {/* Action Trigger */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (actionMenuOrderId === row.id) {
                setActionMenuOrderId(null);
                setActionMenuPosition(null);
              } else {
                const rect = e.currentTarget.getBoundingClientRect();
                const dropdownHeight = needsPayment ? 210 : 175;
                const spaceBelow = window.innerHeight - rect.bottom;
                const openUpward = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
                setActionMenuPosition({
                  top: openUpward ? rect.top - dropdownHeight - 6 : rect.bottom + 6,
                  right: Math.max(12, window.innerWidth - rect.right)
                });
                setActionMenuOrderId(row.id);
              }
            }}
            title="Order Actions"
            aria-label="Order actions menu"
            aria-haspopup="true"
            aria-expanded={isMenuOpen}
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

        {/* 2. Client / Patient */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {patientUUID ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/patients/${patientUUID}`);
              }}
              title="View Patient Profile"
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
                gap: '4px'
              }}
            >
              <span>{row.clientName || 'Unknown Patient'}</span>
              <ExternalLink size={11} color="#94a3b8" />
            </button>
          ) : (
            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f2942' }}>
              {row.clientName || 'Unknown Patient'}
            </div>
          )}
          <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
            {row.clientEmail || '—'}
          </div>
        </div>

        {/* 3. Purchased Items */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #f1f5f9',
            borderRadius: '8px',
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px'
          }}
        >
          <div
            title={allItemsTooltip}
            style={{
              fontSize: '0.82rem',
              color: '#334155',
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {firstItem ? `${firstItem.qty || firstItem.quantity || 1}× ${firstItem.name}` : '1× Formulation'}
          </div>
          {extraCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span
                title={allItemsTooltip}
                onClick={() => navigate(`/orders/${row.id}`)}
                style={{
                  cursor: 'pointer',
                  fontSize: '0.72rem',
                  color: '#1e5aa8',
                  fontWeight: 600
                }}
              >
                +{extraCount} more items
              </span>
            </div>
          )}
        </div>

        {/* 4. Total Amount + Badges + Date */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', paddingTop: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: '#15803d', fontSize: '0.92rem', fontVariantNumeric: 'tabular-nums' }}>
              ${Number(row.totalAmount || row.total || 0).toFixed(2)}
            </span>
            <AdminBadge status={row.paymentStatus || row.payment_status} />
            <AdminBadge status={row.orderStatus || row.status} />
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748b', whiteSpace: 'nowrap' }}>
            {row.date}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* ─────────────────────────────────────────────
          PAGE HEADER WITH ACTIONS
          ───────────────────────────────────────────── */}
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div className="admin-page-title">
          <h1>Apothecary Orders & Shipments</h1>
          <p>Fulfill online apothecary orders, review line items, and manage customer shipments.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AdminButton
            variant="secondary"
            onClick={() => setIsManageStatusesOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <Settings size={15} />
            <span>Manage Statuses</span>
          </AdminButton>

          <AdminButton
            variant="primary"
            onClick={() => setIsAddModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={16} />
            <span>Add Order</span>
          </AdminButton>
        </div>
      </div>

      {/* ─────────────────────────────────────────────
          TOOLBAR (SEARCH & DYNAMIC FILTERS)
          ───────────────────────────────────────────── */}
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
            options: statusFilterOptions
          },
          {
            id: 'paymentStatus',
            value: paymentStatusFilter,
            onChange: setPaymentStatusFilter,
            options: [
              { label: 'All Payment Status', value: 'ALL' },
              { label: 'Paid', value: 'Paid' },
              { label: 'Pending', value: 'Pending' },
              { label: 'Unpaid', value: 'Unpaid' },
              { label: 'Refunded', value: 'Refunded' },
              { label: 'Failed', value: 'Failed' }
            ]
          }
        ]}
      />

      {/* ─────────────────────────────────────────────
          ORDERS TABLE
          ───────────────────────────────────────────── */}
      <AdminTable
        columns={columns}
        data={filteredOrders}
        loading={loadingOrders || contextLoading}
        itemsPerPage={8}
        renderMobileCard={renderMobileCard}
        emptyTitle="No orders found"
        emptyDescription="There are currently no apothecary customer orders matching your criteria."
      />

      {/* ─────────────────────────────────────────────
          GLOBAL THREE-DOT ACTION MENU PORTAL
          ───────────────────────────────────────────── */}
      {actionMenuOrderId && actionMenuPosition && (() => {
        const row = orders.find((o) => o.id === actionMenuOrderId);
        if (!row) return null;
        const isPaid = (row.paymentStatus || row.payment_status || '').toLowerCase() === 'paid';
        const needsPayment = !isPaid || Number(row.outstandingBalance ?? 0) > 0;

        return (
          <div
            className="order-action-dropdown-menu"
            style={{
              position: 'fixed',
              top: `${actionMenuPosition.top}px`,
              right: `${actionMenuPosition.right}px`,
              width: '180px',
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
            {/* 1. View Order Details */}
            <button
              type="button"
              onClick={() => {
                setActionMenuOrderId(null);
                setActionMenuPosition(null);
                navigate(`/orders/${row.id}`);
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
              <span>View Order Details</span>
            </button>

            {/* 2. Edit Order */}
            <button
              type="button"
              onClick={() => {
                setActionMenuOrderId(null);
                setActionMenuPosition(null);
                setOrderToEdit(row);
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
              <span>Edit Order</span>
            </button>

            {/* 3. Update Order Status */}
            <button
              type="button"
              onClick={() => {
                setActionMenuOrderId(null);
                setActionMenuPosition(null);
                setOrderToUpdateStatus(row);
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
              <Truck size={15} color="#0891b2" />
              <span>Update Order Status</span>
            </button>

            {/* 4. Pay Now (Only if outstanding / unpaid) */}
            {needsPayment && (
              <button
                type="button"
                onClick={() => {
                  setActionMenuOrderId(null);
                  setActionMenuPosition(null);
                  setOrderForPayment(row);
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
                  fontWeight: 600,
                  color: '#15803d',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#ecfdf5'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <CreditCard size={15} color="#15803d" />
                <span>Pay Now (${Number(row.outstandingBalance || row.total || 0).toFixed(2)})</span>
              </button>
            )}

            <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 0' }} />

            {/* 5. Delete Order */}
            <button
              type="button"
              onClick={() => {
                setActionMenuOrderId(null);
                setActionMenuPosition(null);
                setDeleteConfirmOrder(row);
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
              <span>Delete Order</span>
            </button>
          </div>
        );
      })()}

      {/* ─────────────────────────────────────────────
          MODAL 1: ADD NEW ORDER
          ───────────────────────────────────────────── */}
      {isAddModalOpen && (
        <AddEditOrderModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          patients={contextClients}
          products={contextProducts}
          statuses={statuses}
          onOrderSaved={(newOrder) => {
            setOrders((prev) => [newOrder, ...prev]);
            loadOrders();
          }}
        />
      )}

      {/* ─────────────────────────────────────────────
          MODAL 2: EDIT ORDER
          ───────────────────────────────────────────── */}
      {orderToEdit && (
        <AddEditOrderModal
          isOpen={Boolean(orderToEdit)}
          onClose={() => setOrderToEdit(null)}
          orderToEdit={orderToEdit}
          patients={contextClients}
          products={contextProducts}
          statuses={statuses}
          onOrderSaved={(updated) => {
            setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
            if (updateItem) updateItem('orders', updated.id, updated);
            setOrderToEdit(null);
          }}
        />
      )}

      {/* ─────────────────────────────────────────────
          MODAL 3: UPDATE ORDER STATUS MODAL
          ───────────────────────────────────────────── */}
      {orderToUpdateStatus && (
        <UpdateOrderStatusModal
          isOpen={Boolean(orderToUpdateStatus)}
          onClose={() => setOrderToUpdateStatus(null)}
          order={orderToUpdateStatus}
          onStatusUpdated={(updatedOrder) => {
            setOrders((prev) =>
              prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
            );
            if (updateItem) {
              updateItem('orders', updatedOrder.id, updatedOrder);
            }
            loadOrders();
          }}
        />
      )}


      {/* ─────────────────────────────────────────────
          MODAL 4: MANAGE ORDER STATUSES
          ───────────────────────────────────────────── */}
      {isManageStatusesOpen && (
        <ManageOrderStatusesModal
          isOpen={isManageStatusesOpen}
          onClose={() => setIsManageStatusesOpen(false)}
          orders={orders}
          onStatusesUpdated={(updatedList) => {
            setStatuses(updatedList);
          }}
        />
      )}

      {/* ─────────────────────────────────────────────
          MODAL 5: STRIPE PAY NOW MODAL
          ───────────────────────────────────────────── */}
      {orderForPayment && (
        <StripeOrderPaymentModal
          isOpen={Boolean(orderForPayment)}
          onClose={() => setOrderForPayment(null)}
          order={orderForPayment}
          onPaymentSuccess={(updatedOrder) => {
            setOrders((prev) =>
              prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
            );
            if (updateItem) {
              updateItem('orders', updatedOrder.id, {
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

      {/* ─────────────────────────────────────────────
          MODAL 6: DELETE CONFIRMATION DIALOG
          ───────────────────────────────────────────── */}
      <AdminConfirmDialog
        isOpen={Boolean(deleteConfirmOrder)}
        onClose={() => setDeleteConfirmOrder(null)}
        onConfirm={handleDeleteOrder}
        title="Delete Apothecary Order"
        message="Are you sure you want to delete this order? Transaction records and invoice ledger references will remain safely archived."
      />
    </div>
  );
};

export default OrdersPage;
