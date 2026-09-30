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
        disabled
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

export const SelectValue = ({ placeholder = 'Select an option...' }) => {
  const { value } = useContext(SelectContext);
  return (
    <span className={`shadcn-select-value ${!value ? 'placeholder' : ''}`}>
      {value || placeholder}
    </span>
  );
};

export const SelectContent = ({
  children,
  className = '',
  style = {},
  align = 'start'
}) => {
  const { open } = useContext(SelectContext);

  if (!open) return null;

  return (
    <div
      role="listbox"
      className={`shadcn-select-content ${className}`}
      style={{
        position: 'absolute',
        top: 'calc(100% + 4px)',
        left: align === 'end' ? 'auto' : 0,
        right: align === 'end' ? 0 : 'auto',
        minWidth: '100%',
        zIndex: 999,
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
  className = ''
}) => {
  const { value: selectedValue, onSelect } = useContext(SelectContext);
  const isSelected = selectedValue === value || (selectedValue != null && value != null && String(selectedValue).toLowerCase() === String(value).toLowerCase());

  return (
    <div
      role="option"
      aria-selected={isSelected}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onSelect(value)}
      className={`shadcn-select-item ${isSelected ? 'shadcn-select-item-selected' : ''} ${disabled ? 'disabled' : ''} ${className}`}
    >
      <span className="shadcn-select-item-text">{children}</span>
      {isSelected && (
        <span className="shadcn-select-item-indicator">
          <Check size={14} color="#1e5aa8" />
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
 * Usage:
 *   <ShadcnSelect
 *     value={status}
 *     onChange={setStatus}
 *     options={[
 *       { value: 'ALL', label: 'All Statuses' },
 *       { value: 'Active', label: 'Active' },
 *       { value: 'Inactive', label: 'Inactive' }
 *     ]}
 *   />
 */
export const ShadcnSelect = ({
  value,
  onChange,
  options = [],
  placeholder = 'Select an option...',
  disabled = false,
  className = '',
  triggerStyle = {},
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
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayLabel}
        </span>
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} disabled={Boolean(opt.disabled)}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default ShadcnSelect;
