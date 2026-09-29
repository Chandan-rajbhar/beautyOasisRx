import React from 'react';
import { Sparkles } from 'lucide-react';
import { AdminButton } from './AdminButton';

export const AdminEmptyState = ({
  icon = <Sparkles size={30} />,
  title = "No records found",
  description = "There are currently no items matching your criteria or none have been created yet.",
  actionLabel = null,
  onAction = null
}) => {
  return (
    <div className="admin-empty-state">
      <div className="admin-empty-icon">
        {icon}
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {actionLabel && onAction && (
        <AdminButton variant="primary" onClick={onAction}>
          {actionLabel}
        </AdminButton>
      )}
    </div>
  );
};
