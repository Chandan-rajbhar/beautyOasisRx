import React, { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { AdminModal } from './AdminModal';

export const AdminConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Delete Patient Record",
  message = "Are you sure you want to delete this patient profile? All chart notes and history links will be unlinked.",
  confirmText = "Delete",
  confirmVariant = "danger",
  loading = false
}) => {
  const [cancelHover, setCancelHover] = useState(false);
  const [deleteHover, setDeleteHover] = useState(false);

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="500px"
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
              transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: cancelHover
                ? '0 2px 6px rgba(0, 0, 0, 0.08)'
                : '0 1px 2px rgba(0, 0, 0, 0.04)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'inherit'
            }}
          >
            Cancel
          </button>

          {/* Delete Button */}
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            onMouseEnter={() => setDeleteHover(true)}
            onMouseLeave={() => setDeleteHover(false)}
            style={{
              padding: '10px 24px',
              fontSize: '0.875rem',
              fontWeight: 600,
              borderRadius: '10px',
              border: '1px solid',
              borderColor: deleteHover ? '#b91c1c' : '#dc2626',
              background: deleteHover ? '#b91c1c' : '#dc2626',
              color: '#ffffff',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: deleteHover && !loading ? 'translateY(-1px)' : 'translateY(0)',
              boxShadow: deleteHover && !loading
                ? '0 6px 16px rgba(220, 38, 38, 0.38)'
                : '0 2px 6px rgba(220, 38, 38, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontFamily: 'inherit'
            }}
          >
            {loading ? (
              <span
                style={{
                  width: '14px',
                  height: '14px',
                  border: '2px solid #ffffff',
                  borderRightColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite'
                }}
              />
            ) : (
              <Trash2 size={15} />
            )}
            <span>{loading ? 'Deleting...' : confirmText}</span>
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', gap: '18px', alignItems: 'flex-start' }}>
        {/* Warning Icon Badge with layered subtle outer ring */}
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: confirmVariant === 'danger' ? '#fef2f2' : '#fef3c7',
            border: `1px solid ${confirmVariant === 'danger' ? '#fecaca' : '#fde68a'}`,
            boxShadow: confirmVariant === 'danger'
              ? '0 0 0 4px #fee2e2, 0 4px 12px rgba(220, 38, 38, 0.08)'
              : '0 0 0 4px #fef3c7, 0 4px 12px rgba(180, 83, 9, 0.08)',
            color: confirmVariant === 'danger' ? '#dc2626' : '#b45309',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <AlertTriangle size={24} />
        </div>

        {/* Message and Permanent Warning Callout */}
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: '0.94rem', color: '#1e293b', lineHeight: 1.55, fontWeight: 500 }}>
            {message}
          </p>

          <div
            style={{
              marginTop: '14px',
              padding: '10px 14px',
              background: '#fff8f8',
              border: '1px solid #fee2e2',
              borderRadius: '8px',
              fontSize: '0.8rem',
              color: '#b91c1c',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 500
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#dc2626', flexShrink: 0 }} />
            <span>This action is permanent and cannot be undone.</span>
          </div>
        </div>
      </div>
    </AdminModal>
  );
};
