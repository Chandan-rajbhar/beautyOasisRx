import React from 'react';
import { Search, X } from 'lucide-react';
import { AdminButton } from './AdminButton';
import { ShadcnSelect } from '../../ui/select';

export const AdminToolbar = ({
  searchTerm,
  onSearchChange,
  searchPlaceholder = "Search by keyword...",
  minLength = 2,
  maxLength = 50,
  filters = [], // array of { id, label, value, options: [{ label, value }], onChange }
  onClearFilters = null,
  hasActiveFilters = false,
  extraActions = null
}) => {
  const inputRef = React.useRef(null);

  const handleClear = () => {
    onSearchChange('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="admin-toolbar">
      {onSearchChange && (
        <div className="admin-search-box">
          <Search size={16} color="#64748b" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            className="admin-search-input"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => {
              const val = e.target.value;
              if (val.length <= maxLength) {
                onSearchChange(val);
              }
            }}
            minLength={minLength}
            maxLength={maxLength}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            aria-autocomplete="none"
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
            name="patient_search_query"
          />

          {/* Helper when typing under minimum length */}
          {searchTerm && searchTerm.trim().length > 0 && searchTerm.trim().length < minLength && (
            <span
              style={{
                fontSize: '0.72rem',
                color: '#94a3b8',
                whiteSpace: 'nowrap',
                userSelect: 'none',
                background: '#f1f5f9',
                padding: '2px 6px',
                borderRadius: '4px',
                flexShrink: 0
              }}
            >
              min {minLength} chars
            </span>
          )}

          {searchTerm && (
            <button
              type="button"
              onClick={handleClear}
              title="Clear search"
              aria-label="Clear search"
              className="admin-search-clear-btn"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      <div className="admin-filter-group">
        {filters.map((filter) => (
          <div key={filter.id} style={{ minWidth: '160px' }}>
            <ShadcnSelect
              value={filter.value}
              onChange={(val) => filter.onChange(val)}
              options={filter.options}
              placeholder="All Statuses"
            />
          </div>
        ))}

        {hasActiveFilters && onClearFilters && (
          <AdminButton
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            icon={<X size={14} />}
          >
            Clear Filters
          </AdminButton>
        )}

        {extraActions}
      </div>
    </div>
  );
};
