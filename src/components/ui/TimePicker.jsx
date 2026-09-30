import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Clock, ChevronDown, Check } from 'lucide-react';

// Static choices for the columns
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const PERIODS = ['AM', 'PM'];

/**
 * Safely parses a time string like "04:15 PM" or "10:30 AM" or "4:15 PM"
 */
const parseTimeString = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') {
    return { hour: '10', minute: '30', period: 'AM' };
  }
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    let p = (match[3] || 'AM').toUpperCase();

    if (h > 12) {
      h = h - 12;
      p = 'PM';
    } else if (h === 0) {
      h = 12;
      p = 'AM';
    }
    const hourStr = String(Math.min(Math.max(1, h), 12)).padStart(2, '0');
    const minStr = String(Math.min(Math.max(0, m), 59)).padStart(2, '0');
    return { hour: hourStr, minute: minStr, period: p };
  }
  return { hour: '10', minute: '30', period: 'AM' };
};

export const TimePicker = ({
  value = '',
  onChange,
  placeholder = 'Select appointment time...',
  disabled = false,
  error = false,
  className = '',
  id = null,
  style = {}
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState('10');
  const [selectedMinute, setSelectedMinute] = useState('30');
  const [selectedPeriod, setSelectedPeriod] = useState('AM');
  const [position, setPosition] = useState(null);

  const triggerRef = useRef(null);
  const popupRef = useRef(null);
  const hourListRef = useRef(null);
  const minuteListRef = useRef(null);

  // Position calculation and viewport collision detection
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popupHeight = 310;
    const popupWidth = 270;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < popupHeight && rect.top > popupHeight;

    const top = openUpward ? Math.max(10, rect.top - popupHeight - 6) : rect.bottom + 6;
    let left = rect.left;
    if (left + popupWidth > window.innerWidth - 16) {
      left = window.innerWidth - popupWidth - 16;
    }
    left = Math.max(16, left);

    setPosition({
      top,
      left,
      width: popupWidth,
      openUpward
    });
  }, []);

  // When opening, initialize local selected values from incoming value
  const handleOpen = () => {
    if (disabled) return;
    const parsed = parseTimeString(value);
    setSelectedHour(parsed.hour);
    setSelectedMinute(parsed.minute);
    setSelectedPeriod(parsed.period);
    updatePosition();
    setIsOpen(true);
  };

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setPosition(null);
  }, []);

  // Click outside and escape key handling
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target) &&
        popupRef.current &&
        !popupRef.current.contains(e.target)
      ) {
        handleClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, handleClose, updatePosition]);

  // Auto-scroll selected hour and minute into center view when popup opens
  useEffect(() => {
    if (!isOpen) return;

    const timeout = setTimeout(() => {
      if (hourListRef.current) {
        const activeHour = hourListRef.current.querySelector('[data-selected="true"]');
        if (activeHour) {
          activeHour.scrollIntoView({ block: 'center', behavior: 'auto' });
        }
      }
      if (minuteListRef.current) {
        const activeMinute = minuteListRef.current.querySelector('[data-selected="true"]');
        if (activeMinute) {
          activeMinute.scrollIntoView({ block: 'center', behavior: 'auto' });
        }
      }
    }, 40);

    return () => clearTimeout(timeout);
  }, [isOpen]);

  // Confirm selection
  const handleConfirm = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const formatted = `${selectedHour}:${selectedMinute} ${selectedPeriod}`;
    if (onChange) {
      onChange(formatted);
    }
    handleClose();
  };

  // Cancel action: closes without changing value
  const handleCancel = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleClose();
  };

  return (
    <div className={`custom-time-picker-wrapper ${className}`} style={{ position: 'relative', width: '100%', ...style }}>
      {/* ── Input Trigger ── */}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => (isOpen ? handleClose() : handleOpen())}
        className={`custom-time-picker-trigger ${isOpen ? 'active' : ''} ${error ? 'error' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <Clock size={16} color={error ? '#dc2626' : '#64748b'} style={{ flexShrink: 0 }} />
          <span
            style={{
              fontSize: '0.88rem',
              color: value ? '#0f2942' : '#94a3b8',
              fontWeight: value ? 500 : 400,
              whiteSpace: 'nowrap'
            }}
          >
            {value || placeholder}
          </span>
        </div>
        <ChevronDown
          size={15}
          color="#64748b"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            flexShrink: 0
          }}
        />
      </button>

      {/* ── Time Picker Popover (Portal to body to prevent modal clipping) ── */}
      {isOpen && position && typeof document !== 'undefined' && createPortal(
        <div
          ref={popupRef}
          className="custom-time-picker-popover"
          style={{
            position: 'fixed',
            top: `${position.top}px`,
            left: `${position.left}px`,
            width: `${position.width}px`,
            zIndex: 99999
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Preview */}
          <div className="time-picker-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={15} color="#1e5aa8" />
              <span className="time-picker-header-title">Select Time</span>
            </div>
            <div className="time-picker-digital-display">
              <span className="digital-hour">{selectedHour}</span>
              <span className="digital-colon">:</span>
              <span className="digital-minute">{selectedMinute}</span>
              <span className="digital-period">{selectedPeriod}</span>
            </div>
          </div>

          {/* 3 Columns: Hour (01-12) | Minute (00-59) | Period (AM/PM) */}
          <div className="time-picker-columns">
            {/* Hour Column */}
            <div className="time-picker-column">
              <div className="column-label">Hour</div>
              <div ref={hourListRef} className="column-scroll-list">
                {HOURS.map((hour) => {
                  const isSelected = selectedHour === hour;
                  return (
                    <button
                      key={hour}
                      type="button"
                      data-selected={isSelected}
                      className={`time-picker-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedHour(hour)}
                    >
                      {hour}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Column Divider */}
            <div className="time-picker-divider" />

            {/* Minute Column */}
            <div className="time-picker-column">
              <div className="column-label">Minute</div>
              <div ref={minuteListRef} className="column-scroll-list">
                {MINUTES.map((min) => {
                  const isSelected = selectedMinute === min;
                  return (
                    <button
                      key={min}
                      type="button"
                      data-selected={isSelected}
                      className={`time-picker-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedMinute(min)}
                    >
                      {min}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Column Divider */}
            <div className="time-picker-divider" />

            {/* Period Column */}
            <div className="time-picker-column period-column">
              <div className="column-label">Period</div>
              <div className="period-options-container">
                {PERIODS.map((period) => {
                  const isSelected = selectedPeriod === period;
                  return (
                    <button
                      key={period}
                      type="button"
                      className={`time-picker-period-btn ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedPeriod(period)}
                    >
                      {period}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer Actions: Cancel and Add Time */}
          <div className="time-picker-footer">
            <button
              type="button"
              className="time-picker-cancel-btn"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="time-picker-submit-btn"
              onClick={handleConfirm}
            >
              Add Time
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default TimePicker;
