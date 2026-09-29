import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar,
  Plus,
  Eye,
  Edit2,
  Trash2,
  XCircle,
  Clock,
  User,
  Sparkles,
  DollarSign
} from 'lucide-react';
import { useAdminData } from '../../context/AdminDataContext';
import { AdminTable } from '../../components/admin/ui/AdminTable';
import { AdminToolbar } from '../../components/admin/ui/AdminToolbar';
import { AdminBadge } from '../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../components/admin/ui/AdminButton';
import { AdminModal } from '../../components/admin/ui/AdminModal';
import { AdminDrawer } from '../../components/admin/ui/AdminDrawer';
import { AdminConfirmDialog } from '../../components/admin/ui/AdminConfirmDialog';

export const AppointmentsPage = () => {
  const { appointments, clients, services, providers, createItem, updateItem, deleteItem, isLoading } = useAdminData();
  const [searchParams, setSearchParams] = useSearchParams();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [serviceFilter, setServiceFilter] = useState('ALL');
  const [providerFilter, setProviderFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');

  // Modals & Drawers state
  const [isAddModalOpen, setIsAddModalOpen] = useState(searchParams.get('action') === 'new');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [editAppointment, setEditAppointment] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Form state for Add/Edit
  const [formData, setFormData] = useState({
    clientId: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    serviceId: '',
    serviceName: '',
    providerId: '',
    providerName: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00 AM',
    duration: '60 Mins',
    price: 185,
    type: 'In-Clinic Protocol',
    status: 'Confirmed',
    paymentStatus: 'Paid',
    room: 'Suite 1 - Gold Treatment Room',
    notes: ''
  });

  // Client Selection auto-fill
  const handleClientSelect = (clientId) => {
    const c = clients.find(cl => String(cl.id) === String(clientId));
    if (c) {
      setFormData(prev => ({
        ...prev,
        clientId: c.id,
        clientName: c.name,
        clientEmail: c.email,
        clientPhone: c.phone
      }));
    }
  };

  // Service Selection auto-fill
  const handleServiceSelect = (serviceId) => {
    const s = services.find(srv => String(srv.id) === String(serviceId));
    if (s) {
      setFormData(prev => ({
        ...prev,
        serviceId: s.id,
        serviceName: s.title,
        duration: s.duration || '60 Mins',
        price: s.numericPrice || parseInt(s.price?.replace(/[^0-9]/g, '') || 185, 10)
      }));
    }
  };

  // Provider Selection auto-fill
  const handleProviderSelect = (provId) => {
    const p = providers.find(pr => String(pr.id) === String(provId));
    if (p) {
      setFormData(prev => ({
        ...prev,
        providerId: p.id,
        providerName: p.name
      }));
    }
  };

  const handleOpenAddModal = () => {
    const firstClient = clients[0] || {};
    const firstService = services[0] || {};
    const firstProvider = providers[0] || {};

    setFormData({
      clientId: firstClient.id || '',
      clientName: firstClient.name || '',
      clientEmail: firstClient.email || '',
      clientPhone: firstClient.phone || '',
      serviceId: firstService.id || '',
      serviceName: firstService.title || '',
      providerId: firstProvider.id || '',
      providerName: firstProvider.name || '',
      date: new Date().toISOString().split('T')[0],
      time: '11:00 AM',
      duration: firstService.duration || '60 Mins',
      price: firstService.numericPrice || 185,
      type: 'In-Clinic Protocol',
      status: 'Confirmed',
      paymentStatus: 'Paid',
      room: 'Suite 1 - Gold Treatment Room',
      notes: ''
    });
    setIsAddModalOpen(true);
  };

  const handleSaveAppointment = (e) => {
    e.preventDefault();
    if (!formData.clientName || !formData.serviceName) {
      alert("Please ensure client and service are chosen.");
      return;
    }

    if (editAppointment) {
      updateItem('appointments', editAppointment.id, formData);
      setEditAppointment(null);
    } else {
      createItem('appointments', formData);
      setIsAddModalOpen(false);
      searchParams.delete('action');
      setSearchParams(searchParams);
    }
  };

  const handleEditClick = (apt) => {
    setFormData(apt);
    setEditAppointment(apt);
  };

  const handleDelete = () => {
    if (deleteConfirmId) {
      deleteItem('appointments', deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  // Filtered appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      // Search term match
      const searchLower = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        (apt.clientName && apt.clientName.toLowerCase().includes(searchLower)) ||
        (apt.serviceName && apt.serviceName.toLowerCase().includes(searchLower)) ||
        (apt.providerName && apt.providerName.toLowerCase().includes(searchLower)) ||
        (apt.id && apt.id.toLowerCase().includes(searchLower));

      // Status Filter
      const matchStatus = statusFilter === 'ALL' || apt.status === statusFilter;

      // Service Filter
      const matchService = serviceFilter === 'ALL' || apt.serviceName === serviceFilter;

      // Provider Filter
      const matchProvider = providerFilter === 'ALL' || apt.providerName === providerFilter;

      // Payment Filter
      const matchPayment = paymentFilter === 'ALL' || apt.paymentStatus === paymentFilter;

      // Date Filter
      const matchDate = !dateFilter || apt.date === dateFilter;

      return matchSearch && matchStatus && matchService && matchProvider && matchPayment && matchDate;
    });
  }, [appointments, searchTerm, statusFilter, serviceFilter, providerFilter, paymentFilter, dateFilter]);

  const hasActiveFilters =
    Boolean(searchTerm) ||
    statusFilter !== 'ALL' ||
    serviceFilter !== 'ALL' ||
    providerFilter !== 'ALL' ||
    paymentFilter !== 'ALL' ||
    Boolean(dateFilter);

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setServiceFilter('ALL');
    setProviderFilter('ALL');
    setPaymentFilter('ALL');
    setDateFilter('');
  };

  // Columns definition
  const columns = [
    {
      header: 'Patient / Client',
      accessor: 'clientName',
      sortable: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f2942' }}>{row.clientName}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{row.clientPhone || row.clientEmail}</div>
        </div>
      )
    },
    {
      header: 'Service Protocol',
      accessor: 'serviceName',
      sortable: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{row.serviceName}</div>
          <div style={{ fontSize: '0.75rem', color: '#1e5aa8', display: 'flex', gap: '8px' }}>
            <span>{row.duration || '60 Mins'}</span>
            <span>•</span>
            <span style={{ fontWeight: 600, color: '#15803d' }}>${row.price}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Provider',
      accessor: 'providerName',
      sortable: true,
      render: (row) => (
        <div>
          <div style={{ fontSize: '0.86rem', color: '#334155' }}>{row.providerName}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{row.room || 'Suite 1'}</div>
        </div>
      )
    },
    {
      header: 'Date & Time',
      accessor: 'date',
      sortable: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f2942' }}>{row.date}</div>
          <div style={{ fontSize: '0.76rem', color: '#64748b' }}>{row.time}</div>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      render: (row) => <AdminBadge status={row.status} />
    },
    {
      header: 'Payment',
      accessor: 'paymentStatus',
      sortable: true,
      render: (row) => <AdminBadge status={row.paymentStatus} />
    },
    {
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setSelectedAppointment(row)}
            title="View Full Record"
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
            title="Edit Appointment"
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

          {row.status !== 'Cancelled' && (
            <button
              onClick={() => updateItem('appointments', row.id, { status: 'Cancelled' })}
              title="Cancel Appointment"
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                padding: '6px 8px',
                borderRadius: '6px',
                cursor: 'pointer',
                color: '#b91c1c',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <XCircle size={14} />
            </button>
          )}

          <button
            onClick={() => setDeleteConfirmId(row.id)}
            title="Delete Appointment"
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
      {/* Page Header */}
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Appointment Management</h1>
          <p>Schedule, monitor, and manage clinical consultations and treatment protocols.</p>
        </div>

        <div className="admin-page-actions">
          <AdminButton
            variant="primary"
            onClick={handleOpenAddModal}
            icon={<Plus size={16} />}
          >
            New Appointment
          </AdminButton>
        </div>
      </div>

      {/* Toolbar / Filters */}
      <AdminToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by client, service, provider..."
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
        filters={[
          {
            id: 'status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { label: 'All Statuses', value: 'ALL' },
              { label: 'Confirmed', value: 'Confirmed' },
              { label: 'Completed', value: 'Completed' },
              { label: 'Pending', value: 'Pending' },
              { label: 'Cancelled', value: 'Cancelled' },
              { label: 'No Show', value: 'No Show' }
            ]
          },
          {
            id: 'payment',
            value: paymentFilter,
            onChange: setPaymentFilter,
            options: [
              { label: 'All Payments', value: 'ALL' },
              { label: 'Paid', value: 'Paid' },
              { label: 'Pending', value: 'Pending' },
              { label: 'Refunded', value: 'Refunded' }
            ]
          },
          {
            id: 'provider',
            value: providerFilter,
            onChange: setProviderFilter,
            options: [
              { label: 'All Providers', value: 'ALL' },
              ...providers.map(p => ({ label: p.name, value: p.name }))
            ]
          }
        ]}
      />

      {/* Main Table */}
      <AdminTable
        columns={columns}
        data={filteredAppointments}
        loading={isLoading}
        itemsPerPage={8}
        emptyTitle="No appointments match your filters"
        emptyDescription="Try adjusting your search criteria, dates, or booking a new clinical appointment."
        emptyActionLabel="Schedule Appointment"
        onEmptyAction={handleOpenAddModal}
      />

      {/* ── Add / Edit Appointment Modal ── */}
      {(isAddModalOpen || editAppointment) && (
        <AdminModal
          isOpen={isAddModalOpen || Boolean(editAppointment)}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditAppointment(null);
          }}
          title={editAppointment ? "Edit Appointment Protocol" : "Schedule New Appointment"}
          maxWidth="680px"
        >
          <form onSubmit={handleSaveAppointment}>
            <div className="admin-form-grid-2">
              {/* Client Selection */}
              <div className="admin-form-group">
                <label className="admin-form-label">Select Patient / Client</label>
                <select
                  className="admin-form-select"
                  value={formData.clientId}
                  onChange={(e) => handleClientSelect(e.target.value)}
                  required
                >
                  <option value="">-- Choose Existing Patient --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone || c.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Service Selection */}
              <div className="admin-form-group">
                <label className="admin-form-label">Clinical Treatment / Service</label>
                <select
                  className="admin-form-select"
                  value={formData.serviceId}
                  onChange={(e) => handleServiceSelect(e.target.value)}
                  required
                >
                  <option value="">-- Choose Treatment Protocol --</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.duration || '60 Mins'} - ${s.numericPrice || 185})
                    </option>
                  ))}
                </select>
              </div>

              {/* Provider Selection */}
              <div className="admin-form-group">
                <label className="admin-form-label">Assigned Clinician</label>
                <select
                  className="admin-form-select"
                  value={formData.providerId}
                  onChange={(e) => handleProviderSelect(e.target.value)}
                  required
                >
                  <option value="">-- Select Physician / Clinician --</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Treatment Room / Suite */}
              <div className="admin-form-group">
                <label className="admin-form-label">Clinical Suite</label>
                <select
                  className="admin-form-select"
                  value={formData.room}
                  onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                >
                  <option value="Suite 1 - Gold Treatment Room">Suite 1 - Gold Treatment Room</option>
                  <option value="Suite 2 - Aesthetic Lounge">Suite 2 - Aesthetic Lounge</option>
                  <option value="Suite 3 - Laser Center">Suite 3 - Laser Center</option>
                  <option value="Sensory Suite A - Low Stimulation">Sensory Suite A - Low Stimulation</option>
                </select>
              </div>

              {/* Date */}
              <div className="admin-form-group">
                <label className="admin-form-label">Appointment Date</label>
                <input
                  type="date"
                  className="admin-form-input"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>

              {/* Time */}
              <div className="admin-form-group">
                <label className="admin-form-label">Appointment Time</label>
                <select
                  className="admin-form-select"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                >
                  <option value="09:00 AM">09:00 AM</option>
                  <option value="10:00 AM">10:00 AM</option>
                  <option value="11:30 AM">11:30 AM</option>
                  <option value="01:00 PM">01:00 PM</option>
                  <option value="02:30 PM">02:30 PM</option>
                  <option value="03:30 PM">03:30 PM</option>
                  <option value="04:30 PM">04:30 PM</option>
                  <option value="05:30 PM">05:30 PM</option>
                </select>
              </div>

              {/* Status */}
              <div className="admin-form-group">
                <label className="admin-form-label">Booking Status</label>
                <select
                  className="admin-form-select"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="Confirmed">Confirmed</option>
                  <option value="Pending">Pending</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="No Show">No Show</option>
                </select>
              </div>

              {/* Payment Status */}
              <div className="admin-form-group">
                <label className="admin-form-label">Payment Status</label>
                <select
                  className="admin-form-select"
                  value={formData.paymentStatus}
                  onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
                >
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                  <option value="Refunded">Refunded</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div className="admin-form-group">
              <label className="admin-form-label">Sensory & Medical Notes</label>
              <textarea
                className="admin-form-textarea"
                rows="3"
                placeholder="Sensory adjustments, lighting preferences, skin allergies, or customized booster requirements..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
              <AdminButton
                variant="secondary"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditAppointment(null);
                }}
              >
                Cancel
              </AdminButton>
              <AdminButton type="submit" variant="primary">
                {editAppointment ? "Update Appointment" : "Confirm & Save Appointment"}
              </AdminButton>
            </div>
          </form>
        </AdminModal>
      )}

      {/* ── View Appointment Drawer ── */}
      <AdminDrawer
        isOpen={Boolean(selectedAppointment)}
        onClose={() => setSelectedAppointment(null)}
        title="Appointment Summary"
        subtitle={`Reference #${selectedAppointment?.id}`}
        footer={
          <div style={{ display: 'flex', gap: '10px' }}>
            <AdminButton
              variant="secondary"
              onClick={() => {
                const target = selectedAppointment;
                setSelectedAppointment(null);
                handleEditClick(target);
              }}
              icon={<Edit2 size={14} />}
            >
              Edit Details
            </AdminButton>
            <AdminButton variant="primary" onClick={() => setSelectedAppointment(null)}>
              Done
            </AdminButton>
          </div>
        }
      >
        {selectedAppointment && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                background: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}
            >
              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Appointment Status
                </span>
                <div style={{ marginTop: '4px' }}>
                  <AdminBadge status={selectedAppointment.status} />
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Payment Status
                </span>
                <div style={{ marginTop: '4px' }}>
                  <AdminBadge status={selectedAppointment.paymentStatus} />
                </div>
              </div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: '#0f2942', fontWeight: 700 }}>
                Patient Details
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.84rem' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Name</span>
                  <span style={{ fontWeight: 600 }}>{selectedAppointment.clientName}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Contact Phone</span>
                  <span>{selectedAppointment.clientPhone}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Email Address</span>
                  <span>{selectedAppointment.clientEmail}</span>
                </div>
              </div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: '#0f2942', fontWeight: 700 }}>
                Protocol Details
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.84rem' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Service</span>
                  <span style={{ fontWeight: 600, color: '#1e5aa8' }}>{selectedAppointment.serviceName}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Amount</span>
                  <span style={{ fontWeight: 700, color: '#15803d' }}>${selectedAppointment.price}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Clinician</span>
                  <span>{selectedAppointment.providerName}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Suite</span>
                  <span>{selectedAppointment.room || 'Suite 1'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Scheduled Date</span>
                  <span style={{ fontWeight: 600 }}>{selectedAppointment.date}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Scheduled Time</span>
                  <span>{selectedAppointment.time}</span>
                </div>
              </div>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '0.84rem', color: '#0f2942', fontWeight: 700 }}>
                Clinical & Sensory Notes
              </h4>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>
                {selectedAppointment.notes || 'No special clinical notes entered.'}
              </p>
            </div>
          </div>
        )}
      </AdminDrawer>

      {/* Delete Confirmation Dialog */}
      <AdminConfirmDialog
        isOpen={Boolean(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDelete}
        title="Delete Appointment"
        message="Are you certain you want to delete this appointment? This record will be permanently purged from the system."
      />
    </div>
  );
};
