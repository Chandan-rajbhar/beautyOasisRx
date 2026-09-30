import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';

const DropdownMenuContext = createContext(null);

export const DropdownMenu = ({ children }) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const containerRef = useRef(null);

  // Close on outside click or Escape key
  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (e) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <DropdownMenuContext.Provider
      value={{
        open,
        setOpen,
        triggerRef,
        containerRef
      }}
    >
      <div
        className="shadcn-dropdown-root"
        style={{ position: 'relative', display: 'inline-block' }}
      >
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
};

export const DropdownMenuTrigger = ({
  children,
  asChild = false,
  className = '',
  style = {},
  disabled = false,
  ...props
}) => {
  const { open, setOpen, triggerRef } = useContext(DropdownMenuContext);

  const handleClick = (e) => {
    e.stopPropagation();
    if (!disabled) {
      setOpen((prev) => !prev);
    }
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ref: triggerRef,
      'aria-haspopup': 'menu',
      'aria-expanded': open,
      disabled,
      onClick: (e) => {
        children.props.onClick?.(e);
        handleClick(e);
      },
      className: `${children.props.className || ''} ${className}`.trim(),
      style: { ...children.props.style, ...style }
    });
  }

  return (
    <button
      ref={triggerRef}
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      disabled={disabled}
      onClick={handleClick}
      className={`shadcn-dropdown-trigger ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: 'transparent',
        border: 'none',
        padding: 0,
        ...style
      }}
      {...props}
    >
      {children}
    </button>
  );
};

export const DropdownMenuContent = ({
  children,
  align = 'end',
  className = '',
  style = {},
  width = '180px'
}) => {
  const { open, containerRef } = useContext(DropdownMenuContext);

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      role="menu"
      className={`shadcn-dropdown-content ${className}`}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 'calc(100% + 4px)',
        left: align === 'start' ? 0 : 'auto',
        right: align === 'end' ? 0 : 'auto',
        minWidth: width,
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '6px',
        boxShadow: '0 10px 25px -5px rgba(15, 41, 66, 0.14), 0 8px 10px -6px rgba(15, 41, 66, 0.08)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        animation: 'fadeInMenu 0.15s ease-out',
        ...style
      }}
    >
      {children}
    </div>
  );
};

export const DropdownMenuItem = ({
  children,
  onClick,
  disabled = false,
  variant = 'default', // 'default' | 'danger'
  className = '',
  style = {}
}) => {
  const { setOpen } = useContext(DropdownMenuContext);
  const [hovered, setHovered] = useState(false);

  const handleClick = (e) => {
    e.stopPropagation();
    if (disabled) return;
    setOpen(false);
    if (onClick) onClick(e);
  };

  const isDanger = variant === 'danger';

  return (
    <div
      role="menuitem"
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`shadcn-dropdown-item ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 10px',
        borderRadius: '7px',
        fontSize: '0.84rem',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        color: isDanger
          ? hovered ? '#b91c1c' : '#dc2626'
          : hovered ? '#0f2942' : '#334155',
        backgroundColor: isDanger
          ? hovered ? '#fee2e2' : 'transparent'
          : hovered ? '#f1f5f9' : 'transparent',
        transition: 'all 0.12s ease',
        userSelect: 'none',
        ...style
      }}
    >
      {children}
    </div>
  );
};

export const DropdownMenuSeparator = ({ className = '', style = {} }) => (
  <div
    role="separator"
    className={`shadcn-dropdown-separator ${className}`}
    style={{
      height: '1px',
      backgroundColor: '#f1f5f9',
      margin: '4px 0',
      ...style
    }}
  />
);

export const DropdownMenuLabel = ({ children, className = '', style = {} }) => (
  <div
    className={`shadcn-dropdown-label ${className}`}
    style={{
      fontSize: '0.72rem',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: '#94a3b8',
      padding: '6px 10px 4px',
      userSelect: 'none',
      ...style
    }}
  >
    {children}
  </div>
);

export default DropdownMenu;
