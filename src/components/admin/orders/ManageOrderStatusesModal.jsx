import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  AlertCircle,
  Tag,
  ArrowUpDown,
  CheckCircle2,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminModal } from '../ui/AdminModal';
import { AdminButton } from '../ui/AdminButton';
import {
  fetchOrderStatuses,
  createOrderStatus,
  updateOrderStatus,
  deleteOrderStatus
} from '../../../services/orderService';

export const ManageOrderStatusesModal = ({
  isOpen,
  onClose,
  onStatusesUpdated,
  orders = []
}) => {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // New status form state
  const [newStatus, setNewStatus] = useState({
    name: '',
    key: '',
    description: '',
    display_order: 1,
    color: '#1e5aa8',
    is_active: true
  });

  // Edit status form state
  const [editStatus, setEditStatus] = useState({
    name: '',
    description: '',
    display_order: 1,
    color: '#1e5aa8'
  });

  const loadStatuses = async () => {
    setLoading(true);
    try {
      const data = await fetchOrderStatuses();
      setStatuses(data || []);
      if (onStatusesUpdated) onStatusesUpdated(data || []);
    } catch (err) {
      console.error('Failed to load statuses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStatuses();
      setIsAddingNew(false);
      setEditingId(null);
    }
  }, [isOpen]);

  const handleStartEdit = (st) => {
    setEditingId(st.id);
    setEditStatus({
      name: st.name,
      description: st.description || '',
      display_order: st.display_order || 1,
      color: st.color || '#1e5aa8'
    });
  };

  const handleSaveEdit = async (id) => {
    if (!editStatus.name.trim()) {
      toast.error('Status name is required');
      return;
    }
    setIsSaving(true);
    try {
      await updateOrderStatus(id, editStatus);
      toast.success('Order status updated');
      setEditingId(null);
      await loadStatuses();
    } catch (err) {
      toast.error('Failed to update status');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (st) => {
    try {
      await updateOrderStatus(st.id, { is_active: !st.is_active });
      toast.success(`Status "${st.name}" marked as ${!st.is_active ? 'Active' : 'Inactive'}`);
      await loadStatuses();
    } catch (err) {
      toast.error('Failed to toggle status state');
    }
  };

  const handleDelete = async (st) => {
    // Check if any order currently has this status
    const inUseCount = orders.filter(
      (o) => (o.orderStatus || o.status || '').toLowerCase() === st.name.toLowerCase()
    ).length;

    if (inUseCount > 0) {
      toast.error(`Cannot delete "${st.name}" — it is currently assigned to ${inUseCount} order(s). Deactivate it instead.`);
      return;
    }

    if (window.confirm(`Are you sure you want to delete status "${st.name}"?`)) {
      try {
        await deleteOrderStatus(st.id);
        toast.success(`Status "${st.name}" deleted`);
        await loadStatuses();
      } catch (err) {
        toast.error('Failed to delete status');
      }
    }
  };

  const handleCreateStatus = async (e) => {
    e.preventDefault();
    if (!newStatus.name.trim()) {
      toast.error('Status name is required');
      return;
    }
    setIsSaving(true);
    try {
      await createOrderStatus(newStatus);
      toast.success(`Status "${newStatus.name}" created successfully`);
      setIsAddingNew(false);
      setNewStatus({
        name: '',
        key: '',
        description: '',
        display_order: statuses.length + 1,
        color: '#1e5aa8',
        is_active: true
      });
      await loadStatuses();
    } catch (err) {
      toast.error('Failed to create status');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Order Statuses & Pipeline"
      maxWidth="680px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b' }}>
            Configure the dynamic order fulfillment progression pipeline stored in Supabase.
          </p>
          {!isAddingNew && (
            <AdminButton
              variant="primary"
              onClick={() => {
                setIsAddingNew(true);
                setNewStatus((prev) => ({ ...prev, display_order: statuses.length + 1 }));
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px' }}
            >
              <Plus size={14} /> Add Status
            </AdminButton>
          )}
        </div>

        {/* Add Status Form Drawer */}
        {isAddingNew && (
          <form
            onSubmit={handleCreateStatus}
            style={{
              padding: '16px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f2942' }}>Add New Order Status</span>
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px' }}>
              <div className="admin-form-group">
                <label className="admin-form-label" style={{ fontSize: '0.78rem' }}>Status Name *</label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={newStatus.name}
                  onChange={(e) => setNewStatus({ ...newStatus, name: e.target.value, key: e.target.value })}
                  placeholder="e.g. Ready for Pickup"
                  required
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label" style={{ fontSize: '0.78rem' }}>Display Order</label>
                <input
                  type="number"
                  className="admin-form-input"
                  value={newStatus.display_order}
                  onChange={(e) => setNewStatus({ ...newStatus, display_order: Number(e.target.value) })}
                  min="1"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label" style={{ fontSize: '0.78rem' }}>Color Badge</label>
                <input
                  type="color"
                  className="admin-form-input"
                  style={{ height: '38px', padding: '2px', cursor: 'pointer' }}
                  value={newStatus.color}
                  onChange={(e) => setNewStatus({ ...newStatus, color: e.target.value })}
                />
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label" style={{ fontSize: '0.78rem' }}>Description / Clinical Meaning</label>
              <input
                type="text"
                className="admin-form-input"
                value={newStatus.description}
                onChange={(e) => setNewStatus({ ...newStatus, description: e.target.value })}
                placeholder="e.g. Package compounding verified and awaiting customer arrival."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <AdminButton variant="secondary" onClick={() => setIsAddingNew(false)}>
                Cancel
              </AdminButton>
              <AdminButton variant="primary" type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Create Status'}
              </AdminButton>
            </div>
          </form>
        )}

        {/* Statuses List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
          {statuses.map((st, idx) => {
            const isEditing = editingId === st.id;
            const inUseCount = orders.filter(
              (o) => (o.orderStatus || o.status || '').toLowerCase() === st.name.toLowerCase()
            ).length;

            return (
              <div
                key={st.id || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: st.is_active ? '#ffffff' : '#f8fafc',
                  border: '1px solid #e2e8f0',
                  opacity: st.is_active ? 1 : 0.7,
                  transition: 'all 0.15s ease'
                }}
              >
                {isEditing ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                    <input
                      type="text"
                      className="admin-form-input"
                      value={editStatus.name}
                      onChange={(e) => setEditStatus({ ...editStatus, name: e.target.value })}
                      style={{ flex: 2 }}
                    />
                    <input
                      type="text"
                      className="admin-form-input"
                      value={editStatus.description}
                      onChange={(e) => setEditStatus({ ...editStatus, description: e.target.value })}
                      placeholder="Description"
                      style={{ flex: 3 }}
                    />
                    <input
                      type="number"
                      className="admin-form-input"
                      value={editStatus.display_order}
                      onChange={(e) => setEditStatus({ ...editStatus, display_order: Number(e.target.value) })}
                      style={{ width: '60px' }}
                    />
                    <input
                      type="color"
                      value={editStatus.color}
                      onChange={(e) => setEditStatus({ ...editStatus, color: e.target.value })}
                      style={{ width: '38px', height: '36px', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(st.id)}
                      disabled={isSaving}
                      style={{ background: '#15803d', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px', cursor: 'pointer' }}
                    >
                      <Check size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      style={{ background: '#94a3b8', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px', cursor: 'pointer' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: st.color || '#1e5aa8',
                          flexShrink: 0
                        }}
                      />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, color: '#0f2942', fontSize: '0.88rem' }}>
                            {st.name}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                            Step {st.display_order || idx + 1}
                          </span>
                          {!st.is_active && (
                            <span style={{ fontSize: '0.72rem', color: '#dc2626', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                              Inactive
                            </span>
                          )}
                          {inUseCount > 0 && (
                            <span style={{ fontSize: '0.72rem', color: '#0369a1', background: '#e0f2fe', padding: '2px 6px', borderRadius: '4px' }}>
                              {inUseCount} order(s)
                            </span>
                          )}
                        </div>
                        {st.description && (
                          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                            {st.description}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(st)}
                        title={st.is_active ? 'Deactivate status' : 'Activate status'}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: st.is_active ? '#15803d' : '#94a3b8',
                          padding: '4px'
                        }}
                      >
                        {st.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStartEdit(st)}
                        title="Edit Status"
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          padding: '6px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: '#334155'
                        }}
                      >
                        <Edit2 size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(st)}
                        title="Delete Status"
                        style={{
                          background: '#fee2e2',
                          border: '1px solid #fca5a5',
                          padding: '6px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: '#b91c1c'
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <AdminButton variant="secondary" onClick={onClose}>
            Done
          </AdminButton>
        </div>
      </div>
    </AdminModal>
  );
};
