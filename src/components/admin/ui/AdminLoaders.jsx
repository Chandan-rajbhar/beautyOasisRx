import React from 'react';

/**
 * PageLoader — Full-page animated loading screen shown while
 * Supabase data is being fetched on initial load.
 */
export const PageLoader = ({ message = 'Loading your dashboard...' }) => {
  return (
    <div className="page-loader-overlay">
      {/* Logo / Brand */}
      <div className="page-loader-brand">
        <div className="page-loader-logo">
          <span className="page-loader-logo-letter">B</span>
        </div>
        <div className="page-loader-brand-text">
          <span className="page-loader-brand-name">Beauty Oasis</span>
          <span className="page-loader-brand-sub">Admin Console</span>
        </div>
      </div>

      {/* Animated spinner */}
      <div className="page-loader-spinner-wrap">
        <div className="page-loader-spinner">
          <div className="page-loader-spinner-ring ring-1" />
          <div className="page-loader-spinner-ring ring-2" />
          <div className="page-loader-spinner-ring ring-3" />
          <div className="page-loader-spinner-dot" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="page-loader-bar-track">
        <div className="page-loader-bar-fill" />
      </div>

      <p className="page-loader-message">{message}</p>
    </div>
  );
};

/**
 * TableSkeleton — Drop-in shimmer rows for AdminTable while loading.
 * Pass `columns` count and `rows` count.
 */
export const TableSkeleton = ({ columns = 5, rows = 6 }) => {
  const colCount = Array.isArray(columns) ? columns.length : (Number(columns) || 5);
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="table-skeleton-row">
          {Array.from({ length: colCount }).map((_, cIdx) => (
            <td key={cIdx}>
              <div
                className="table-skeleton-cell"
                style={{
                  width: `${50 + ((rIdx * 3 + cIdx * 7) % 5) * 10}%`,
                  maxWidth: cIdx === 0 ? '70px' : cIdx === colCount - 1 ? '100px' : '100%'
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

/**
 * CardSkeleton — Shimmer placeholder for stat cards on dashboard.
 */
export const CardSkeleton = ({ count = 4 }) => {
  return (
    <div className="card-skeleton-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-skeleton">
          <div className="card-skeleton-icon" />
          <div className="card-skeleton-lines">
            <div className="card-skeleton-line line-short" />
            <div className="card-skeleton-line line-long" />
          </div>
        </div>
      ))}
    </div>
  );
};
