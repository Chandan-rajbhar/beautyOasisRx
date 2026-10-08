import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Tag,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  DollarSign,
  Percent,
  Copy,
  CopyPlus,
  Check,
  MoreVertical,
  Eye,
  Edit2,
  Trash2,
  Power,
  Sparkles,
  AlertCircle,
  ArrowUpDown,
  Ticket,
  TrendingUp,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAdminData } from '../../context/AdminDataContext';
import { AdminTable } from '../../components/admin/ui/AdminTable';
import { AdminToolbar } from '../../components/admin/ui/AdminToolbar';
import { AdminBadge } from '../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../components/admin/ui/AdminButton';
import { AdminDrawer } from '../../components/admin/ui/AdminDrawer';
import { AdminModal } from '../../components/admin/ui/AdminModal';
import { AdminConfirmDialog } from '../../components/admin/ui/AdminConfirmDialog';
import {
  fetchCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus,
  checkCodeExists,
  generateUniqueCouponCode
} from '../../services/couponService';
import { ShadcnSelect } from '../../components/ui/select';

export const CouponsPage = () => {
  const { coupons: contextCoupons = [], isLoading: contextLoading } = useAdminData();

  // ── Primary Dynamic States ──
  const [coupons, setCoupons] = useState(() => {
    return Array.isArray(contextCoupons) && contextCoupons.length > 0 ? contextCoupons : [];
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Sync with context if context updates and local is not currently fetching
  useEffect(() => {
    if (Array.isArray(contextCoupons) && contextCoupons.length > 0 && coupons.length === 0) {
      setCoupons(contextCoupons);
    }
  }, [contextCoupons]);

  // Load from Supabase on mount
  const loadCouponsFromSupabase = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const data = await fetchCoupons();
      setCoupons(data);
    } catch (err) {
      console.error('[CouponsPage] Load error:', err);
      setError(err?.message || 'Unable to fetch dynamic coupons from Supabase.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCouponsFromSupabase();
  }, [loadCouponsFromSupabase]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    loadCouponsFromSupabase(false);
  };

  // ── Filters & Search ──
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const filteredCoupons = useMemo(() => {
    return coupons.filter(item => {
      const matchesSearch =
        !searchTerm.trim() ||
        (item.code && item.code.toLowerCase().includes(searchTerm.toLowerCase().trim())) ||
        (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase().trim()));

      const matchesStatus =
        statusFilter === 'ALL' ||
        String(item.status).toLowerCase() === statusFilter.toLowerCase();

      const matchesType =
        typeFilter === 'ALL' ||
        String(item.discount_type || item.type).toLowerCase() === typeFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [coupons, searchTerm, statusFilter, typeFilter]);

  // ── Metrics Computation ──
  const metrics = useMemo(() => {
    const total = coupons.length;
    const active = coupons.filter(c => String(c.status).toLowerCase() === 'active').length;
    const totalRedemptions = coupons.reduce((sum, c) => sum + Number(c.usage_count || c.times_used || 0), 0);
    const percentageDiscounts = coupons.filter(c => String(c.discount_type || c.type).toLowerCase() === 'percentage');
    const avgPercentage = percentageDiscounts.length > 0
      ? (percentageDiscounts.reduce((sum, c) => sum + Number(c.discount_value || 0), 0) / percentageDiscounts.length).toFixed(0)
      : 0;

    return { total, active, totalRedemptions, avgPercentage };
  }, [coupons]);

  // ── Three-Dot Action Menu State ──
  const [actionMenuCouponId, setActionMenuCouponId] = useState(null);
  const [actionMenuPosition, setActionMenuPosition] = useState(null);

  // Responsive, viewport bounds-checked action menu opener
  const handleOpenActionMenu = (e, couponId) => {
    e.stopPropagation();
    if (actionMenuCouponId === couponId) {
      setActionMenuCouponId(null);
      setActionMenuPosition(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const dropdownHeight = 265;
    const dropdownWidth = 220;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

    let top = openUpward ? rect.top - dropdownHeight - 6 : rect.bottom + 6;
    if (top < 10) top = 10;

    let right = window.innerWidth - rect.right;
    if (right < 12) right = 12;
    if (right + dropdownWidth > window.innerWidth) {
      right = Math.max(12, window.innerWidth - dropdownWidth - 12);
    }

    setActionMenuPosition({ top, right });
    setActionMenuCouponId(couponId);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.coupon-action-menu-btn') && !e.target.closest('.coupon-action-dropdown-menu')) {
        setActionMenuCouponId(null);
        setActionMenuPosition(null);
      }
    };
    const handleScrollOrResize = () => {
      if (actionMenuCouponId) {
        setActionMenuCouponId(null);
        setActionMenuPosition(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && actionMenuCouponId) {
        setActionMenuCouponId(null);
        setActionMenuPosition(null);
      }
    };

    if (actionMenuCouponId) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [actionMenuCouponId]);

  // ── Modal & Drawer States ──
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [duplicateSourceCode, setDuplicateSourceCode] = useState(null);
  const [viewingCoupon, setViewingCoupon] = useState(null);
  const [deleteConfirmCoupon, setDeleteConfirmCoupon] = useState(null);

  // Form State
  const initialFormData = {
    code: '',
    description: '',
    discount_type: 'percentage', // 'percentage' | 'fixed'
    discount_value: '20',
    min_order_amount: '0',
    isUnlimitedUses: true,
    usage_limit: '',
    start_date: new Date().toISOString().split('T')[0],
    expiry_date: '',
    status: 'Active'
  };

  const [formData, setFormData] = useState(initialFormData);
  const [formError, setFormError] = useState('');
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [codeAvailability, setCodeAvailability] = useState(null); // null | 'available' | 'taken'
  const [copiedCodeId, setCopiedCodeId] = useState(null);

  // Copy code helper with visual indicator
  const handleCopyCode = async (code, id) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCodeId(id);
      toast.success(`Coupon code "${code}" copied to clipboard!`);
      setTimeout(() => setCopiedCodeId(null), 2500);
    } catch (_) {
      toast.error('Could not copy code automatically.');
    }
  };

  // Open Create Drawer with Auto-Generated Code
  const handleOpenCreateDrawer = async () => {
    setEditingCoupon(null);
    setDuplicateSourceCode(null);
    setFormError('');
    setCodeAvailability(null);

    // Initial default form
    const defaultData = {
      ...initialFormData,
      start_date: new Date().toISOString().split('T')[0]
    };
    setFormData(defaultData);
    setIsDrawerOpen(true);

    // Auto-generate code checked against Supabase
    setIsCheckingCode(true);
    try {
      const generated = await generateUniqueCouponCode({
        prefix: 'OASIS',
        discountValue: 20,
        discountType: 'percentage',
        existingList: coupons
      });
      setFormData(prev => ({ ...prev, code: generated }));
      setCodeAvailability('available');
    } catch (_) {
      setFormData(prev => ({ ...prev, code: `OASIS-${Math.floor(1000 + Math.random() * 9000)}` }));
    } finally {
      setIsCheckingCode(false);
    }
  };

  // Open Edit Drawer
  const handleOpenEditDrawer = (coupon) => {
    setEditingCoupon(coupon);
    setDuplicateSourceCode(null);
    setFormError('');
    setCodeAvailability('available');

    const startDateStr = coupon.start_date
      ? new Date(coupon.start_date).toISOString().split('T')[0]
      : '';
    const expiryDateStr = coupon.expiry_date || coupon.end_date
      ? new Date(coupon.expiry_date || coupon.end_date).toISOString().split('T')[0]
      : '';

    setFormData({
      code: coupon.code || coupon.coupon_code || '',
      description: coupon.description || '',
      discount_type: (coupon.discount_type || coupon.type || 'percentage').toLowerCase(),
      discount_value: String(coupon.discount_value ?? '0'),
      min_order_amount: String(coupon.min_order_amount ?? coupon.min_spend ?? '0'),
      isUnlimitedUses: !coupon.usage_limit && !coupon.max_uses,
      usage_limit: coupon.usage_limit || coupon.max_uses ? String(coupon.usage_limit || coupon.max_uses) : '',
      start_date: startDateStr,
      expiry_date: expiryDateStr,
      status: coupon.raw_status || coupon.status || 'Active'
    });

    setIsDrawerOpen(true);
  };

  // Open Duplicate Drawer (Clones coupon with auto-generated unique code)
  const handleDuplicateCoupon = async (coupon) => {
    setEditingCoupon(null);
    setDuplicateSourceCode(coupon.code || coupon.coupon_code || '');
    setFormError('');
    setIsCheckingCode(true);

    const startDateStr = new Date().toISOString().split('T')[0];
    const expiryDateStr = coupon.expiry_date || coupon.end_date
      ? new Date(coupon.expiry_date || coupon.end_date).toISOString().split('T')[0]
      : '';

    let generatedCode = '';
    try {
      generatedCode = await generateUniqueCouponCode({
        prefix: coupon.code ? coupon.code.split('-')[0] : 'OASIS',
        discountValue: coupon.discount_value,
        discountType: coupon.discount_type || coupon.type,
        existingList: coupons
      });
      setCodeAvailability('available');
    } catch (_) {
      generatedCode = `OASIS-${Math.floor(1000 + Math.random() * 9000)}`;
      setCodeAvailability('available');
    } finally {
      setIsCheckingCode(false);
    }

    setFormData({
      code: generatedCode,
      description: coupon.description ? `${coupon.description} (Copy)` : 'Promotional Coupon (Copy)',
      discount_type: (coupon.discount_type || coupon.type || 'percentage').toLowerCase(),
      discount_value: String(coupon.discount_value ?? '0'),
      min_order_amount: String(coupon.min_order_amount ?? coupon.min_spend ?? '0'),
      isUnlimitedUses: !coupon.usage_limit && !coupon.max_uses,
      usage_limit: coupon.usage_limit || coupon.max_uses ? String(coupon.usage_limit || coupon.max_uses) : '',
      start_date: startDateStr,
      expiry_date: expiryDateStr,
      status: 'Active'
    });

    setIsDrawerOpen(true);
    toast.success(`Duplicating "${coupon.code}". Review and save.`);
  };

  // Live Check Code Availability
  const handleCodeBlur = async () => {
    if (!formData.code || !formData.code.trim()) {
      setCodeAvailability(null);
      return;
    }
    const cleanCode = formData.code.trim().toUpperCase();
    setIsCheckingCode(true);
    try {
      const exists = await checkCodeExists(cleanCode, editingCoupon?.id);
      setCodeAvailability(exists ? 'taken' : 'available');
    } catch (_) {
      setCodeAvailability(null);
    } finally {
      setIsCheckingCode(false);
    }
  };

  // Re-generate Code Button in Form
  const handleRegenerateCode = async () => {
    setIsCheckingCode(true);
    try {
      const generated = await generateUniqueCouponCode({
        prefix: 'OASIS',
        discountValue: formData.discount_value || 20,
        discountType: formData.discount_type,
        existingList: coupons
      });
      setFormData(prev => ({ ...prev, code: generated }));
      setCodeAvailability('available');
    } catch (_) {
      setFormData(prev => ({ ...prev, code: `OASIS-${Math.floor(1000 + Math.random() * 9000)}` }));
      setCodeAvailability(null);
    } finally {
      setIsCheckingCode(false);
    }
  };

  // Save Coupon (Create / Edit)
  const handleSaveCoupon = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setFormError('');

    // Validations
    const cleanCode = formData.code.trim().toUpperCase();
    if (!cleanCode) {
      setFormError('Coupon code is required.');
      return;
    }

    const val = parseFloat(formData.discount_value);
    if (isNaN(val) || val <= 0) {
      setFormError('Please enter a valid discount value greater than 0.');
      return;
    }

    if (formData.discount_type === 'percentage' && val > 100) {
      setFormError('Percentage discount cannot exceed 100%.');
      return;
    }

    const minSpend = parseFloat(formData.min_order_amount);
    if (isNaN(minSpend) || minSpend < 0) {
      setFormError('Minimum order amount must be a valid number (or 0).');
      return;
    }

    let parsedUsageLimit = null;
    if (!formData.isUnlimitedUses) {
      const limit = parseInt(formData.usage_limit, 10);
      if (isNaN(limit) || limit <= 0) {
        setFormError('Please specify a positive number for usage limit, or select Unlimited.');
        return;
      }
      parsedUsageLimit = limit;
    }

    if (formData.start_date && formData.expiry_date) {
      if (new Date(formData.expiry_date) <= new Date(formData.start_date)) {
        setFormError('Expiry date must be after the start date.');
        return;
      }
    }

    setActionLoading(true);
    try {
      const payload = {
        code: cleanCode,
        description: formData.description.trim(),
        discount_type: formData.discount_type,
        discount_value: val,
        min_order_amount: minSpend,
        usage_limit: parsedUsageLimit,
        start_date: formData.start_date ? new Date(formData.start_date).toISOString() : new Date().toISOString(),
        expiry_date: formData.expiry_date ? new Date(formData.expiry_date).toISOString() : null,
        status: formData.status
      };

      if (editingCoupon) {
        // UPDATE
        const updated = await updateCoupon(editingCoupon.id, payload);
        setCoupons(prev => prev.map(c => c.id === editingCoupon.id ? updated : c));
        toast.success(`Coupon "${cleanCode}" updated successfully!`);
      } else {
        // CREATE
        const created = await createCoupon(payload);
        setCoupons(prev => [created, ...prev]);
        toast.success(`Coupon "${cleanCode}" created successfully!`);
      }

      setIsDrawerOpen(false);
      setEditingCoupon(null);
    } catch (err) {
      console.error('[handleSaveCoupon] Error:', err);
      setFormError(err?.message || 'Failed to save coupon to Supabase.');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Active/Inactive Status — optimistic UI, Supabase confirm, revert on failure
  const handleToggleStatus = async (coupon) => {
    const currentStatus = coupon.raw_status || coupon.status;
    const newStatus = String(currentStatus).toLowerCase() === 'active' ? 'Inactive' : 'Active';

    // ── 1. Optimistic UI update (instant) ──
    const optimistic = { ...coupon, status: newStatus, raw_status: newStatus };
    setCoupons(prev => prev.map(c => c.id === coupon.id ? optimistic : c));
    if (viewingCoupon && viewingCoupon.id === coupon.id) setViewingCoupon(optimistic);

    setActionLoading(true);
    try {
      // ── 2. Persist to Supabase ──
      const confirmed = await toggleCouponStatus(coupon.id, currentStatus);
      // Update with server-confirmed normalized data
      setCoupons(prev => prev.map(c => c.id === coupon.id ? confirmed : c));
      if (viewingCoupon && viewingCoupon.id === coupon.id) setViewingCoupon(confirmed);
      toast.success(
        `Coupon "${coupon.code}" is now ${newStatus === 'Active' ? 'Activated ✓' : 'Deactivated'}!`
      );
    } catch (err) {
      // ── 3. Revert on failure ──
      console.error('[handleToggleStatus] Error:', err);
      setCoupons(prev => prev.map(c => c.id === coupon.id ? coupon : c));
      if (viewingCoupon && viewingCoupon.id === coupon.id) setViewingCoupon(coupon);
      toast.error(err?.message || 'Failed to update coupon status in Supabase.');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Coupon
  const handleConfirmDelete = async () => {
    if (!deleteConfirmCoupon) return;
    setActionLoading(true);
    try {
      await deleteCoupon(deleteConfirmCoupon.id);
      setCoupons(prev => prev.filter(c => c.id !== deleteConfirmCoupon.id));
      toast.success(`Coupon "${deleteConfirmCoupon.code}" permanently deleted.`);
      setDeleteConfirmCoupon(null);
      if (viewingCoupon && viewingCoupon.id === deleteConfirmCoupon.id) {
        setViewingCoupon(null);
      }
    } catch (err) {
      console.error('[handleConfirmDelete] Error:', err);
      toast.error(err?.message || 'Failed to delete coupon from Supabase.');
    } finally {
      setActionLoading(false);
    }
  };

  // Quick preset helper for dates (+30 days, +90 days, no expiry)
  const setQuickExpiry = (days) => {
    if (days === null) {
      setFormData(prev => ({ ...prev, expiry_date: '' }));
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() + days);
    setFormData(prev => ({ ...prev, expiry_date: d.toISOString().split('T')[0] }));
  };

  // ── Table Column Definitions ──
  const columns = [
    {
      header: 'COUPON CODE',
      accessor: 'code',
      sortable: true,
      minWidth: '220px',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="coupon-code-pill" title="Click icon to copy">
            <Ticket size={13} color="#16a34a" />
            <span>{row.code}</span>
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleCopyCode(row.code, row.id);
            }}
            title="Copy code to clipboard"
            style={{
              background: copiedCodeId === row.id ? '#dcfce7' : '#f8fafc',
              border: '1px solid',
              borderColor: copiedCodeId === row.id ? '#86efac' : '#e2e8f0',
              borderRadius: '6px',
              padding: '4px 6px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: copiedCodeId === row.id ? '#166534' : '#64748b',
              fontSize: '0.74rem',
              transition: 'all 0.15s ease'
            }}
          >
            {copiedCodeId === row.id ? <Check size={12} /> : <Copy size={12} />}
            <span>{copiedCodeId === row.id ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      )
    },
    {
      header: 'DESCRIPTION',
      accessor: 'description',
      sortable: false,
      minWidth: '200px',
      render: (row) => (
        <span style={{
          fontSize: '0.82rem',
          color: row.description ? '#475569' : '#94a3b8',
          fontStyle: row.description ? 'normal' : 'italic',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          maxWidth: '220px'
        }}>
          {row.description || 'No description'}
        </span>
      )
    },
    {
      header: 'DISCOUNT',
      accessor: 'discount_value',
      sortable: true,
      minWidth: '150px',
      render: (row) => {
        const isPercent = String(row.discount_type || row.type).toLowerCase() === 'percentage';
        const formattedDiscount = isPercent
          ? `${Number(row.discount_value)}% OFF`
          : `$${Number(row.discount_value).toFixed(2)} OFF`;

        const minSpend = Number(row.min_order_amount ?? row.min_spend ?? 0);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span style={{ fontWeight: 700, fontSize: '0.94rem', color: isPercent ? '#16a34a' : '#1e5aa8' }}>
              {formattedDiscount}
            </span>
            <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
              {minSpend > 0 ? `Min order: $${minSpend.toFixed(2)}` : 'No minimum spend'}
            </span>
          </div>
        );
      }
    },
    {
      header: 'TYPE',
      accessor: 'discount_type',
      sortable: true,
      minWidth: '140px',
      render: (row) => {
        const isPercent = String(row.discount_type || row.type).toLowerCase() === 'percentage';
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 600,
              background: isPercent ? '#f0fdf4' : '#eff6ff',
              color: isPercent ? '#15803d' : '#1d4ed8',
              border: `1px solid ${isPercent ? '#bbf7d0' : '#bfdbfe'}`
            }}
          >
            {isPercent ? <Percent size={12} /> : <DollarSign size={12} />}
            <span>{isPercent ? 'Percentage' : 'Fixed Cart'}</span>
          </span>
        );
      }
    },
    {
      header: 'STATUS',
      accessor: 'status',
      sortable: true,
      minWidth: '120px',
      render: (row) => {
        const status = row.status || 'Active';
        return <AdminBadge status={status} />;
      }
    },

    {
      header: 'ACTIONS',
      align: 'right',
      minWidth: '90px',
      render: (row) => {
        const isOpen = actionMenuCouponId === row.id;

        return (
          <div className="coupon-action-container" style={{ display: 'inline-block' }}>
            <button
              type="button"
              className="coupon-action-menu-btn"
              onClick={(e) => handleOpenActionMenu(e, row.id)}
              style={{
                background: isOpen ? '#e2e8f0' : 'transparent',
                border: '1px solid',
                borderColor: isOpen ? '#cbd5e1' : '#e2e8f0',
                borderRadius: '8px',
                padding: '6px 8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                transition: 'all 0.15s ease'
              }}
              title="Coupon actions"
              aria-label="Coupon actions"
              aria-expanded={isOpen}
            >
              <MoreVertical size={16} />
            </button>
          </div>
        );
      }
    }
  ];

  // ── Mobile Responsive Card Renderer ──
  const renderMobileCard = (row) => {
    const isPercent = String(row.discount_type || row.type).toLowerCase() === 'percentage';
    const formattedDiscount = isPercent
      ? `${Number(row.discount_value)}% OFF`
      : `$${Number(row.discount_value).toFixed(2)} OFF`;
    const minSpend = Number(row.min_order_amount ?? row.min_spend ?? 0);
    const expiryDate = row.expiry_date || row.end_date;
    const isExpired = expiryDate && new Date(expiryDate).getTime() < Date.now();
    const isActive = String(row.raw_status || row.status).toLowerCase() === 'active';
    const isMenuOpen = actionMenuCouponId === row.id;

    return (
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
          <div>
            <span className="coupon-code-pill">
              <Ticket size={13} color="#16a34a" />
              <span>{row.code}</span>
            </span>
            {row.description && (
              <p style={{ margin: '6px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                {row.description}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AdminBadge status={row.status || 'Active'} />

            {/* Three-Dot Menu Trigger for Mobile */}
            <button
              type="button"
              className="coupon-action-menu-btn"
              onClick={(e) => handleOpenActionMenu(e, row.id)}
              style={{
                background: isMenuOpen ? '#e2e8f0' : '#f8fafc',
                border: '1px solid',
                borderColor: isMenuOpen ? '#cbd5e1' : '#e2e8f0',
                borderRadius: '8px',
                padding: '6px 8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                transition: 'all 0.15s ease'
              }}
              title="Coupon actions"
              aria-label="Coupon actions"
              aria-expanded={isMenuOpen}
            >
              <MoreVertical size={16} />
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '10px 0', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Discount</span>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: isPercent ? '#16a34a' : '#1e5aa8' }}>
              {formattedDiscount}
            </div>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
              {minSpend > 0 ? `Min: $${minSpend}` : 'No min'}
            </span>
          </div>
          <div>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Expires</span>
            <div style={{ fontSize: '0.84rem', fontWeight: 600, color: isExpired ? '#dc2626' : '#1e293b' }}>
              {expiryDate ? new Date(expiryDate).toLocaleDateString() : 'Never'}
            </div>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
              {row.usage_limit ? `${row.usage_count || 0}/${row.usage_limit} uses` : `${row.usage_count || 0} used`}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <button
            type="button"
            onClick={() => handleCopyCode(row.code, row.id)}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: copiedCodeId === row.id ? '#dcfce7' : '#f8fafc',
              fontSize: '0.8rem',
              color: copiedCodeId === row.id ? '#166534' : '#334155',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {copiedCodeId === row.id ? <Check size={13} /> : <Copy size={13} />}
            <span>{copiedCodeId === row.id ? 'Copied' : 'Copy Code'}</span>
          </button>

          <button
            type="button"
            className="coupon-action-menu-btn"
            onClick={(e) => handleOpenActionMenu(e, row.id)}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: '#0f2942',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>Actions</span>
            <MoreVertical size={14} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="admin-page">
      {/* ── Page Header matching Products/Services UI ── */}
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Promotional Coupons & Vouchers</h1>
          <p>Create and manage discount codes, campaign rules, redemption limits, and promotional validity windows.</p>
        </div>

        <div className="admin-page-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AdminButton
            variant="secondary"
            onClick={handleManualRefresh}
            disabled={refreshing || loading}
            icon={<RefreshCw size={15} className={refreshing ? 'bo-spin' : ''} />}
          >
            {refreshing ? 'Syncing...' : 'Sync Supabase'}
          </AdminButton>

          <AdminButton
            variant="primary"
            onClick={handleOpenCreateDrawer}
            icon={<Plus size={16} />}
          >
            Create Coupon
          </AdminButton>
        </div>
      </div>

      {/* ── Metric Summary Cards ── */}
      <div className="coupon-stat-grid">
        <div className="coupon-stat-card">
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#eff6ff', color: '#1e5aa8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Tag size={22} />
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Coupons</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f2942' }}>{metrics.total}</div>
          </div>
        </div>

        <div className="coupon-stat-card">
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Active Promotions</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#16a34a' }}>{metrics.active}</div>
          </div>
        </div>

        <div className="coupon-stat-card">
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={22} />
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Redemptions</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f2942' }}>{metrics.totalRedemptions}</div>
          </div>
        </div>

        <div className="coupon-stat-card">
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Percent size={22} />
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Avg Discount Rate</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f2942' }}>{metrics.avgPercentage > 0 ? `${metrics.avgPercentage}%` : '—'}</div>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Toolbar ── */}
      <AdminToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by coupon code or campaign description..."
        filters={[
          {
            id: 'status',
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { label: 'All Statuses', value: 'ALL' },
              { label: 'Active', value: 'Active' },
              { label: 'Inactive', value: 'Inactive' },
              { label: 'Expired', value: 'Expired' }
            ]
          },
          {
            id: 'type',
            label: 'Discount Type',
            value: typeFilter,
            onChange: setTypeFilter,
            options: [
              { label: 'All Types', value: 'ALL' },
              { label: 'Percentage (%)', value: 'percentage' },
              { label: 'Fixed Amount ($)', value: 'fixed' }
            ]
          }
        ]}
        hasActiveFilters={Boolean(searchTerm || statusFilter !== 'ALL' || typeFilter !== 'ALL')}
        onClearFilters={() => {
          setSearchTerm('');
          setStatusFilter('ALL');
          setTypeFilter('ALL');
        }}
      />

      {/* ── Table with Dynamic Supabase Data & Pagination (>20 items) ── */}
      <AdminTable
        columns={columns}
        data={filteredCoupons}
        loading={loading}
        showSkeleton={true}
        error={error}
        onRetry={() => loadCouponsFromSupabase(false)}
        itemsPerPage={20}
        keyField="id"
        itemLabel="coupons"
        renderMobileCard={renderMobileCard}
        emptyIcon={Ticket}
        emptyTitle="No Promotional Coupons Found"
        emptyDescription={
          searchTerm || statusFilter !== 'ALL' || typeFilter !== 'ALL'
            ? 'No coupons match your filter criteria. Try adjusting your search or clearing filters.'
            : 'No coupons have been created in Supabase yet. Click below to launch your first promotional campaign.'
        }
        emptyActionLabel={
          searchTerm || statusFilter !== 'ALL' || typeFilter !== 'ALL'
            ? 'Clear Filters'
            : '+ Create First Coupon'
        }
        onEmptyAction={() => {
          if (searchTerm || statusFilter !== 'ALL' || typeFilter !== 'ALL') {
            setSearchTerm('');
            setStatusFilter('ALL');
            setTypeFilter('ALL');
          } else {
            handleOpenCreateDrawer();
          }
        }}
      />

      {/* ── Create / Edit Coupon Drawer ── */}
      <AdminDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setEditingCoupon(null);
          setDuplicateSourceCode(null);
        }}
        title={editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : duplicateSourceCode ? `Duplicate Coupon (from ${duplicateSourceCode})` : 'Create Promotional Coupon'}
        subtitle={editingCoupon ? 'Update coupon rules, validity window, or discount amount.' : duplicateSourceCode ? 'Review and adjust parameters before saving as a new coupon.' : 'Auto-generate or configure a new promotional discount code.'}
        width="560px"
        footer={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', width: '100%' }}>
            <button
              type="button"
              onClick={() => {
                setIsDrawerOpen(false);
                setEditingCoupon(null);
                setDuplicateSourceCode(null);
              }}
              disabled={actionLoading}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <AdminButton
              variant="primary"
              onClick={handleSaveCoupon}
              disabled={actionLoading}
              icon={actionLoading ? <Loader2 size={16} className="bo-spin" /> : <Check size={16} />}
            >
              {actionLoading ? 'Saving to Supabase...' : editingCoupon ? 'Update Coupon' : duplicateSourceCode ? 'Create Duplicate' : 'Create Coupon'}
            </AdminButton>
          </div>
        }
      >
        <form onSubmit={handleSaveCoupon} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {formError && (
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
              <AlertCircle size={16} flexShrink={0} />
              <span>{formError}</span>
            </div>
          )}

          {/* Coupon Code Field with Auto-Generate and Validation */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 600, color: '#0f2942' }}>
                Coupon Code <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <button
                type="button"
                onClick={handleRegenerateCode}
                disabled={isCheckingCode}
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#15803d',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Sparkles size={12} />
                <span>Auto-Generate Code</span>
              </button>
            </div>

            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }));
                  setCodeAvailability(null);
                }}
                onBlur={handleCodeBlur}
                placeholder="e.g. OASIS-SAVE20"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: codeAvailability === 'taken' ? '#f87171' : codeAvailability === 'available' ? '#86efac' : '#cbd5e1',
                  fontSize: '0.94rem',
                  fontFamily: 'monospace',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  boxSizing: 'border-box'
                }}
                required
              />
              {isCheckingCode && (
                <div style={{ position: 'absolute', right: '12px', top: '12px' }}>
                  <Loader2 size={16} className="bo-spin" color="#64748b" />
                </div>
              )}
            </div>

            {/* Code check feedback */}
            <div style={{ marginTop: '4px', fontSize: '0.74rem' }}>
              {codeAvailability === 'available' && (
                <span style={{ color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Check size={12} /> Code is unique and available in Supabase
                </span>
              )}
              {codeAvailability === 'taken' && (
                <span style={{ color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <AlertCircle size={12} /> Code already exists in database. Please choose another code.
                </span>
              )}
              {codeAvailability === null && !isCheckingCode && (
                <span style={{ color: '#94a3b8' }}>
                  Letters, numbers, and dashes. Auto-checked against Supabase database.
                </span>
              )}
            </div>
          </div>

          {/* Campaign Title / Description */}
          <div>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#0f2942', marginBottom: '6px' }}>
              Campaign Title / Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="e.g. Spring Clinical Rejuvenation Promotion"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.86rem',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Discount Type & Value Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#0f2942', marginBottom: '6px' }}>
                Discount Type <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <ShadcnSelect
                value={formData.discount_type}
                onChange={(val) => setFormData(prev => ({ ...prev, discount_type: val }))}
                options={[
                  { label: 'Percentage Discount (%)', value: 'percentage' },
                  { label: 'Fixed Cart Discount ($ USD)', value: 'fixed' }
                ]}
                triggerStyle={{ width: '100%', fontSize: '0.86rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#0f2942', marginBottom: '6px' }}>
                Discount Value <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  min="0"
                  max={formData.discount_type === 'percentage' ? '100' : '99999'}
                  step={formData.discount_type === 'percentage' ? '1' : '0.01'}
                  value={formData.discount_value}
                  onChange={(e) => setFormData(prev => ({ ...prev, discount_value: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    paddingRight: '36px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.86rem',
                    boxSizing: 'border-box'
                  }}
                  required
                />
                <span style={{ position: 'absolute', right: '12px', top: '10px', fontSize: '0.84rem', color: '#64748b', fontWeight: 600 }}>
                  {formData.discount_type === 'percentage' ? '%' : '$'}
                </span>
              </div>
            </div>
          </div>

          {/* Minimum Spend & Status Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#0f2942', marginBottom: '6px' }}>
                Minimum Order Spend ($)
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '10px', fontSize: '0.84rem', color: '#64748b' }}>$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.min_order_amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, min_order_amount: e.target.value }))}
                  placeholder="0.00"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    paddingLeft: '26px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.86rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Set to 0 for no minimum restriction</span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#0f2942', marginBottom: '6px' }}>
                Initial Status
              </label>
              <ShadcnSelect
                value={formData.status}
                onChange={(val) => setFormData(prev => ({ ...prev, status: val }))}
                options={[
                  { label: 'Active (Redeemable)', value: 'Active', dotColor: '#16a34a' },
                  { label: 'Inactive (Disabled)', value: 'Inactive', dotColor: '#94a3b8' }
                ]}
                triggerStyle={{ width: '100%', fontSize: '0.86rem' }}
              />
            </div>
          </div>

          {/* Usage Limit Section */}
          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 600, color: '#0f2942' }}>
                Usage Limit
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#475569', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.isUnlimitedUses}
                  onChange={(e) => setFormData(prev => ({ ...prev, isUnlimitedUses: e.target.checked }))}
                />
                <span>Unlimited Redemptions</span>
              </label>
            </div>

            {!formData.isUnlimitedUses && (
              <div>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={formData.usage_limit}
                  onChange={(e) => setFormData(prev => ({ ...prev, usage_limit: e.target.value }))}
                  placeholder="e.g. 100"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.86rem',
                    background: '#ffffff',
                    boxSizing: 'border-box'
                  }}
                  required
                />
                <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  Maximum total times this coupon can be redeemed across all patients.
                </span>
              </div>
            )}
          </div>

          {/* Validity Window (Start & Expiry Date) */}
          <div>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#0f2942', marginBottom: '8px' }}>
              Validity Period
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '8px' }}>
              <div>
                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Start Date</span>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Expiry Date (Optional)</span>
                <input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Quick Expiry Presets */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Presets:</span>
              <button
                type="button"
                onClick={() => setQuickExpiry(30)}
                style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', background: '#ffffff', fontSize: '0.72rem', cursor: 'pointer' }}
              >
                +30 Days
              </button>
              <button
                type="button"
                onClick={() => setQuickExpiry(60)}
                style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', background: '#ffffff', fontSize: '0.72rem', cursor: 'pointer' }}
              >
                +60 Days
              </button>
              <button
                type="button"
                onClick={() => setQuickExpiry(90)}
                style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', background: '#ffffff', fontSize: '0.72rem', cursor: 'pointer' }}
              >
                +90 Days
              </button>
              <button
                type="button"
                onClick={() => setQuickExpiry(null)}
                style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', background: '#ffffff', fontSize: '0.72rem', cursor: 'pointer' }}
              >
                No Expiry
              </button>
            </div>
          </div>
        </form>
      </AdminDrawer>

      {/* ── View Coupon Details Modal ── */}
      {viewingCoupon && (
        <AdminModal
          isOpen={Boolean(viewingCoupon)}
          onClose={() => setViewingCoupon(null)}
          title="Coupon Campaign Overview"
          maxWidth="520px"
          footer={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <button
                type="button"
                onClick={() => handleToggleStatus(viewingCoupon)}
                disabled={actionLoading}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Power size={14} color={viewingCoupon.status === 'Active' ? '#d97706' : '#16a34a'} />
                <span>{viewingCoupon.status === 'Active' ? 'Deactivate Coupon' : 'Activate Coupon'}</span>
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <AdminButton
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const c = viewingCoupon;
                    setViewingCoupon(null);
                    handleOpenEditDrawer(c);
                  }}
                  icon={<Edit2 size={14} />}
                >
                  Edit
                </AdminButton>
                <AdminButton
                  variant="primary"
                  size="sm"
                  onClick={() => setViewingCoupon(null)}
                >
                  Done
                </AdminButton>
              </div>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Voucher Card Header */}
            <div
              style={{
                background: 'linear-gradient(135deg, #0b2545 0%, #1e5aa8 100%)',
                color: '#ffffff',
                padding: '20px',
                borderRadius: '12px',
                boxShadow: '0 8px 20px rgba(11, 37, 69, 0.25)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.85 }}>
                  BeautyOasisRx Voucher
                </span>
                <AdminBadge status={viewingCoupon.status} />
              </div>

              <div style={{ fontSize: '1.9rem', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '6px' }}>
                {String(viewingCoupon.discount_type || viewingCoupon.type).toLowerCase() === 'percentage'
                  ? `${viewingCoupon.discount_value}% OFF`
                  : `$${Number(viewingCoupon.discount_value).toFixed(2)} OFF`}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.12)', padding: '6px 10px', borderRadius: '6px', width: 'fit-content' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '1px', fontSize: '0.94rem' }}>
                  {viewingCoupon.code}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(viewingCoupon.code, viewingCoupon.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0
                  }}
                  title="Copy code"
                >
                  <Copy size={13} />
                </button>
              </div>
            </div>

            {/* Campaign description */}
            {viewingCoupon.description && (
              <div style={{ fontSize: '0.86rem', color: '#475569', fontStyle: 'italic', padding: '0 4px' }}>
                "{viewingCoupon.description}"
              </div>
            )}

            {/* Metadata Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.82rem' }}>
              <div>
                <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>Discount Type</span>
                <strong style={{ color: '#0f2942' }}>
                  {String(viewingCoupon.discount_type || viewingCoupon.type).toLowerCase() === 'percentage' ? 'Percentage (%)' : 'Fixed Cart ($)'}
                </strong>
              </div>

              <div>
                <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>Min Order Amount</span>
                <strong style={{ color: '#0f2942' }}>
                  {Number(viewingCoupon.min_order_amount ?? viewingCoupon.min_spend ?? 0) > 0
                    ? `$${Number(viewingCoupon.min_order_amount ?? viewingCoupon.min_spend).toFixed(2)}`
                    : 'None ($0.00)'}
                </strong>
              </div>

              <div>
                <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>Total Redemptions</span>
                <strong style={{ color: '#0f2942' }}>
                  {viewingCoupon.usage_limit
                    ? `${viewingCoupon.usage_count || 0} of ${viewingCoupon.usage_limit} uses`
                    : `${viewingCoupon.usage_count || 0} uses (Unlimited)`}
                </strong>
              </div>

              <div>
                <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>Expiration</span>
                <strong style={{ color: '#0f2942' }}>
                  {viewingCoupon.expiry_date || viewingCoupon.end_date
                    ? new Date(viewingCoupon.expiry_date || viewingCoupon.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Never expires'}
                </strong>
              </div>

              <div>
                <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>Created On</span>
                <span style={{ color: '#64748b' }}>
                  {viewingCoupon.created_at ? new Date(viewingCoupon.created_at).toLocaleDateString() : '—'}
                </span>
              </div>

              <div>
                <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>Supabase Record ID</span>
                <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                  {String(viewingCoupon.id).slice(0, 13)}...
                </span>
              </div>
            </div>
          </div>
        </AdminModal>
      )}

      {/* ─────────────────────────────────────────────
          GLOBAL THREE-DOT ACTION MENU (PORTAL)
          ───────────────────────────────────────────── */}
      {actionMenuCouponId && actionMenuPosition && (() => {
        const row = coupons.find((c) => c.id === actionMenuCouponId);
        if (!row) return null;
        const isActive = String(row.raw_status || row.status).toLowerCase() === 'active';

        return (
          <div
            className="coupon-action-dropdown-menu"
            style={{
              top: `${actionMenuPosition.top}px`,
              right: `${actionMenuPosition.right}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. View */}
            <button
              type="button"
              className="coupon-dropdown-item"
              onClick={() => {
                setActionMenuCouponId(null);
                setActionMenuPosition(null);
                setViewingCoupon(row);
              }}
            >
              <Eye size={15} color="#1e5aa8" />
              <span>View Details</span>
            </button>

            {/* 2. Edit */}
            <button
              type="button"
              className="coupon-dropdown-item"
              onClick={() => {
                setActionMenuCouponId(null);
                setActionMenuPosition(null);
                handleOpenEditDrawer(row);
              }}
            >
              <Edit2 size={15} color="#0f766e" />
              <span>Edit Coupon</span>
            </button>

            {/* 3. Duplicate */}
            <button
              type="button"
              className="coupon-dropdown-item"
              onClick={() => {
                setActionMenuCouponId(null);
                setActionMenuPosition(null);
                handleDuplicateCoupon(row);
              }}
            >
              <CopyPlus size={15} color="#6366f1" />
              <span>Duplicate Coupon</span>
            </button>

            {/* 4. Change Status */}
            <button
              type="button"
              className="coupon-dropdown-item"
              onClick={() => {
                setActionMenuCouponId(null);
                setActionMenuPosition(null);
                handleToggleStatus(row);
              }}
            >
              <Power size={15} color={isActive ? '#d97706' : '#16a34a'} />
              <span>{isActive ? 'Deactivate Coupon' : 'Activate Coupon'}</span>
            </button>

            {/* Convenience: Copy Code */}
            <button
              type="button"
              className="coupon-dropdown-item"
              onClick={() => {
                setActionMenuCouponId(null);
                setActionMenuPosition(null);
                handleCopyCode(row.code, row.id);
              }}
            >
              <Copy size={15} color="#475569" />
              <span>Copy Code</span>
            </button>

            <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />

            {/* 5. Delete */}
            <button
              type="button"
              className="coupon-dropdown-item danger"
              onClick={() => {
                setActionMenuCouponId(null);
                setActionMenuPosition(null);
                setDeleteConfirmCoupon(row);
              }}
            >
              <Trash2 size={15} color="#dc2626" />
              <span>Delete Coupon</span>
            </button>
          </div>
        );
      })()}

      {/* ── Delete Confirmation Dialog ── */}
      {deleteConfirmCoupon && (
        <AdminConfirmDialog
          isOpen={Boolean(deleteConfirmCoupon)}
          onClose={() => setDeleteConfirmCoupon(null)}
          onConfirm={handleConfirmDelete}
          loading={actionLoading}
          title="Delete Coupon Record"
          message={`Are you sure you want to permanently delete coupon "${deleteConfirmCoupon.code}"? Patients will no longer be able to apply this discount code at checkout.`}
          confirmText="Delete Coupon"
          confirmVariant="danger"
        />
      )}
    </div>
  );
};

export default CouponsPage;
