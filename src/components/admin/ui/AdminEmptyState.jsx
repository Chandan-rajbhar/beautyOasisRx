import React from 'react';
import { Sparkles } from 'lucide-react';
import { AdminButton } from './AdminButton';

export const AdminEmptyState = ({
  icon = <Sparkles size={30} />,
  title = "No records found",
  description = "There are currently no items matching your criteria or none have been created yet.",
  actionLabel = null,
  onAction = null,
  action = null
}) => {
  const renderIcon = () => {
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === 'function') {
      const IconComponent = icon;
      return <IconComponent size={30} />;
    }
    return <Sparkles size={30} />;
  };

  return (
    <div className="admin-empty-state">
      <div className="admin-empty-icon">
        {renderIcon()}
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? (
        action
      ) : actionLabel && onAction ? (
        <AdminButton variant="primary" onClick={onAction}>
          {actionLabel}
        </AdminButton>
      ) : null}
    </div>
  );
};
