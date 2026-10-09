import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check } from 'lucide-react';

const SelectContext = createContext(null);

export const Select = ({
  value,
  onValueChange,
  defaultValue,
  children,
  disabled = false
}) => {
  const [open, setOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value !== undefined ? value : defaultValue ?? '');
  const containerRef = useRef(null);

  useEffect(() => {
    if (value !== undefined) {
      setSelectedValue(value);
    }
  }, [value]);

  // Click outside to close
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    if (open) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleSelect = useCallback((val) => {
    setSelectedValue(val);
    if (onValueChange) {
      onValueChange(val);
    }
    setOpen(false);
  }, [onValueChange]);

  return (
    <SelectContext.Provider
      value={{
        value: selectedValue,
        onSelect: handleSelect,
        open,
        setOpen,
        disabled,
        containerRef
      }}
    >
      <div
        className="shadcn-select-root"
        ref={containerRef}
        style={{ position: 'relative', width: '100%' }}
      >
        {children}
      </div>
    </SelectContext.Provider>
  );
};

export const SelectTrigger = ({
  children,
  className = '',
  style = {},
  id,
  ariaLabel
}) => {
  const { open, setOpen, disabled } = useContext(SelectContext);

  return (
    <button
      type="button"
      id={id}
      aria-label={ariaLabel}
      aria-haspopup="listbox"
      aria-expanded={open}
      disabled={disabled}
      onClick={() => !disabled && setOpen((prev) => !prev)}
      className={`shadcn-select-trigger ${open ? 'shadcn-select-trigger-open' : ''} ${className}`}
      style={style}
    >
      <span className="shadcn-select-trigger-content">{children}</span>
      <ChevronDown
        size={15}
        className={`shadcn-select-chevron ${open ? 'rotate-180' : ''}`}
        style={{
          transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          color: '#64748b',
          flexShrink: 0
        }}
      />
    </button>
  );
};

export const SelectValue = ({ placeholder = 'Select an option...', children }) => {
  const { value } = useContext(SelectContext);
  const display = children !== undefined && children !== null && children !== '' ? children : (value || placeholder);
  const isPlaceholder = !value && (children === undefined || children === null || children === '');
  return (
    <span className={`shadcn-select-value ${isPlaceholder ? 'placeholder' : ''}`}>
      {display}
    </span>
  );
};

export const SelectContent = ({
  children,
  className = '',
  style = {},
  align = 'start',
  side = 'auto' // 'auto' | 'bottom' | 'top'
}) => {
  const { open, containerRef } = useContext(SelectContext);
  const [openAbove, setOpenAbove] = useState(false);

  useEffect(() => {
    if (open && containerRef?.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      if (side === 'top' || (side === 'auto' && spaceBelow < 190 && rect.top > 190)) {
        setOpenAbove(true);
      } else {
        setOpenAbove(false);
      }
    }
  }, [open, containerRef, side]);

  if (!open) return null;

  return (
    <div
      role="listbox"
      className={`shadcn-select-content ${className}`}
      style={{
        position: 'absolute',
        top: openAbove ? 'auto' : 'calc(100% + 4px)',
        bottom: openAbove ? 'calc(100% + 4px)' : 'auto',
        left: align === 'end' ? 'auto' : 0,
        right: align === 'end' ? 0 : 'auto',
        minWidth: '100%',
        zIndex: 99999,
        boxShadow: '0 10px 25px -3px rgba(15, 41, 66, 0.16), 0 4px 6px -4px rgba(15, 41, 66, 0.08)',
        ...style
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="shadcn-select-viewport">
        {children}
      </div>
    </div>
  );
};

export const SelectItem = ({
  value,
  children,
  disabled = false,
  className = '',
  style = {},
  indicatorColor
}) => {
  const { value: selectedValue, onSelect } = useContext(SelectContext);
  const isSelected = selectedValue === value || (selectedValue != null && value != null && String(selectedValue).toLowerCase() === String(value).toLowerCase());

  return (
    <div
      role="option"
      aria-selected={isSelected}
      tabIndex={disabled ? -1 : 0}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onSelect(value);
      }}
      className={`shadcn-select-item ${isSelected ? 'shadcn-select-item-selected' : ''} ${disabled ? 'disabled' : ''} ${className}`}
      style={{
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...style
      }}
    >
      <span className="shadcn-select-item-text" style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        {children}
      </span>
      {isSelected && (
        <span className="shadcn-select-item-indicator" style={{ flexShrink: 0, marginLeft: '8px' }}>
          <Check size={14} color={indicatorColor || '#1e5aa8'} />
        </span>
      )}
    </div>
  );
};

export const SelectLabel = ({ children, className = '' }) => (
  <div className={`shadcn-select-label ${className}`}>
    {children}
  </div>
);

export const SelectSeparator = ({ className = '' }) => (
  <div className={`shadcn-select-separator ${className}`} />
);

/**
 * ShadcnSelect — Convenient drop-in component matching standard select props.
 */
export const ShadcnSelect = ({
  value,
  onChange,
  options = [],
  placeholder = 'Select an option...',
  disabled = false,
  className = '',
  triggerStyle = {},
  contentStyle = {},
  side = 'auto',
  align = 'start',
  id = null
}) => {
  // Find currently selected label
  const selectedOption = options.find((opt) => opt.value === value || (opt.value != null && value != null && String(opt.value).toLowerCase() === String(value).toLowerCase()));
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  return (
    <Select
      value={selectedOption ? selectedOption.value : value}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className} style={triggerStyle}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {selectedOption?.imageUrl && (
            <img
              src={selectedOption.imageUrl}
              alt=""
              aria-hidden="true"
              style={{ width: '28px', height: '28px', borderRadius: '5px', objectFit: 'cover', flexShrink: 0 }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          {selectedOption?.dotColor && (
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: selectedOption.dotColor,
                flexShrink: 0
              }}
            />
          )}
          <span>{displayLabel}</span>
        </span>
      </SelectTrigger>
      <SelectContent side={side} align={align} style={contentStyle}>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} disabled={Boolean(opt.disabled)}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              {opt.imageUrl && (
                <img
                  src={opt.imageUrl}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  style={{ width: '36px', height: '36px', borderRadius: '5px', objectFit: 'cover', flexShrink: 0 }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              )}
              {opt.dotColor && (
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: opt.dotColor,
                    flexShrink: 0
                  }}
                />
              )}
              <span>{opt.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default ShadcnSelect;
