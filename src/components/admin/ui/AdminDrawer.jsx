import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export const AdminDrawer = ({
  isOpen,
  onClose,
  title,
  subtitle = null,
  children,
  footer = null,
  width = '540px'
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="admin-drawer-overlay" onClick={onClose}>
      <div
        className="admin-drawer-content"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-drawer-header">
          <div>
            <h3 style={{ fontFamily: 'var(--font-serif-display)', fontSize: '1.3rem', color: '#0f2942', margin: 0 }}>
              {title}
            </h3>
            {subtitle && (
              <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              color: '#64748b',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="admin-drawer-body">
          {children}
        </div>

        {footer && (
          <div className="admin-drawer-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
