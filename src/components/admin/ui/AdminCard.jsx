import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export const AdminCard = ({
  title,
  value,
  subtitle,
  icon,
  iconBg = '#f0f7ff',
  iconColor = '#1e5aa8',
  trend = null, // e.g. { value: "+14.2%", isPositive: true, text: "vs last month" }
  onClick,
  style = {},
  valueStyle = {},
  children
}) => {
  return (
    <div
      className="admin-card"
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        ...style
      }}
    >
      <div className="admin-card-header">
        <span className="admin-card-title">{title}</span>
        {icon && (
          <div
            className="admin-card-icon-wrap"
            style={{ backgroundColor: iconBg, color: iconColor }}
          >
            {icon}
          </div>
        )}
      </div>

      {value !== undefined && value !== null && (
        <div className="admin-card-value" style={valueStyle}>{value}</div>
      )}

      {children}

      <div className="admin-card-meta">
        {trend && (
          <span className={trend.isPositive ? 'admin-trend-up' : 'admin-trend-down'}>
            {trend.isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {trend.value}
          </span>
        )}
        <span>{trend ? trend.text : subtitle}</span>
      </div>
    </div>
  );
};
