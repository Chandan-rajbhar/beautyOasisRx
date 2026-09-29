import React, { useState } from 'react';
import {
  Settings,
  Save,
  Check,
  RotateCcw,
  Database,
  Bell,
  Lock,
  DollarSign,
  Building,
  AlertTriangle
} from 'lucide-react';
import { useAdminData } from '../../context/AdminDataContext';
import { AdminButton } from '../../components/admin/ui/AdminButton';
import { AdminModal } from '../../components/admin/ui/AdminModal';

export const SettingsPage = () => {
  const { settings, updateItem, resetToFactoryData } = useAdminData();

  const [activeTab, setActiveTab] = useState('general'); // 'general', 'booking', 'firebase', 'notifications'
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // Local settings state
  const [formData, setFormData] = useState(settings || {
    clinicName: "BeautyOasisRx — Clinical Aesthetics & Bespoke Wellness",
    location: "Allen, Texas",
    timezone: "Central Time (US & Canada) - CT",
    currency: "USD ($)",
    taxRate: 8.25,
    depositRequired: true,
    depositAmount: 50,
    cancellationWindowHours: 24,
    autoConfirmAppointments: false,
    emailNotificationsEnabled: true,
    smsNotificationsEnabled: true,
    allowOnlineReschedule: true,
    firebaseConfig: {
      apiKey: "",
      authDomain: "",
      projectId: "beautyoasisrx-clinical",
      storageBucket: "",
      messagingSenderId: "",
      appId: ""
    }
  });

  const handleSave = () => {
    updateItem('settings', 'settings', formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleResetData = () => {
    resetToFactoryData();
    setResetConfirmOpen(false);
    alert("All mock & live collections successfully reset to clean factory clinical records.");
  };

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Clinic Settings & Integrations</h1>
          <p>Configure practice booking policies, financial parameters, notification rules, and database sync.</p>
        </div>

        <div className="admin-page-actions">
          <AdminButton
            variant="secondary"
            onClick={() => setResetConfirmOpen(true)}
            icon={<RotateCcw size={16} />}
          >
            Reset Practice Data
          </AdminButton>

          <AdminButton
            variant="primary"
            onClick={handleSave}
            icon={saveSuccess ? <Check size={16} /> : <Save size={16} />}
          >
            {saveSuccess ? 'Settings Saved!' : 'Save Practice Settings'}
          </AdminButton>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { id: 'general', label: 'Practice Identity & Region' },
          { id: 'booking', label: 'Clinical Booking & Deposits' },
          { id: 'firebase', label: 'Firestore / Cloud Database' },
          { id: 'notifications', label: 'Staff & Patient Alerts' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 18px',
              fontSize: '0.88rem',
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? '#1e5aa8' : '#64748b',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #1e5aa8' : '2px solid transparent',
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: General */}
      {activeTab === 'general' && (
        <div className="admin-card" style={{ maxWidth: '800px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', color: '#0f2942' }}>
            Practice Identity
          </h3>

          <div className="admin-form-group">
            <label className="admin-form-label">Practice Title</label>
            <input
              type="text"
              className="admin-form-input"
              value={formData.clinicName}
              onChange={(e) => setFormData({ ...formData, clinicName: e.target.value })}
            />
          </div>

          <div className="admin-form-grid-2">
            <div className="admin-form-group">
              <label className="admin-form-label">Primary Clinic City / State</label>
              <input
                type="text"
                className="admin-form-input"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Operating Timezone</label>
              <select
                className="admin-form-select"
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              >
                <option value="Central Time (US & Canada) - CT">Central Time (US & Canada) - CT</option>
                <option value="Eastern Time (US & Canada) - ET">Eastern Time (US & Canada) - ET</option>
                <option value="Pacific Time (US & Canada) - PT">Pacific Time (US & Canada) - PT</option>
              </select>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Default Billing Currency</label>
              <input
                type="text"
                className="admin-form-input"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Local Sales / Service Tax Rate (%)</label>
              <input
                type="number"
                step="0.01"
                className="admin-form-input"
                value={formData.taxRate}
                onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab: Booking & Policies */}
      {activeTab === 'booking' && (
        <div className="admin-card" style={{ maxWidth: '800px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', color: '#0f2942' }}>
            Appointment Booking & Cancellation Policies
          </h3>

          <div className="admin-form-grid-2">
            <div className="admin-form-group">
              <label className="admin-form-label">Consultation Deposit Required?</label>
              <select
                className="admin-form-select"
                value={formData.depositRequired ? 'yes' : 'no'}
                onChange={(e) => setFormData({ ...formData, depositRequired: e.target.value === 'yes' })}
              >
                <option value="yes">Yes (Hold $50 Deposit on Reservation)</option>
                <option value="no">No (Zero Deposit Required)</option>
              </select>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Deposit Amount ($ USD)</label>
              <input
                type="number"
                className="admin-form-input"
                value={formData.depositAmount}
                onChange={(e) => setFormData({ ...formData, depositAmount: Number(e.target.value) })}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Cancellation Window Policy</label>
              <select
                className="admin-form-select"
                value={formData.cancellationWindowHours}
                onChange={(e) => setFormData({ ...formData, cancellationWindowHours: Number(e.target.value) })}
              >
                <option value={24}>24 Hours Notice Required</option>
                <option value={48}>48 Hours Notice Required</option>
                <option value={72}>72 Hours Notice Required</option>
              </select>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Automatic Appointment Confirmation</label>
              <select
                className="admin-form-select"
                value={formData.autoConfirmAppointments ? 'yes' : 'no'}
                onChange={(e) => setFormData({ ...formData, autoConfirmAppointments: e.target.value === 'yes' })}
              >
                <option value="no">Manual Clinical Review (Staff Confirms)</option>
                <option value="yes">Instant Auto-Confirmation</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Firestore / Firebase Configuration */}
      {activeTab === 'firebase' && (
        <div className="admin-card" style={{ maxWidth: '800px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Database size={20} color="#1e5aa8" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f2942' }}>
              Firestore / Cloud Database Integration
            </h3>
          </div>

          <div style={{ padding: '14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '12px', marginBottom: '20px', fontSize: '0.84rem', color: '#15803d', lineHeight: 1.5 }}>
            <strong>Active Clinical Storage Engine:</strong> Reactive Local Persistence is currently active and storing all appointments, patients, services, orders, and inquiries securely in browser storage. Plug in your Firebase credentials below to enable cloud live synchronization.
          </div>

          <div className="admin-form-grid-2">
            <div className="admin-form-group">
              <label className="admin-form-label">Firebase Project ID</label>
              <input
                type="text"
                className="admin-form-input"
                placeholder="beautyoasisrx-clinical"
                value={formData.firebaseConfig?.projectId || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    firebaseConfig: { ...formData.firebaseConfig, projectId: e.target.value }
                  })
                }
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Firebase API Key</label>
              <input
                type="password"
                className="admin-form-input"
                placeholder="AIzaSy..."
                value={formData.firebaseConfig?.apiKey || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    firebaseConfig: { ...formData.firebaseConfig, apiKey: e.target.value }
                  })
                }
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Auth Domain</label>
              <input
                type="text"
                className="admin-form-input"
                placeholder="beautyoasisrx-clinical.firebaseapp.com"
                value={formData.firebaseConfig?.authDomain || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    firebaseConfig: { ...formData.firebaseConfig, authDomain: e.target.value }
                  })
                }
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Storage Bucket</label>
              <input
                type="text"
                className="admin-form-input"
                placeholder="beautyoasisrx-clinical.appspot.com"
                value={formData.firebaseConfig?.storageBucket || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    firebaseConfig: { ...formData.firebaseConfig, storageBucket: e.target.value }
                  })
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab: Notifications */}
      {activeTab === 'notifications' && (
        <div className="admin-card" style={{ maxWidth: '800px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', color: '#0f2942' }}>
            Automated Staff & Patient Dispatch
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.emailNotificationsEnabled}
                onChange={(e) => setFormData({ ...formData, emailNotificationsEnabled: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Automated Clinical Email Confirmations</div>
                <div style={{ fontSize: '0.76rem', color: '#64748b' }}>Dispatch appointment confirmations and calendar invites to clients.</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.smsNotificationsEnabled}
                onChange={(e) => setFormData({ ...formData, smsNotificationsEnabled: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>SMS 24-Hour Appointment Reminders</div>
                <div style={{ fontSize: '0.76rem', color: '#64748b' }}>Send automated SMS reminders to patients prior to procedure day.</div>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      <AdminModal
        isOpen={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        title="Reset All Clinical Practice Data"
        maxWidth="480px"
      >
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fee2e2', color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.88rem', color: '#334155', lineHeight: 1.5 }}>
              This will reset all appointments, patients, services, products, and inquiries back to the rich BeautyOasisRx clinical seed data. Are you sure?
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <AdminButton variant="secondary" onClick={() => setResetConfirmOpen(false)}>
            Cancel
          </AdminButton>
          <AdminButton variant="danger" onClick={handleResetData}>
            Reset Data Now
          </AdminButton>
        </div>
      </AdminModal>
    </div>
  );
};
