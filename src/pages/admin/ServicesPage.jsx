import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Plus,
  Eye,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Tag,
  Globe
} from 'lucide-react';
import { useAdminData } from '../../context/AdminDataContext';
import { AdminTable } from '../../components/admin/ui/AdminTable';
import { AdminToolbar } from '../../components/admin/ui/AdminToolbar';
import { AdminBadge } from '../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../components/admin/ui/AdminButton';
import { AdminModal } from '../../components/admin/ui/AdminModal';
import { AdminDrawer } from '../../components/admin/ui/AdminDrawer';
import { AdminConfirmDialog } from '../../components/admin/ui/AdminConfirmDialog';
import { treatmentCategories } from '../../data/treatmentsData';

export const ServicesPage = () => {
  const { services, createItem, updateItem, deleteItem, isLoading } = useAdminData();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [editService, setEditService] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    category: 'Skin Rejuvenation',
    tagline: '',
    description: '',
    duration: '60 Mins',
    price: '$185',
    numericPrice: 185,
    badge: 'SIGNATURE PROTOCOL',
    status: 'Active',
    displayOrder: 1,
    downtime: 'Zero Downtime',
    suitableFor: 'All skin types'
  });

  const handleOpenAddModal = () => {
    setFormData({
      title: '',
      category: 'Skin Rejuvenation',
      tagline: 'Custom Regenerative Facial Protocol',
      description: 'Medical-grade protocol utilizing high-potency actives and customized skin conditioning.',
      duration: '60 Mins',
      price: '$195',
      numericPrice: 195,
      badge: 'CLINICAL PROTOCOL',
      status: 'Active',
      displayOrder: services.length + 1,
      downtime: 'Zero Downtime',
      suitableFor: 'Dehydration, dullness, fine lines'
    });
    setIsAddModalOpen(true);
  };

  const handleSaveService = (e) => {
    e.preventDefault();
    if (!formData.title) {
      alert("Service name is required.");
      return;
    }

    const priceFormatted = formData.price.startsWith('$') ? formData.price : `$${formData.price}`;
    const numPrice = parseInt(String(formData.price).replace(/[^0-9]/g, ''), 10) || 185;

    const payload = {
      ...formData,
      price: priceFormatted,
      numericPrice: numPrice
    };

    if (editService) {
      updateItem('services', editService.id, payload);
      setEditService(null);
    } else {
      createItem('services', payload);
      setIsAddModalOpen(false);
    }
  };

  const handleEditClick = (srv) => {
    setFormData(srv);
    setEditService(srv);
  };

  const handleToggleStatus = (srv) => {
    const nextStatus = srv.status === 'Active' ? 'Inactive' : 'Active';
    updateItem('services', srv.id, { status: nextStatus });
  };

  const handleDelete = () => {
    if (deleteConfirmId) {
      deleteItem('services', deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const filteredServices = useMemo(() => {
    return services.filter((srv) => {
      const searchLower = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        srv.title.toLowerCase().includes(searchLower) ||
        (srv.category && srv.category.toLowerCase().includes(searchLower)) ||
        (srv.description && srv.description.toLowerCase().includes(searchLower));

      const matchCat = categoryFilter === 'ALL' || srv.category === categoryFilter;
      const matchStatus = statusFilter === 'ALL' || srv.status === statusFilter;

      return matchSearch && matchCat && matchStatus;
    });
  }, [services, searchTerm, categoryFilter, statusFilter]);

  const columns = [
    {
      header: 'Protocol / Service',
      accessor: 'title',
      sortable: true,
      render: (row) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 600, color: '#0f2942' }}>{row.title}</span>
            {row.badge && (
              <span
                style={{
                  fontSize: '0.65rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: '#f0f7ff',
                  color: '#1e5aa8',
                  fontWeight: 700
                }}
              >
                {row.badge}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{row.tagline || row.suitableFor}</div>
        </div>
      )
    },
    {
      header: 'Category',
      accessor: 'category',
      sortable: true,
      render: (row) => (
        <span
          style={{
            background: '#f1f5f9',
            padding: '4px 10px',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#334155'
          }}
        >
          {row.category}
        </span>
      )
    },
    {
      header: 'Duration',
      accessor: 'duration',
      render: (row) => (
        <div style={{ fontSize: '0.84rem', color: '#475569' }}>
          {row.duration || '60 Mins'}
        </div>
      )
    },
    {
      header: 'Price',
      accessor: 'numericPrice',
      sortable: true,
      render: (row) => (
        <div style={{ fontWeight: 700, color: '#15803d', fontSize: '0.9rem' }}>
          ${row.numericPrice || row.price}
        </div>
      )
    },
    {
      header: 'Website Visibility',
      accessor: 'status',
      sortable: true,
      render: (row) => (
        <button
          onClick={() => handleToggleStatus(row)}
          title="Click to toggle visibility on public site"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0
          }}
        >
          <AdminBadge status={row.status || 'Active'} />
        </button>
      )
    },
    {
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setSelectedService(row)}
            title="View Details"
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
            onClick={() => handleEditClick(row)}
            title="Edit Protocol"
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
            title="Delete Protocol"
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
          <h1>Clinical Services & Treatment Protocols</h1>
          <p>Manage treatment definitions, pricing, durations, and public website display status.</p>
        </div>

        <div className="admin-page-actions">
          <AdminButton
            variant="primary"
            onClick={handleOpenAddModal}
            icon={<Plus size={16} />}
          >
            Add Treatment Protocol
          </AdminButton>
        </div>
      </div>

      <AdminToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search treatments by title, category, description..."
        hasActiveFilters={Boolean(searchTerm) || categoryFilter !== 'ALL' || statusFilter !== 'ALL'}
        onClearFilters={() => {
          setSearchTerm('');
          setCategoryFilter('ALL');
          setStatusFilter('ALL');
        }}
        filters={[
          {
            id: 'category',
            value: categoryFilter,
            onChange: setCategoryFilter,
            options: [
              { label: 'All Categories', value: 'ALL' },
              ...treatmentCategories.filter(c => c !== "All Treatments").map(c => ({ label: c, value: c }))
            ]
          },
          {
            id: 'status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { label: 'All Visibility', value: 'ALL' },
              { label: 'Active (Visible on Site)', value: 'Active' },
              { label: 'Inactive (Hidden)', value: 'Inactive' }
            ]
          }
        ]}
      />

      <AdminTable
        columns={columns}
        data={filteredServices}
        loading={isLoading}
        itemsPerPage={8}
        emptyTitle="No treatment protocols found"
        emptyDescription="Adjust your search criteria or create a new treatment protocol."
        emptyActionLabel="Add Treatment Protocol"
        onEmptyAction={handleOpenAddModal}
      />

      {/* ── Add / Edit Service Modal ── */}
      {(isAddModalOpen || editService) && (
        <AdminModal
          isOpen={isAddModalOpen || Boolean(editService)}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditService(null);
          }}
          title={editService ? "Edit Treatment Protocol" : "Add New Treatment Protocol"}
          maxWidth="640px"
        >
          <form onSubmit={handleSaveService}>
            <div className="admin-form-grid-2">
              <div className="admin-form-group">
                <label className="admin-form-label">Protocol Title</label>
                <input
                  type="text"
                  required
                  className="admin-form-input"
                  placeholder="e.g. Hydrafacial Deluxe Pro"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Category</label>
                <select
                  className="admin-form-select"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {treatmentCategories.filter(c => c !== "All Treatments").map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Price ($ USD)</label>
                <input
                  type="number"
                  required
                  className="admin-form-input"
                  placeholder="185"
                  value={formData.numericPrice || 185}
                  onChange={(e) => setFormData({ ...formData, numericPrice: Number(e.target.value), price: `$${e.target.value}` })}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Duration</label>
                <input
                  type="text"
                  className="admin-form-input"
                  placeholder="60 Mins"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Badge Tag</label>
                <input
                  type="text"
                  className="admin-form-input"
                  placeholder="SIGNATURE PROTOCOL"
                  value={formData.badge}
                  onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Public Website Visibility</label>
                <select
                  className="admin-form-select"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="Active">Active (Published on Public Website)</option>
                  <option value="Inactive">Inactive (Hidden from Public)</option>
                </select>
              </div>

              <div className="admin-form-group" style={{ gridColumn: 'span 2' }}>
                <label className="admin-form-label">Tagline</label>
                <input
                  type="text"
                  className="admin-form-input"
                  placeholder="Deep Dermal Cleanse & Vortex Infusion"
                  value={formData.tagline}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                />
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Clinical Description</label>
              <textarea
                className="admin-form-textarea"
                rows="3"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
              <AdminButton
                variant="secondary"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditService(null);
                }}
              >
                Cancel
              </AdminButton>
              <AdminButton type="submit" variant="primary">
                {editService ? "Update Protocol" : "Publish Treatment Protocol"}
              </AdminButton>
            </div>
          </form>
        </AdminModal>
      )}

      {/* ── View Service Drawer ── */}
      <AdminDrawer
        isOpen={Boolean(selectedService)}
        onClose={() => setSelectedService(null)}
        title="Protocol Overview"
        subtitle={`ID: ${selectedService?.id}`}
        footer={
          <div style={{ display: 'flex', gap: '10px' }}>
            <AdminButton
              variant="secondary"
              onClick={() => {
                const s = selectedService;
                setSelectedService(null);
                handleEditClick(s);
              }}
              icon={<Edit2 size={14} />}
            >
              Edit
            </AdminButton>
            <AdminButton variant="primary" onClick={() => setSelectedService(null)}>
              Done
            </AdminButton>
          </div>
        }
      >
        {selectedService && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Website Status
                </span>
                <div style={{ marginTop: '4px' }}>
                  <AdminBadge status={selectedService.status} />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Fee
                </span>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#15803d' }}>
                  ${selectedService.numericPrice || selectedService.price}
                </div>
              </div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#0f2942', fontWeight: 700 }}>
                {selectedService.title}
              </h4>
              <p style={{ margin: '0 0 12px', fontSize: '0.84rem', color: '#475569', fontStyle: 'italic' }}>
                "{selectedService.tagline}"
              </p>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#334155', lineHeight: 1.6 }}>
                {selectedService.description}
              </p>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.88rem', color: '#0f2942', fontWeight: 700 }}>
                Clinical Specifications
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.84rem' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Category</span>
                  <span style={{ fontWeight: 600 }}>{selectedService.category}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Duration</span>
                  <span>{selectedService.duration || '60 Mins'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Downtime</span>
                  <span>{selectedService.downtime || 'Zero Downtime'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', display: 'block' }}>Badge</span>
                  <span>{selectedService.badge || 'Standard Protocol'}</span>
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
        title="Delete Treatment Protocol"
        message="Are you sure you want to remove this treatment protocol? It will no longer be visible or bookable by patients."
      />
    </div>
  );
};
