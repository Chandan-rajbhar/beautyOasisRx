import React, { useState, useMemo } from 'react';
import {
  UserCheck,
  Plus,
  Eye,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  Mail,
  Phone,
  Star
} from 'lucide-react';
import { useAdminData } from '../../context/AdminDataContext';
import { AdminTable } from '../../components/admin/ui/AdminTable';
import { AdminToolbar } from '../../components/admin/ui/AdminToolbar';
import { AdminBadge } from '../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../components/admin/ui/AdminButton';
import { AdminModal } from '../../components/admin/ui/AdminModal';
import { AdminDrawer } from '../../components/admin/ui/AdminDrawer';
import { AdminConfirmDialog } from '../../components/admin/ui/AdminConfirmDialog';

export const ProvidersPage = () => {
  const { providers, createItem, updateItem, deleteItem, isLoading } = useAdminData();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [editProvider, setEditProvider] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    role: 'Aesthetic Clinician',
    specialization: 'Laser Therapy & Dermal Peels',
    email: '',
    phone: '',
    avatar: 'https://images.unsplash.com/photo-1594824813636-49bc8063259b?w=300&auto=format&fit=crop&q=80',
    bio: '',
    status: 'Active',
    rating: 4.95,
    availability: {
      Monday: '09:00 - 17:00',
      Tuesday: '09:00 - 17:00',
      Wednesday: '09:00 - 17:00',
      Thursday: '09:00 - 17:00',
      Friday: '09:00 - 15:00',
      Saturday: 'Off',
      Sunday: 'Off'
    }
  });

  const handleOpenAddModal = () => {
    setFormData({
      name: '',
      role: 'Clinical Aesthetic Specialist',
      specialization: 'Biostimulators & Skin Architecture',
      email: '',
      phone: '(214) 555-0100',
      avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&auto=format&fit=crop&q=80',
      bio: 'Experienced clinical specialist focused on regenerative skin rejuvenation and patient comfort.',
      status: 'Active',
      rating: 4.9,
      availability: {
        Monday: '09:00 - 17:00',
        Tuesday: '09:00 - 17:00',
        Wednesday: '09:00 - 17:00',
        Thursday: '09:00 - 17:00',
        Friday: '09:00 - 16:00',
        Saturday: '10:00 - 14:00',
        Sunday: 'Off'
      }
    });
    setIsAddModalOpen(true);
  };

  const handleSaveProvider = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      alert("Name and email are required.");
      return;
    }

    if (editProvider) {
      updateItem('providers', editProvider.id, formData);
      setEditProvider(null);
    } else {
      createItem('providers', formData);
      setIsAddModalOpen(false);
    }
  };

  const handleEditClick = (prov) => {
    setFormData(prov);
    setEditProvider(prov);
  };

  const handleToggleStatus = (prov) => {
    const nextStatus = prov.status === 'Active' ? 'On-Leave' : 'Active';
    updateItem('providers', prov.id, { status: nextStatus });
  };

  const handleDelete = () => {
    if (deleteConfirmId) {
      deleteItem('providers', deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const filteredProviders = useMemo(() => {
    return providers.filter((prov) => {
      const searchLower = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        prov.name.toLowerCase().includes(searchLower) ||
        prov.specialization.toLowerCase().includes(searchLower) ||
        prov.email.toLowerCase().includes(searchLower);

      const matchStatus = statusFilter === 'ALL' || prov.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [providers, searchTerm, statusFilter]);

  const columns = [
    {
      header: 'Clinician / Provider',
      accessor: 'name',
      sortable: true,
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src={row.avatar}
            alt={row.name}
            style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
          />
          <div>
            <div style={{ fontWeight: 600, color: '#0f2942' }}>{row.name}</div>
            <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{row.role}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Specialization',
      accessor: 'specialization',
      render: (row) => (
        <span style={{ fontSize: '0.84rem', color: '#334155' }}>
          {row.specialization}
        </span>
      )
    },
    {
      header: 'Contact Info',
      accessor: 'email',
      render: (row) => (
        <div>
          <div style={{ fontSize: '0.84rem', color: '#1e5aa8' }}>{row.email}</div>
          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{row.phone}</div>
        </div>
      )
    },
    {
      header: 'Patient Rating',
      accessor: 'rating',
      sortable: true,
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#eab308', fontWeight: 700, fontSize: '0.86rem' }}>
          <Star size={14} fill="#eab308" />
          <span>{row.rating || 4.9}</span>
        </div>
      )
    },
    {
      header: 'Availability Status',
      accessor: 'status',
      sortable: true,
      render: (row) => (
        <button
          onClick={() => handleToggleStatus(row)}
          title="Click to toggle active / on-leave"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
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
            onClick={() => setSelectedProvider(row)}
            title="View Profile & Hours"
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
            title="Edit Schedule & Bio"
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
            title="Delete Provider"
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
          <h1>Medical Staff & Clinical Providers</h1>
          <p>Manage physicians, aesthetic nurse practitioners, clinician availability rosters, and suites.</p>
        </div>

        <div className="admin-page-actions">
          <AdminButton
            variant="primary"
            onClick={handleOpenAddModal}
            icon={<Plus size={16} />}
          >
            Add Clinician
          </AdminButton>
        </div>
      </div>

      <AdminToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search providers by name, discipline, email..."
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
              { label: 'Active', value: 'Active' },
              { label: 'On-Leave', value: 'On-Leave' }
            ]
          }
        ]}
      />

      <AdminTable
        columns={columns}
        data={filteredProviders}
        loading={isLoading}
        itemsPerPage={8}
        emptyTitle="No providers found"
        emptyDescription="Adjust your search criteria or register a new clinician."
        emptyActionLabel="Add Clinician"
        onEmptyAction={handleOpenAddModal}
      />

      {/* Add / Edit Modal */}
      {(isAddModalOpen || editProvider) && (
        <AdminModal
          isOpen={isAddModalOpen || Boolean(editProvider)}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditProvider(null);
          }}
          title={editProvider ? "Edit Clinician Profile" : "Register New Clinician"}
          maxWidth="680px"
        >
          <form onSubmit={handleSaveProvider}>
            <div className="admin-form-grid-2">
              <div className="admin-form-group">
                <label className="admin-form-label">Clinician Name & Credentials</label>
                <input
                  type="text"
                  required
                  className="admin-form-input"
                  placeholder="e.g. Dr. Alistair Vance, MD"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Clinical Title / Role</label>
                <input
                  type="text"
                  required
                  className="admin-form-input"
                  placeholder="e.g. Medical Director & Aesthetic Physician"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Specialization</label>
                <input
                  type="text"
                  required
                  className="admin-form-input"
                  placeholder="e.g. Injectables, Polynucleotides & Deep RF"
                  value={formData.specialization}
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Staff Email Address</label>
                <input
                  type="email"
                  required
                  className="admin-form-input"
                  placeholder="clinician@beautyoasisrx.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Direct Contact Phone</label>
                <input
                  type="tel"
                  className="admin-form-input"
                  placeholder="(214) 555-0192"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Practice Status</label>
                <select
                  className="admin-form-select"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="Active">Active (Taking Appointments)</option>
                  <option value="On-Leave">On-Leave (Unavailable)</option>
                </select>
              </div>

              <div className="admin-form-group" style={{ gridColumn: 'span 2' }}>
                <label className="admin-form-label">Profile Avatar URL</label>
                <input
                  type="url"
                  className="admin-form-input"
                  value={formData.avatar}
                  onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                />
              </div>
            </div>

            {/* Weekly Availability Schedule Editor */}
            <div style={{ marginTop: '10px', marginBottom: '20px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <label className="admin-form-label" style={{ marginBottom: '10px' }}>
                Weekly Suite Availability Schedule
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                  <div key={day}>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{day}</span>
                    <input
                      type="text"
                      className="admin-form-input"
                      style={{ fontSize: '0.78rem', padding: '6px 8px' }}
                      value={formData.availability?.[day] || 'Off'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          availability: { ...formData.availability, [day]: e.target.value }
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Biography & Clinical Philosophy</label>
              <textarea
                className="admin-form-textarea"
                rows="3"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
              <AdminButton
                variant="secondary"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditProvider(null);
                }}
              >
                Cancel
              </AdminButton>
              <AdminButton type="submit" variant="primary">
                {editProvider ? "Save Clinician Record" : "Register Clinician"}
              </AdminButton>
            </div>
          </form>
        </AdminModal>
      )}

      {/* View Details Drawer */}
      <AdminDrawer
        isOpen={Boolean(selectedProvider)}
        onClose={() => setSelectedProvider(null)}
        title="Clinician Profile"
        subtitle={selectedProvider?.role}
        footer={
          <div style={{ display: 'flex', gap: '10px' }}>
            <AdminButton
              variant="secondary"
              onClick={() => {
                const p = selectedProvider;
                setSelectedProvider(null);
                handleEditClick(p);
              }}
              icon={<Edit2 size={14} />}
            >
              Edit
            </AdminButton>
            <AdminButton variant="primary" onClick={() => setSelectedProvider(null)}>
              Done
            </AdminButton>
          </div>
        }
      >
        {selectedProvider && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <img
                src={selectedProvider.avatar}
                alt={selectedProvider.name}
                style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', color: '#0f2942' }}>
                  {selectedProvider.name}
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '6px' }}>
                  {selectedProvider.specialization}
                </div>
                <AdminBadge status={selectedProvider.status} />
              </div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: '#0f2942', fontWeight: 700 }}>
                Clinical Background
              </h4>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#334155', lineHeight: 1.6 }}>
                {selectedProvider.bio}
              </p>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: '#0f2942', fontWeight: 700 }}>
                Weekly Clinic Schedule
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
                {Object.entries(selectedProvider.availability || {}).map(([day, hours]) => (
                  <div key={day} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontWeight: 600, color: '#334155' }}>{day}</span>
                    <span style={{ color: hours === 'Off' ? '#94a3b8' : '#15803d', fontWeight: hours === 'Off' ? 400 : 600 }}>
                      {hours}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </AdminDrawer>

      <AdminConfirmDialog
        isOpen={Boolean(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDelete}
        title="Delete Clinician Profile"
        message="Are you certain you want to remove this clinician from active practice schedules?"
      />
    </div>
  );
};
