import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Clock,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  MoreVertical,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabaseClient';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { AdminTable } from '../../components/admin/ui/AdminTable';
import { AdminToolbar } from '../../components/admin/ui/AdminToolbar';
import { AdminBadge } from '../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../components/admin/ui/AdminButton';
import { AdminDrawer } from '../../components/admin/ui/AdminDrawer';
import { AdminConfirmDialog } from '../../components/admin/ui/AdminConfirmDialog';
import { ShadcnSelect } from '../../components/ui/select';
import { TimePicker } from '../../components/ui/TimePicker';

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const TABLE_NAME = 'appointment_times';

const DEFAULT_FORM = {
  appointment_time: '',
  status: 'Active'
};

// ─────────────────────────────────────────────────────────────
// DUAL-CLIENT HELPERS (resilient: standard → admin fallback)
// ─────────────────────────────────────────────────────────────
async function fetchTimesFromDB() {
  try {
    let { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      const res = await supabaseAdmin
        .from(TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: true });
      if (!res.error && res.data) return { data: res.data, error: null };
      return { data: null, error: res.error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

async function insertTimeInDB(payload) {
  try {
    let { data, error } = await supabase.from(TABLE_NAME).insert(payload).select().single();
    if (error) {
      const res = await supabaseAdmin.from(TABLE_NAME).insert(payload).select().single();
      if (!res.error && res.data) return { data: res.data, error: null };
      return { data: null, error: res.error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

async function updateTimeInDB(id, payload) {
  try {
    let { data, error } = await supabase.from(TABLE_NAME).update(payload).eq('id', id).select().single();
    if (error) {
      const res = await supabaseAdmin.from(TABLE_NAME).update(payload).eq('id', id).select().single();
      if (!res.error && res.data) return { data: res.data, error: null };
      return { data: null, error: res.error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

async function deleteTimeFromDB(id) {
  try {
    let { error } = await supabase.from(TABLE_NAME).delete().eq('id', id);
    if (error) {
      const res = await supabaseAdmin.from(TABLE_NAME).delete().eq('id', id);
      if (!res.error) return { error: null };
      return { error: res.error };
    }
    return { error: null };
  } catch (err) {
    return { error: err };
  }
}

async function clearAllTimesFromDB() {
  try {
    let { error } = await supabase.from(TABLE_NAME).delete().neq('status', '___NON_EXISTENT___');
    if (error) {
      const res = await supabaseAdmin.from(TABLE_NAME).delete().neq('status', '___NON_EXISTENT___');
      if (!res.error) return { error: null };
      return { error: res.error };
    }
    return { error: null };
  } catch (err) {
    return { error: err };
  }
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
export const AppointmentTimePage = () => {
  // Data states
  const [times, setTimes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Drawer & modal states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingTime, setEditingTime] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [clearAllConfirmOpen, setClearAllConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  // Form state
  const [formData, setFormData] = useState({ ...DEFAULT_FORM });
  const [formErrors, setFormErrors] = useState({});

  // Action menu state (viewport-positioned portal)
  const [actionMenuId, setActionMenuId] = useState(null);
  const [actionMenuPosition, setActionMenuPosition] = useState(null);

  // ── Close action menu on outside click / scroll / Esc ──
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        !e.target.closest('.appt-time-action-menu-container') &&
        !e.target.closest('.appt-time-action-dropdown-menu')
      ) {
        setActionMenuId(null);
        setActionMenuPosition(null);
      }
    };
    const handleWindowChange = () => {
      if (actionMenuId) {
        setActionMenuId(null);
        setActionMenuPosition(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && actionMenuId) {
        setActionMenuId(null);
        setActionMenuPosition(null);
      }
    };
    if (actionMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      window.addEventListener('scroll', handleWindowChange, true);
      window.addEventListener('resize', handleWindowChange);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleWindowChange, true);
      window.removeEventListener('resize', handleWindowChange);
    };
  }, [actionMenuId]);

  // ── FETCH (strictly Supabase, no hardcoded fallbacks) ──
  const loadTimes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await fetchTimesFromDB();
      if (fetchErr) {
        setError('Failed to load appointment times. Please try again.');
        toast.error('Could not load appointment times from database.');
        return;
      }
      const loaded = Array.isArray(data) ? data : [];
      setTimes(loaded);
      try { localStorage.setItem('bo_appointment_times_cache', JSON.stringify(loaded)); } catch (_) {}
    } catch (err) {
      setError('Unexpected error loading appointment times.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Restore from cache for instant render (filtering out any fake IDs)
    try {
      const cached = localStorage.getItem('bo_appointment_times_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(t => !String(t.id).startsWith('fb-'));
          setTimes(valid);
        }
      }
    } catch (_) {}
    loadTimes();
  }, [loadTimes]);

  // ── FORM VALIDATION ──
  const validateForm = () => {
    const errs = {};
    if (!formData.appointment_time || formData.appointment_time.trim() === '') {
      errs.appointment_time = 'Please select an appointment time.';
    }
    // Check for duplicate (excluding the one being edited)
    const isDuplicate = times.some(
      t =>
        t.appointment_time === formData.appointment_time &&
        t.id !== editingTime?.id
    );
    if (isDuplicate) {
      errs.appointment_time = 'This appointment time already exists.';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── OPEN DRAWER ──
  const handleOpenAdd = () => {
    setEditingTime(null);
    setFormData({ ...DEFAULT_FORM });
    setFormErrors({});
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (row) => {
    setEditingTime(row);
    setFormData({
      appointment_time: row.appointment_time || '',
      status: row.status || 'Active'
    });
    setFormErrors({});
    setIsDrawerOpen(true);
    setActionMenuId(null);
    setActionMenuPosition(null);
  };

  // ── SAVE (CREATE / UPDATE) ──
  const handleSave = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSubmitting(true);

    const payload = {
      appointment_time: formData.appointment_time.trim(),
      status: formData.status
    };

    try {
      if (editingTime) {
        // UPDATE
        const { data: updated, error: updateErr } = await updateTimeInDB(editingTime.id, payload);
        if (updateErr) {
          toast.error(`Update failed: ${updateErr.message || 'Unknown error'}`);
          return;
        }
        setTimes(prev =>
          prev.map(t => (t.id === editingTime.id ? { ...t, ...payload, ...(updated || {}) } : t))
        );
        try {
          const cached = JSON.parse(localStorage.getItem('bo_appointment_times_cache') || '[]');
          localStorage.setItem(
            'bo_appointment_times_cache',
            JSON.stringify(cached.map(t => (t.id === editingTime.id ? { ...t, ...payload, ...(updated || {}) } : t)))
          );
        } catch (_) {}
        toast.success('Appointment time updated successfully.');
        setIsDrawerOpen(false);
        setEditingTime(null);
      } else {
        // CREATE
        const { data: created, error: insertErr } = await insertTimeInDB(payload);
        if (insertErr) {
          if (insertErr.code === '23505') {
            setFormErrors({ appointment_time: 'This appointment time already exists.' });
            toast.error('Duplicate appointment time — please choose a different time.');
          } else {
            toast.error(`Failed to add time: ${insertErr.message || 'Unknown error'}`);
          }
          return;
        }
        const newRow = created || { ...payload, id: `temp-${Date.now()}` };
        setTimes(prev => {
          const updated = [...prev, newRow];
          try { localStorage.setItem('bo_appointment_times_cache', JSON.stringify(updated)); } catch (_) {}
          return updated;
        });
        toast.success('Appointment time added successfully.');
        setIsDrawerOpen(false);
      }
    } catch (err) {
      toast.error(`Unexpected error: ${err.message}`);
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // ── TOGGLE STATUS ──
  const handleToggleStatus = async (row) => {
    const newStatus = row.status === 'Active' ? 'Inactive' : 'Active';
    // Optimistic update
    setTimes(prev => prev.map(t => (t.id === row.id ? { ...t, status: newStatus } : t)));
    setActionMenuId(null);
    setActionMenuPosition(null);

    const { error: toggleErr } = await updateTimeInDB(row.id, { status: newStatus });
    if (toggleErr) {
      // Revert
      setTimes(prev => prev.map(t => (t.id === row.id ? { ...t, status: row.status } : t)));
      toast.error(`Failed to update status: ${toggleErr.message || 'Unknown error'}`);
    } else {
      try {
        const cached = JSON.parse(localStorage.getItem('bo_appointment_times_cache') || '[]');
        localStorage.setItem(
          'bo_appointment_times_cache',
          JSON.stringify(cached.map(t => (t.id === row.id ? { ...t, status: newStatus } : t)))
        );
      } catch (_) {}
      toast.success(`Appointment time marked as ${newStatus}.`);
    }
  };

  // ── DELETE ──
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error: delErr } = await deleteTimeFromDB(deleteTarget.id);
    setDeleting(false);
    if (delErr) {
      toast.error(`Failed to delete: ${delErr.message || 'Unknown error'}`);
    } else {
      setTimes(prev => {
        const updated = prev.filter(t => t.id !== deleteTarget.id);
        try { localStorage.setItem('bo_appointment_times_cache', JSON.stringify(updated)); } catch (_) {}
        return updated;
      });
      toast.success('Appointment time deleted successfully.');
    }
    setDeleteTarget(null);
  };

  // ── CLEAR ALL STATIC TIMES ──
  const handleClearAllConfirm = async () => {
    setClearingAll(true);
    const { error: clearErr } = await clearAllTimesFromDB();
    setClearingAll(false);
    if (clearErr) {
      toast.error(`Failed to clear times: ${clearErr.message || 'Unknown error'}`);
    } else {
      setTimes([]);
      try {
        localStorage.removeItem('bo_appointment_times_cache');
      } catch (_) {}
      toast.success('All static appointment times have been removed.');
    }
    setClearAllConfirmOpen(false);
  };

  // ── FILTERING ──
  const filtered = useMemo(() => {
    return times.filter(t => {
      const matchSearch = !searchTerm || t.appointment_time.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [times, searchTerm, statusFilter]);

  const hasActiveFilters = Boolean(searchTerm) || statusFilter !== 'ALL';

  // ── TABLE COLUMNS ──
  const columns = [
    {
      header: '#',
      accessor: 'index',
      width: '64px',
      minWidth: '50px',
      align: 'left',
      sortable: false,
      render: (row, rowIndex) => (
        <span
          style={{
            color: '#64748b',
            fontSize: '0.8rem',
            fontWeight: 500,
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {(currentPage - 1) * 15 + rowIndex + 1}
        </span>
      )
    },
    {
      header: 'Appointment Time',
      accessor: 'appointment_time',
      sortable: true,
      minWidth: '220px',
      align: 'left',
      render: (row) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: '#eff6ff',
              color: '#1e5aa8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: '1px solid #dbeafe'
            }}
          >
            <Clock size={15} strokeWidth={2.2} />
          </div>
          <span
            style={{
              fontWeight: 600,
              color: '#0f2942',
              fontSize: '0.94rem',
              letterSpacing: '-0.01em',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {row.appointment_time}
          </span>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      minWidth: '130px',
      align: 'left',
      render: (row) => {
        const isActive = String(row.status || '').toLowerCase() === 'active';
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '9999px',
              fontSize: '0.74rem',
              fontWeight: 600,
              lineHeight: 1.4,
              backgroundColor: isActive ? '#ecfdf5' : '#fef2f2',
              color: isActive ? '#065f46' : '#991b1b',
              border: `1px solid ${isActive ? '#a7f3d0' : '#fecaca'}`,
              letterSpacing: '0.01em'
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: isActive ? '#10b981' : '#f43f5e',
                flexShrink: 0
              }}
            />
            {row.status || 'Active'}
          </span>
        );
      }
    },
    {
      header: 'Actions',
      accessor: 'actions',
      width: '90px',
      minWidth: '80px',
      align: 'right',
      render: (row) => {
        const isMenuOpen = actionMenuId === row.id;
        return (
          <div
            className="appt-time-action-menu-container"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              position: 'relative'
            }}
          >
            <button
              type="button"
              className={`appt-time-action-btn ${isMenuOpen ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (isMenuOpen) {
                  setActionMenuId(null);
                  setActionMenuPosition(null);
                } else {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const dropdownHeight = 150;
                  const spaceBelow = window.innerHeight - rect.bottom;
                  const openUpward = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
                  setActionMenuPosition({
                    top: openUpward ? rect.top - dropdownHeight - 6 : rect.bottom + 6,
                    right: Math.max(16, window.innerWidth - rect.right)
                  });
                  setActionMenuId(row.id);
                }
              }}
              title="Actions"
              aria-label="Actions"
            >
              <MoreVertical size={16} />
            </button>

            {isMenuOpen && actionMenuPosition && createPortal(
              <div
                className="appt-time-action-dropdown-menu"
                style={{
                  position: 'fixed',
                  top: `${actionMenuPosition.top}px`,
                  right: `${actionMenuPosition.right}px`,
                  zIndex: 99999,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  boxShadow: '0 10px 30px -4px rgba(15,41,66,0.14), 0 4px 6px -2px rgba(15,41,66,0.06)',
                  padding: '6px',
                  minWidth: '175px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  animation: 'apptMenuFade 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                {/* Edit */}
                <button
                  type="button"
                  onClick={() => handleOpenEdit(row)}
                  className="appt-time-menu-item"
                >
                  <Edit2 size={14} color="currentColor" />
                  <span>Edit</span>
                </button>

                {/* Toggle Status */}
                <button
                  type="button"
                  onClick={() => handleToggleStatus(row)}
                  className={`appt-time-menu-item ${row.status === 'Active' ? 'item-status-active' : 'item-status-inactive'}`}
                >
                  {row.status === 'Active'
                    ? <XCircle size={14} color="currentColor" />
                    : <CheckCircle2 size={14} color="currentColor" />}
                  <span>{row.status === 'Active' ? 'Deactivate' : 'Activate'}</span>
                </button>

                <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 0' }} />

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => {
                    setDeleteTarget(row);
                    setActionMenuId(null);
                    setActionMenuPosition(null);
                  }}
                  className="appt-time-menu-item item-delete"
                >
                  <Trash2 size={14} color="currentColor" />
                  <span>Delete</span>
                </button>
              </div>,
              document.body
            )}
          </div>
        );
      }
    }
  ];

  // ── STATS ──
  const activeCount = times.filter(t => t.status === 'Active').length;
  const inactiveCount = times.filter(t => t.status === 'Inactive').length;

  return (
    <div>
      {/* Page Header */}
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Appointment Time Management</h1>
          <p>Configure the bookable time slots available across all scheduling forms.</p>
        </div>
        <div className="admin-page-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <AdminButton
            variant="primary"
            onClick={handleOpenAdd}
            icon={<Plus size={16} />}
          >
            Add Time Slot
          </AdminButton>
        </div>
      </div>

      {/* Summary Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '14px',
          marginBottom: '20px'
        }}
      >
        {[
          { label: 'Total Time Slots', value: times.length, color: '#1e5aa8' },
          { label: 'Active Slots', value: activeCount, color: '#15803d' },
          { label: 'Inactive Slots', value: inactiveCount, color: '#64748b' }
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <span style={{ fontSize: '1.6rem', fontWeight: 700, color: stat.color }}>{stat.value}</span>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Error Banner */}
      {error && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 16px',
            borderRadius: '8px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadTimes}
            style={{
              background: '#fecaca', border: 'none', borderRadius: '6px',
              padding: '4px 10px', fontSize: '0.78rem', color: '#b91c1c',
              fontWeight: 600, cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Toolbar */}
      <AdminToolbar
        searchTerm={searchTerm}
        onSearchChange={(v) => { setSearchTerm(v); setCurrentPage(1); }}
        searchPlaceholder="Search appointment times..."
        hasActiveFilters={hasActiveFilters}
        onClearFilters={() => { setSearchTerm(''); setStatusFilter('ALL'); setCurrentPage(1); }}
        filters={[
          {
            id: 'status',
            value: statusFilter,
            onChange: (v) => { setStatusFilter(v); setCurrentPage(1); },
            options: [
              { label: 'All Statuses', value: 'ALL' },
              { label: 'Active', value: 'Active' },
              { label: 'Inactive', value: 'Inactive' }
            ]
          }
        ]}
      />

      {/* Table */}
      <AdminTable
        className="appt-times-table-container"
        columns={columns}
        data={filtered}
        loading={loading}
        showLoadingBar={false}
        showSkeleton={false}
        itemsPerPage={15}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        itemLabel="results"
        emptyIcon={<Clock size={28} color="#1e5aa8" />}
        emptyTitle="No appointment times found"
        emptyDescription="Create an appointment time slot to get started."
        emptyActionLabel="Add Time Slot"
        onEmptyAction={handleOpenAdd}
      />

      {/* ── Add / Edit Drawer ── */}
      <AdminDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setEditingTime(null);
          setFormErrors({});
        }}
        title={editingTime ? 'Edit Appointment Time' : 'Add Appointment Time'}
        subtitle={
          editingTime
            ? `Editing: ${editingTime.appointment_time}`
            : 'Select a time slot to add to the scheduling system.'
        }
        width="460px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', width: '100%' }}>
            <AdminButton
              variant="secondary"
              onClick={() => {
                setIsDrawerOpen(false);
                setEditingTime(null);
                setFormErrors({});
              }}
            >
              Cancel
            </AdminButton>
            <AdminButton
              type="submit"
              form="appt-time-form"
              variant="primary"
              loading={submitting}
            >
              {editingTime ? 'Update Time Slot' : 'Add Time Slot'}
            </AdminButton>
          </div>
        }
      >
        <form id="appt-time-form" onSubmit={handleSave}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* Time Picker */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                Appointment Time <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <TimePicker
                value={formData.appointment_time}
                onChange={(val) => {
                  setFormData(prev => ({ ...prev, appointment_time: val }));
                  if (formErrors.appointment_time) setFormErrors(prev => ({ ...prev, appointment_time: null }));
                }}
                placeholder="Select appointment time..."
                error={Boolean(formErrors.appointment_time)}
              />
              {formErrors.appointment_time && (
                <div
                  style={{
                    marginTop: '6px',
                    fontSize: '0.78rem',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <AlertCircle size={12} />
                  <span>{formErrors.appointment_time}</span>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="admin-form-group">
              <label className="admin-form-label">Status</label>
              <ShadcnSelect
                value={formData.status}
                onChange={(val) => setFormData(prev => ({ ...prev, status: val }))}
                options={[
                  { value: 'Active', label: 'Active — visible in scheduling forms' },
                  { value: 'Inactive', label: 'Inactive — hidden from scheduling forms' }
                ]}
                placeholder="Select status"
              />
              <div style={{ marginTop: '6px', fontSize: '0.76rem', color: '#94a3b8' }}>
                Only <strong>Active</strong> time slots appear in the appointment scheduling form.
              </div>
            </div>

          </div>
        </form>
      </AdminDrawer>

      {/* ── Delete Confirm Dialog ── */}
      <AdminConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
        title="Delete Appointment Time"
        message={
          deleteTarget
            ? `Are you sure you want to permanently delete the time slot "${deleteTarget.appointment_time}"? This cannot be undone.`
            : ''
        }
        confirmText="Delete"
        confirmVariant="danger"
      />

      {/* ── Clear All Confirm Dialog ── */}
      <AdminConfirmDialog
        isOpen={clearAllConfirmOpen}
        onClose={() => setClearAllConfirmOpen(false)}
        onConfirm={handleClearAllConfirm}
        loading={clearingAll}
        title="Clear All Appointment Time Slots"
        message="Are you sure you want to remove all time slots? This will permanently delete all slots from the database so you can manage your custom times from scratch."
        confirmText="Clear All"
        confirmVariant="danger"
      />
    </div>
  );
};

export default AppointmentTimePage;

