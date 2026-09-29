import React from 'react';

export const AdminButton = ({
  children,
  variant = 'primary', // primary, secondary, danger, ghost, outline, success
  size = 'md', // sm, md, lg
  icon = null,
  iconPosition = 'left',
  onClick,
  type = 'button',
  disabled = false,
  className = '',
  style = {},
  fullWidth = false,
  loading = false,
  form,
  ...rest
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          background: isHovered
            ? 'linear-gradient(135deg, #164684 0%, #15803d 100%)'
            : 'linear-gradient(135deg, #1e5aa8 0%, #16a34a 100%)',
          color: '#ffffff',
          border: 'none',
          boxShadow: isHovered
            ? '0 4px 14px rgba(30, 90, 168, 0.35)'
            : '0 2px 10px rgba(30, 90, 168, 0.25)',
          transform: isHovered && !disabled && !loading ? 'translateY(-1px)' : 'translateY(0)'
        };
      case 'secondary':
        return {
          background: isHovered ? '#f1f5f9' : '#ffffff',
          color: isHovered ? '#0f172a' : '#334155',
          border: '1px solid',
          borderColor: isHovered ? '#94a3b8' : '#cbd5e1',
          boxShadow: isHovered ? '0 2px 6px rgba(0, 0, 0, 0.08)' : '0 1px 2px rgba(0, 0, 0, 0.04)'
        };
      case 'danger':
        return {
          background: isHovered ? '#b91c1c' : '#dc2626',
          color: '#ffffff',
          border: '1px solid',
          borderColor: isHovered ? '#b91c1c' : '#dc2626',
          boxShadow: isHovered && !disabled && !loading
            ? '0 6px 16px rgba(220, 38, 38, 0.38)'
            : '0 2px 6px rgba(220, 38, 38, 0.25)',
          transform: isHovered && !disabled && !loading ? 'translateY(-1px)' : 'translateY(0)'
        };
      case 'danger-soft':
        return {
          background: isHovered ? '#fecaca' : '#fee2e2',
          color: isHovered ? '#991b1b' : '#b91c1c',
          border: '1px solid',
          borderColor: isHovered ? '#f87171' : '#fca5a5'
        };
      case 'success':
        return {
          background: isHovered ? '#bbf7d0' : '#dcfce7',
          color: '#15803d',
          border: '1px solid',
          borderColor: isHovered ? '#4ade80' : '#86efac'
        };
      case 'outline':
        return {
          background: isHovered ? 'rgba(30, 90, 168, 0.06)' : 'transparent',
          color: '#1e5aa8',
          border: '1.5px solid #1e5aa8'
        };
      case 'ghost':
        return {
          background: isHovered ? '#f1f5f9' : 'transparent',
          color: isHovered ? '#0f2942' : '#475569',
          border: 'none'
        };
      default:
        return {};
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return { padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px' };
      case 'md':
        return { padding: '9px 18px', fontSize: '0.875rem', borderRadius: '10px' };
      case 'lg':
        return { padding: '12px 24px', fontSize: '0.95rem', borderRadius: '12px' };
      default:
        return { padding: '9px 18px', fontSize: '0.875rem', borderRadius: '10px' };
    }
  };

  return (
    <button
      type={type}
      form={form}
      onClick={onClick}
      disabled={disabled || loading}
      onMouseEnter={(e) => {
        if (!disabled && !loading) setIsHovered(true);
        if (rest.onMouseEnter) rest.onMouseEnter(e);
      }}
      onMouseLeave={(e) => {
        setIsHovered(false);
        if (rest.onMouseLeave) rest.onMouseLeave(e);
      }}
      className={`admin-btn ${className}`}
      {...rest}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontWeight: 600,
        fontFamily: 'var(--font-sans)',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.6 : 1,
        transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
        width: fullWidth ? '100%' : 'auto',
        ...getVariantStyles(),
        ...getSizeStyles(),
        ...style
      }}
    >
      {loading ? (
        <span
          style={{
            width: '14px',
            height: '14px',
            border: '2px solid currentColor',
            borderRightColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite'
          }}
        />
      ) : (
        icon && iconPosition === 'left' && <span style={{ display: 'flex' }}>{icon}</span>
      )}
      <span>{children}</span>
      {!loading && icon && iconPosition === 'right' && <span style={{ display: 'flex' }}>{icon}</span>}
    </button>
  );
};
