import React, { useState } from 'react';
import { LogOut, Loader2 } from 'lucide-react';
import { AdminModal } from './AdminModal';

export const AdminLogoutDialog = ({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
}) => {
  const [cancelHover, setCancelHover] = useState(false);
  const [logoutHover, setLogoutHover] = useState(false);

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Logout"
      maxWidth="460px"
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', width: '100%' }}>
          {/* Cancel Button */}
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            onMouseEnter={() => setCancelHover(true)}
            onMouseLeave={() => setCancelHover(false)}
            style={{
              padding: '10px 22px',
              fontSize: '0.875rem',
              fontWeight: 600,
              borderRadius: '10px',
              border: '1px solid',
              borderColor: cancelHover ? '#94a3b8' : '#cbd5e1',
              background: cancelHover ? '#f1f5f9' : '#ffffff',
              color: cancelHover ? '#0f172a' : '#334155',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'all 0.15s ease',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>

          {/* Logout Button */}
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            onMouseEnter={() => setLogoutHover(true)}
            onMouseLeave={() => setLogoutHover(false)}
            style={{
              padding: '10px 24px',
              fontSize: '0.875rem',
              fontWeight: 600,
              borderRadius: '10px',
              border: 'none',
              background: logoutHover ? '#b91c1c' : '#dc2626',
              color: '#ffffff',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.15s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: logoutHover
                ? '0 6px 16px rgba(220, 38, 38, 0.35)'
                : '0 2px 6px rgba(220, 38, 38, 0.22)',
              fontFamily: 'inherit',
            }}
          >
            {loading ? (
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <LogOut size={16} />
            )}
            <span>{loading ? 'Logging out...' : 'Logout'}</span>
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', padding: '4px 0' }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: '#fee2e2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 0 0 4px #fee2e2, 0 4px 12px rgba(220, 38, 38, 0.08)',
          }}
        >
          <LogOut size={22} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: '0.98rem', color: '#0f2942', fontWeight: 600, lineHeight: 1.4 }}>
            Are you sure you want to logout?
          </p>
          <p style={{ margin: '6px 0 0', fontSize: '0.84rem', color: '#64748b', lineHeight: 1.5 }}>
            Your current administrative session will be ended. You will need to sign in again to access the dashboard.
          </p>
        </div>
      </div>
    </AdminModal>
  );
};
