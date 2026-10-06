import React, { useState, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, ArrowUpDown, AlertCircle, RefreshCw } from 'lucide-react';
import { AdminEmptyState } from './AdminEmptyState';
import { TableSkeleton } from './AdminLoaders';

export const AdminTable = ({
  columns,
  data,
  loading = false,
  showLoadingBar = false,
  showSkeleton = false,
  loadingMessage = 'Loading data...',
  error = null,
  onRetry = null,
  itemsPerPage = 10,
  emptyIcon = null,
  emptyTitle = "No records found",
  emptyDescription = "There are no entries currently available.",
  emptyActionLabel = null,
  onEmptyAction = null,
  keyField = "id",
  itemLabel = "results",
  currentPage: externalPage,
  onPageChange: externalOnPageChange,
  className = "",
  onRowClick = null,
  renderMobileCard = null
}) => {
  const [internalPage, setInternalPage] = useState(1);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
  const hasLoadedOnce = useRef((!loading && !error) || data.length > 0);

  if (!loading && !error) hasLoadedOnce.current = true;
  const showInitialLoading = loading && !hasLoadedOnce.current;

  const currentPage = externalPage !== undefined ? externalPage : internalPage;
  const setCurrentPage = (newPage) => {
    if (externalOnPageChange) {
      externalOnPageChange(newPage);
    } else {
      setInternalPage(newPage);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortField) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (typeof aVal === 'string') {
        const res = aVal.localeCompare(String(bVal));
        return sortDirection === 'asc' ? res : -res;
      }
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [data, sortField, sortDirection]);

  // Pagination logic
  const totalPages = Math.ceil(sortedData.length / itemsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(start, start + itemsPerPage);
  }, [sortedData, currentPage, itemsPerPage]);

  return (
    <div className={`admin-table-container ${className}`.trim()}>
      {showInitialLoading && showLoadingBar && <div className="admin-table-loading-bar" />}
      <div className={`admin-table-scroll ${renderMobileCard ? 'admin-table-desktop-only' : ''}`}>
        <table className="admin-table">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  style={{
                    width: col.width || 'auto',
                    minWidth: col.minWidth || 'auto',
                    textAlign: col.align || 'left',
                    cursor: col.sortable ? 'pointer' : 'default'
                  }}
                  onClick={() => col.sortable && col.accessor && handleSort(col.accessor)}
                >
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start',
                      width: col.align === 'right' ? '100%' : 'auto'
                    }}
                  >
                    <span>{col.header}</span>
                    {col.sortable && <ArrowUpDown size={12} color="#94a3b8" />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {showInitialLoading ? (
              showSkeleton ? (
                <TableSkeleton columns={columns} rows={Math.min(itemsPerPage, 6)} />
              ) : loadingMessage ? (
                <tr>
                  <td colSpan={columns.length} style={{ padding: '28px 24px', textAlign: 'center' }}>
                    <span className="admin-table-loading-status" role="status" aria-live="polite">
                      <RefreshCw size={16} aria-hidden="true" />
                      <span>{loadingMessage}</span>
                    </span>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={columns.length} style={{ height: '80px', border: 'none' }} />
                </tr>
              )
            ) : error ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <div style={{ maxWidth: '460px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '50%',
                        background: '#fee2e2',
                        color: '#dc2626',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <AlertCircle size={22} />
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.96rem', color: '#0f2942' }}>
                      Unable to Load Data
                    </div>
                    <div style={{ fontSize: '0.84rem', color: '#64748b', lineHeight: 1.5 }}>
                      {typeof error === 'string' ? error : 'An error occurred while communicating with Supabase.'}
                    </div>
                    {onRetry && (
                      <button
                        onClick={onRetry}
                        style={{
                          marginTop: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 16px',
                          borderRadius: '8px',
                          background: '#1e5aa8',
                          color: '#ffffff',
                          border: 'none',
                          fontWeight: 600,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          transition: 'opacity 0.2s'
                        }}
                      >
                        <RefreshCw size={13} />
                        Retry Connection
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : paginatedData.length > 0 ? (
              paginatedData.map((row, rIdx) => (
                <tr
                  key={row[keyField] || rIdx}
                  onClick={onRowClick ? (e) => {
                    if (
                      e.target.closest('button') ||
                      e.target.closest('a') ||
                      e.target.closest('input') ||
                      e.target.closest('select') ||
                      e.target.closest('.patient-action-menu-container') ||
                      e.target.closest('.patient-action-dropdown-menu')
                    ) {
                      return;
                    }
                    onRowClick(row);
                  } : undefined}
                  style={onRowClick ? { cursor: 'pointer' } : undefined}
                >
                  {columns.map((col, cIdx) => (
                    <td
                      key={cIdx}
                      style={{
                        textAlign: col.align || 'left',
                        whiteSpace: col.noWrap ? 'nowrap' : 'normal'
                      }}
                    >
                      {col.render
                        ? col.render(row, rIdx, paginatedData.length)
                        : col.accessor
                        ? row[col.accessor]
                        : null}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} style={{ padding: '0' }}>
                  <AdminEmptyState
                    icon={emptyIcon || undefined}
                    title={emptyTitle}
                    description={emptyDescription}
                    actionLabel={emptyActionLabel}
                    onAction={onEmptyAction}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Responsive Mobile Cards View (only if renderMobileCard is passed) */}
      {renderMobileCard && (
        <div className="admin-table-mobile-only">
          {showInitialLoading ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b' }}>
              <span className="admin-table-loading-status" role="status" aria-live="polite">
                <RefreshCw size={16} aria-hidden="true" className="animate-spin" />
                <span>{loadingMessage}</span>
              </span>
            </div>
          ) : error ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <div style={{ maxWidth: '460px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertCircle size={20} />
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#0f2942' }}>Unable to Load Data</div>
                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                  {typeof error === 'string' ? error : 'An error occurred while communicating with Supabase.'}
                </div>
                {onRetry && (
                  <button onClick={onRetry} style={{ padding: '6px 14px', borderRadius: '8px', background: '#1e5aa8', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
                    Retry Connection
                  </button>
                )}
              </div>
            </div>
          ) : paginatedData.length > 0 ? (
            <div className="admin-table-cards-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px' }}>
              {paginatedData.map((row, rIdx) => (
                <div key={row[keyField] || rIdx} className="admin-table-card-item">
                  {renderMobileCard(row, rIdx, paginatedData.length)}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '16px' }}>
              <AdminEmptyState
                icon={emptyIcon || undefined}
                title={emptyTitle}
                description={emptyDescription}
                actionLabel={emptyActionLabel}
                onAction={onEmptyAction}
              />
            </div>
          )}
        </div>
      )}

      {/* Pagination Footer */}
      {!showInitialLoading && sortedData.length > 0 && (
        <div className="admin-pagination">
          <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
            Showing <strong style={{ color: '#0f2942', fontWeight: 600 }}>{Math.min((currentPage - 1) * itemsPerPage + 1, sortedData.length)}</strong> to{' '}
            <strong style={{ color: '#0f2942', fontWeight: 600 }}>{Math.min(currentPage * itemsPerPage, sortedData.length)}</strong> of{' '}
            <strong style={{ color: '#0f2942', fontWeight: 600 }}>{sortedData.length}</strong> {itemLabel}
          </div>

          {/* Show pagination controls only if more than itemsPerPage (e.g. > 20 patients) */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                className="admin-page-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>

              {Array.from({ length: totalPages }).map((_, idx) => {
                const pageNum = idx + 1;
                if (
                  pageNum === 1 ||
                  pageNum === totalPages ||
                  (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={pageNum}
                      className={`admin-page-btn ${currentPage === pageNum ? 'active' : ''}`}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                }
                if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                  return <span key={pageNum} style={{ padding: '0 4px', color: '#94a3b8' }}>...</span>;
                }
                return null;
              })}

              <button
                className="admin-page-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                aria-label="Next page"
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
