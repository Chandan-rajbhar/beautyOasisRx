import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Users,
  DollarSign,
  Sparkles,
  Eye,
  Edit2,
  Trash2,
  XCircle,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useAdminData } from '../../context/AdminDataContext';
import { AdminCard } from '../../components/admin/ui/AdminCard';
import { AdminBadge } from '../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../components/admin/ui/AdminButton';
import { AdminDrawer } from '../../components/admin/ui/AdminDrawer';
import { AdminModal } from '../../components/admin/ui/AdminModal';
import { AdminConfirmDialog } from '../../components/admin/ui/AdminConfirmDialog';
import { DashboardCharts } from '../../components/admin/charts/DashboardCharts';

export const AdminDashboardPage = () => {
  const { appointments, clients, payments, services, stats, updateItem, deleteItem } = useAdminData();
  const navigate = useNavigate();

  // Selected item states
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [editAppointment, setEditAppointment] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Recent Appointments slice
  const recentAppointments = appointments.slice(0, 6);

  const handleUpdateStatus = (status, paymentStatus) => {
    if (!editAppointment) return;
    updateItem('appointments', editAppointment.id, {
      status,
      paymentStatus: paymentStatus || editAppointment.paymentStatus
    });
    setEditAppointment(null);
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirmId) {
      deleteItem('appointments', deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  return (
    <div>
      {/* ── Top Page Header ── */}
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Clinical Practice Overview</h1>
          <p>Real-time analytics for appointments, patient registry, treatments, and practice revenue.</p>
        </div>

        <div className="admin-page-actions">
          <AdminButton
            variant="secondary"
            onClick={() => navigate('/clients')}
            icon={<Users size={16} />}
          >
            Patient Registry
          </AdminButton>

          <AdminButton
            variant="primary"
            onClick={() => navigate('/appointments?action=new')}
            icon={<Plus size={16} />}
          >
            Book Appointment
          </AdminButton>
        </div>
      </div>

      {/* ── Core Metric Cards Grid ── */}
      <div className="admin-stats-grid">
        {/* Appointments Today */}
        <AdminCard
          title="Today's Appointments"
          value={stats.todayAppointmentsCount}
          subtitle={`${stats.upcomingAppointmentsCount} upcoming this week`}
          icon={<Calendar size={20} />}
          iconBg="#f0fdf4"
          iconColor="#16a34a"
          trend={{ value: "+8%", isPositive: true, text: "vs yesterday" }}
          onClick={() => navigate('/appointments')}
        />

        {/* Total Active Clients */}
        <AdminCard
          title="Total Patients / Clients"
          value={stats.totalClientsCount}
          subtitle={`${stats.newClientsCount} joined this month`}
          icon={<Users size={20} />}
          iconBg="#f0f7ff"
          iconColor="#1e5aa8"
          trend={{ value: "+12.4%", isPositive: true, text: "monthly growth" }}
          onClick={() => navigate('/clients')}
        />

        {/* Practice Revenue */}
        <AdminCard
          title="Practice Revenue"
          value={`$${stats.totalRevenue.toLocaleString()}`}
          subtitle={`$${stats.pendingRevenue.toLocaleString()} pending collections`}
          icon={<DollarSign size={20} />}
          iconBg="#fefce8"
          iconColor="#ca8a04"
          trend={{ value: "+19.5%", isPositive: true, text: "vs last cycle" }}
          onClick={() => navigate('/payments')}
        />

        {/* Active Protocols */}
        <AdminCard
          title="Active Treatments"
          value={stats.activeServicesCount}
          subtitle={`${stats.totalServicesCount} total published protocols`}
          icon={<Sparkles size={20} />}
          iconBg="#fdf2f8"
          iconColor="#db2777"
          onClick={() => navigate('/services')}
        />
      </div>

      {/* ── Interactive Charts ── */}
      <DashboardCharts
        appointments={appointments}
        payments={payments}
        services={services}
      />

      {/* ── Section: Recent Appointments Table ── */}
      <div style={{ marginTop: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif-display)', fontSize: '1.4rem', color: '#0f2942', margin: 0 }}>
              Recent Appointments
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.84rem', color: '#64748b' }}>
              Latest patient consultations and clinical protocol sessions
            </p>
          </div>

          <Link
            to="/appointments"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.84rem',
              color: '#1e5aa8',
              fontWeight: 600,
              textDecoration: 'none'
            }}
          >
            <span>View All Appointments</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {/* Table Container */}
        <div className="admin-table-container">
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Service Protocol</th>
                  <th>Clinician / Provider</th>
                  <th>Date & Time</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentAppointments.map((apt) => (
                  <tr key={apt.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f2942' }}>{apt.clientName}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{apt.clientPhone}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{apt.serviceName}</div>
                      <div style={{ fontSize: '0.75rem', color: '#1e5aa8' }}>{apt.duration || '60 Mins'}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem', color: '#334155' }}>{apt.providerName}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{apt.room || 'Suite 1'}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f2942' }}>{apt.date}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{apt.time}</div>
                    </td>
                    <td>
                      <AdminBadge status={apt.status} />
                    </td>
                    <td>
                      <AdminBadge status={apt.paymentStatus} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {/* View Details Drawer */}
                        <button
                          onClick={() => setSelectedAppointment(apt)}
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

                        {/* Edit Status Modal */}
                        <button
                          onClick={() => setEditAppointment(apt)}
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

                        {/* Cancel Appointment Quick Action */}
                        {apt.status !== 'Cancelled' && (
                          <button
                            onClick={() => {
                              updateItem('appointments', apt.id, { status: 'Cancelled' });
                            }}
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

                        {/* Delete with Confirmation */}
                        <button
                          onClick={() => setDeleteConfirmId(apt.id)}
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Appointment Details Drawer ── */}
      <AdminDrawer
        isOpen={Boolean(selectedAppointment)}
        onClose={() => setSelectedAppointment(null)}
        title="Appointment Record"
        subtitle={`ID: ${selectedAppointment?.id}`}
        footer={
          <AdminButton variant="secondary" onClick={() => setSelectedAppointment(null)}>
            Close Details
          </AdminButton>
        }
      >
        {selectedAppointment && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Status overview banner */}
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                  Appointment Status
                </span>
                <div style={{ marginTop: '4px' }}>
                  <AdminBadge status={selectedAppointment.status} />
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                  Payment Status
                </span>
                <div style={{ marginTop: '4px' }}>
                  <AdminBadge status={selectedAppointment.paymentStatus} />
                </div>
              </div>
            </div>

            {/* Patient Info */}
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#0f2942', fontWeight: 700 }}>
                Patient Information
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Full Name</span>
                  <span style={{ fontWeight: 600, color: '#0f2942' }}>{selectedAppointment.clientName}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Phone</span>
                  <span>{selectedAppointment.clientPhone}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Email Address</span>
                  <span>{selectedAppointment.clientEmail}</span>
                </div>
              </div>
            </div>

            {/* Treatment Protocol & Clinician */}
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#0f2942', fontWeight: 700 }}>
                Protocol & Schedule
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Service Protocol</span>
                  <span style={{ fontWeight: 600, color: '#1e5aa8' }}>{selectedAppointment.serviceName}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Protocol Fee</span>
                  <span style={{ fontWeight: 700, color: '#15803d' }}>${selectedAppointment.price}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Assigned Clinician</span>
                  <span style={{ fontWeight: 600 }}>{selectedAppointment.providerName}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Duration</span>
                  <span>{selectedAppointment.duration || '60 Mins'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Date</span>
                  <span style={{ fontWeight: 600 }}>{selectedAppointment.date}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Time & Suite</span>
                  <span>{selectedAppointment.time} • {selectedAppointment.room || 'Suite 1'}</span>
                </div>
              </div>
            </div>

            {/* Clinical Notes */}
            <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#0f2942', fontWeight: 700 }}>
                Clinical & Sensory Notes
              </h4>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#475569', lineHeight: 1.5 }}>
                {selectedAppointment.notes || 'No special sensory or medical notes recorded.'}
              </p>
            </div>
          </div>
        )}
      </AdminDrawer>

      {/* ── Edit Appointment Status Modal ── */}
      {editAppointment && (
        <AdminModal
          isOpen={Boolean(editAppointment)}
          onClose={() => setEditAppointment(null)}
          title="Update Appointment Status"
          maxWidth="460px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569' }}>
              Change the status for <strong>{editAppointment.clientName}</strong> ({editAppointment.serviceName}):
            </p>

            <div className="admin-form-group">
              <label className="admin-form-label">Appointment Status</label>
              <select
                className="admin-form-select"
                defaultValue={editAppointment.status}
                id="edit-status-select"
              >
                <option value="Confirmed">Confirmed</option>
                <option value="Completed">Completed</option>
                <option value="Pending">Pending</option>
                <option value="Cancelled">Cancelled</option>
                <option value="No Show">No Show</option>
              </select>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Payment Status</label>
              <select
                className="admin-form-select"
                defaultValue={editAppointment.paymentStatus}
                id="edit-payment-select"
              >
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Refunded">Refunded</option>
                <option value="Failed">Failed</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <AdminButton variant="secondary" onClick={() => setEditAppointment(null)}>
                Cancel
              </AdminButton>
              <AdminButton
                variant="primary"
                onClick={() => {
                  const status = document.getElementById('edit-status-select').value;
                  const paymentStatus = document.getElementById('edit-payment-select').value;
                  handleUpdateStatus(status, paymentStatus);
                }}
              >
                Save Changes
              </AdminButton>
            </div>
          </div>
        </AdminModal>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      <AdminConfirmDialog
        isOpen={Boolean(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDeleteConfirm}
        title="Remove Appointment Record"
        message="Are you sure you want to delete this appointment from clinical records? This action cannot be reversed."
      />
    </div>
  );
};
