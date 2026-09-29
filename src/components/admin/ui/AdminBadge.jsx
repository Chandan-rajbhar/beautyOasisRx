import React from 'react';

export const AdminBadge = ({ status, className = "" }) => {
  if (!status) return null;

  const normalized = String(status).toLowerCase().replace(/\s+/g, '-');

  const getStyleClass = () => {
    switch (normalized) {
      case 'confirmed':
      case 'completed':
      case 'active':
      case 'paid':
      case 'in-stock':
        return 'admin-badge-confirmed';

      case 'pending':
      case 'processing':
      case 'read':
        return 'admin-badge-pending';

      case 'cancelled':
      case 'failed':
      case 'no-show':
      case 'out-of-stock':
        return 'admin-badge-cancelled';

      case 'inactive':
        return 'admin-badge-inactive';

      case 'refunded':
      case 'archived':
      case 'on-leave':
        return 'admin-badge-refunded';

      case 'new':
        return 'admin-badge-new';

      case 'super-admin':
        return 'admin-badge-super-admin';

      default:
        return 'admin-badge-pending';
    }
  };

  return (
    <span className={`admin-badge ${getStyleClass()} ${className}`}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor', opacity: 0.8 }} />
      {status}
    </span>
  );
};
