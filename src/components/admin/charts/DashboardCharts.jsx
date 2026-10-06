import React, { useState, useMemo } from 'react';
import { TrendingUp, DollarSign } from 'lucide-react';

export const DashboardCharts = ({ appointments = [], payments = [], services = [], isLoading = false }) => {
  const [timeframe, setTimeframe] = useState('30d'); // '7d' | '30d' | '12m'
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Extract all paid revenue transactions dynamically from Supabase payments & appointments
  const paidRecords = useMemo(() => {
    const records = [];

    // 1. From payments table
    (payments || []).forEach(p => {
      const isPaid = String(p.status || p.payment_status || '').toLowerCase() === 'paid';
      if (isPaid) {
        const amt = Number(p.amount ?? p.total_amount ?? 0);
        const dateStr = p.date || p.payment_date || p.created_at;
        if (amt > 0 && dateStr) {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            records.push({ amount: amt, date: d, source: 'payment', id: p.id });
          }
        }
      }
    });

    // 2. From appointments table (avoiding double count if matching amount and same day already in payments)
    (appointments || []).forEach(a => {
      const isPaid = String(a.paymentStatus || a.payment_status || '').toLowerCase() === 'paid';
      if (isPaid) {
        const amt = Number(a.price || a.amount || 0);
        const dateStr = a.date || a.appointment_date || a.created_at;
        if (amt > 0 && dateStr) {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            const ymd = d.toISOString().split('T')[0];
            const alreadyExists = records.some(r => Math.abs(r.amount - amt) < 0.01 && r.date.toISOString().split('T')[0] === ymd);
            if (!alreadyExists) {
              records.push({ amount: amt, date: d, source: 'appointment', id: a.id });
            }
          }
        }
      }
    });

    return records;
  }, [payments, appointments]);

  // Compute graph buckets and metrics based on selected timeframe
  const { revenueData, periodTotal, periodAvg, peakRevenue, periodLabel, avgUnit } = useMemo(() => {
    const now = new Date();
    let data = [];
    let periodLabelText = '';
    let unitText = '';

    if (timeframe === '7d') {
      periodLabelText = 'Last 7 Days';
      unitText = '/ day';
      // 7 days rolling (6 days ago to today)
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const ymd = d.toLocaleDateString('en-CA'); // YYYY-MM-DD local
        const utcYmd = d.toISOString().split('T')[0];
        const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
        const fullDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        const dayTotal = paidRecords.reduce((sum, r) => {
          const rLocal = r.date.toLocaleDateString('en-CA');
          const rUtc = r.date.toISOString().split('T')[0];
          if (rLocal === ymd || rUtc === utcYmd) {
            return sum + r.amount;
          }
          return sum;
        }, 0);

        data.push({
          label: dayLabel,
          sublabel: d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
          fullDate,
          value: Math.round(dayTotal * 100) / 100
        });
      }
    } else if (timeframe === '30d') {
      periodLabelText = 'Last 30 Days';
      unitText = '/ week';
      // 4 weekly buckets
      const weeks = [
        { label: 'Week 1', minDays: 22, maxDays: 30 },
        { label: 'Week 2', minDays: 15, maxDays: 21 },
        { label: 'Week 3', minDays: 8, maxDays: 14 },
        { label: 'Week 4', minDays: 0, maxDays: 7 },
      ];

      data = weeks.map(w => {
        const startD = new Date(now);
        startD.setDate(now.getDate() - w.maxDays);
        const endD = new Date(now);
        endD.setDate(now.getDate() - w.minDays);

        const rangeStr = `${startD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

        const weekTotal = paidRecords.reduce((sum, r) => {
          const diffDays = Math.floor((now - r.date) / (1000 * 60 * 60 * 24));
          if (diffDays >= w.minDays && diffDays <= w.maxDays) {
            return sum + r.amount;
          }
          return sum;
        }, 0);

        return {
          label: w.label,
          sublabel: `${startD.getDate()}-${endD.getDate()}`,
          fullDate: rangeStr,
          value: Math.round(weekTotal * 100) / 100
        };
      });
    } else {
      // 12 Months rolling
      periodLabelText = 'Last 12 Months';
      unitText = '/ month';
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth();
        const monthLabel = d.toLocaleDateString('en-US', { month: 'short' });
        const fullDate = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        const monthTotal = paidRecords.reduce((sum, r) => {
          if (r.date.getFullYear() === y && r.date.getMonth() === m) {
            return sum + r.amount;
          }
          return sum;
        }, 0);

        data.push({
          label: monthLabel,
          sublabel: String(y).slice(-2),
          fullDate,
          value: Math.round(monthTotal * 100) / 100
        });
      }
    }

    const total = data.reduce((sum, d) => sum + d.value, 0);
    const avg = data.length > 0 ? total / data.length : 0;
    const peak = Math.max(...data.map(d => d.value), 0);

    return {
      revenueData: data,
      periodTotal: total,
      periodAvg: avg,
      peakRevenue: peak,
      periodLabel: periodLabelText,
      avgUnit: unitText
    };
  }, [timeframe, paidRecords]);

  // Use a reasonable baseline ceiling so empty charts don't collapse
  const maxChartValue = Math.max(peakRevenue, 100);

  // Y-axis 4 benchmark tick labels
  const yTicks = [
    maxChartValue,
    Math.round(maxChartValue * 0.75),
    Math.round(maxChartValue * 0.5),
    Math.round(maxChartValue * 0.25),
    0
  ];

  return (
    <div className="admin-revenue-section">
      <div className="admin-card" style={{ padding: '24px 28px', position: 'relative', overflow: 'hidden' }}>
        {/* ── Top Header: Title, Description & Timeframe Tabs ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '20px'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#f0f7ff',
                  color: '#1e5aa8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <TrendingUp size={20} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f2942', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                Revenue Overview
              </h3>
            </div>
            <p style={{ margin: '4px 0 0 46px', fontSize: '0.84rem', color: '#64748b' }}>
              Dynamic practice revenue performance from completed patient bookings and apothecary orders
            </p>
          </div>

          {/* Timeframe Filter Buttons */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: '#f1f5f9',
              padding: '4px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              gap: '4px'
            }}
          >
            {[
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' },
              { id: '12m', label: '12 Months' }
            ].map(tab => {
              const isActive = timeframe === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setTimeframe(tab.id)}
                  style={{
                    background: isActive ? '#ffffff' : 'transparent',
                    color: isActive ? '#0f2942' : '#64748b',
                    fontWeight: isActive ? 700 : 500,
                    boxShadow: isActive ? '0 2px 6px rgba(15, 41, 66, 0.08)' : 'none',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Summary Metrics Bar (Period Total, Average, Peak, Live Status) ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            padding: '16px 20px',
            background: '#f8fafc',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            marginBottom: '28px'
          }}
        >
          <div>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', fontWeight: 600, display: 'block' }}>
              {periodLabel} Total
            </span>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f2942', marginTop: '2px' }}>
              ${periodTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', fontWeight: 600, display: 'block' }}>
              Average Rate
            </span>
            <div style={{ fontSize: '1.15rem', fontWeight: 600, color: '#1e5aa8', marginTop: '2px' }}>
              ${periodAvg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, marginLeft: '4px' }}>{avgUnit}</span>
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', fontWeight: 600, display: 'block' }}>
              Peak Period
            </span>
            <div style={{ fontSize: '1.15rem', fontWeight: 600, color: '#16a34a', marginTop: '2px' }}>
              ${peakRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.78rem',
                color: '#16a34a',
                fontWeight: 600,
                background: '#f0fdf4',
                padding: '6px 12px',
                borderRadius: '9999px',
                border: '1px solid #bbf7d0'
              }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#16a34a' }} />
              Live Supabase Feed
            </span>
          </div>
        </div>

        {/* ── Graph Area: Loading, Empty, or Active Bars ── */}
        {isLoading ? (
          /* Loading State Skeleton */
          <div style={{ height: '240px', width: '100%', display: 'flex', alignItems: 'flex-end', gap: '14px', padding: '20px 0' }}>
            {Array.from({ length: timeframe === '7d' ? 7 : timeframe === '30d' ? 4 : 12 }).map((_, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                <div
                  style={{
                    width: '100%',
                    maxWidth: '44px',
                    height: `${30 + (i % 5) * 15}%`,
                    background: '#e2e8f0',
                    borderRadius: '8px 8px 3px 3px',
                    animation: 'shimmer 1.4s infinite'
                  }}
                />
                <div style={{ height: '10px', width: '28px', background: '#f1f5f9', borderRadius: '4px', marginTop: '10px' }} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ position: 'relative', width: '100%' }}>
            {/* Empty State Banner (if no revenue in this period) */}
            {periodTotal === 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '40%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(4px)',
                  padding: '18px 24px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 16px rgba(15, 41, 66, 0.06)',
                  zIndex: 5,
                  maxWidth: '380px',
                  width: '90%'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#64748b', fontWeight: 600, fontSize: '0.9rem' }}>
                  <DollarSign size={18} color="#94a3b8" />
                  <span>No Paid Revenue in this Period</span>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                  Completed appointments and paid orders in {periodLabel.toLowerCase()} will appear here automatically.
                </p>
              </div>
            )}

            {/* Interactive Chart Container */}
            <div
              style={{
                display: 'flex',
                height: '240px',
                width: '100%',
                position: 'relative',
                paddingTop: '16px'
              }}
            >
              {/* Y-Axis Grid Lines & Tick Values */}
              <div
                style={{
                  width: '55px',
                  height: 'calc(100% - 28px)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  paddingRight: '12px',
                  color: '#94a3b8',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  textAlign: 'right',
                  userSelect: 'none',
                  flexShrink: 0
                }}
              >
                {yTicks.map((tick, i) => (
                  <span key={i}>${tick >= 1000 ? `${(tick / 1000).toFixed(1)}k` : tick}</span>
                ))}
              </div>

              {/* Chart Plot Area */}
              <div
                style={{
                  flex: 1,
                  height: '100%',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {/* Background Horizontal Guide Lines */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: '28px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    pointerEvents: 'none',
                    opacity: 0.7
                  }}
                >
                  <div style={{ borderBottom: '1px dashed #e2e8f0', width: '100%' }} />
                  <div style={{ borderBottom: '1px dashed #e2e8f0', width: '100%' }} />
                  <div style={{ borderBottom: '1px dashed #e2e8f0', width: '100%' }} />
                  <div style={{ borderBottom: '1px dashed #e2e8f0', width: '100%' }} />
                  <div style={{ borderBottom: '1px solid #cbd5e1', width: '100%' }} />
                </div>

                {/* Bars Area (above the baseline) */}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: timeframe === '12m' ? 'clamp(4px, 1.2vw, 12px)' : 'clamp(8px, 2.5vw, 24px)',
                    position: 'relative',
                    zIndex: 2
                  }}
                >
                  {revenueData.map((pt, idx) => {
                    const heightPercent = periodTotal === 0
                      ? 4
                      : Math.max(4, Math.round((pt.value / maxChartValue) * 100));
                    const isHovered = hoveredPoint === idx;

                    return (
                      <div
                        key={idx}
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          height: '100%',
                          justifyContent: 'flex-end',
                          cursor: 'pointer',
                          position: 'relative'
                        }}
                        onMouseEnter={() => setHoveredPoint(idx)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      >
                        {/* Tooltip on Hover */}
                        {isHovered && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: `calc(${heightPercent}% + 12px)`,
                              background: '#0f2942',
                              color: '#ffffff',
                              padding: '6px 10px',
                              borderRadius: '8px',
                              fontSize: '0.76rem',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              boxShadow: '0 4px 14px rgba(15, 41, 66, 0.25)',
                              zIndex: 10,
                              pointerEvents: 'none'
                            }}
                          >
                            <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#38bdf8' }}>
                              ${pt.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#cbd5e1', marginTop: '2px' }}>
                              {pt.fullDate}
                            </div>
                          </div>
                        )}

                        {/* Bar Pillar */}
                        <div
                          style={{
                            width: '100%',
                            maxWidth: timeframe === '12m' ? '36px' : '48px',
                            height: `${heightPercent}%`,
                            background: isHovered
                              ? 'linear-gradient(180deg, #16a34a 0%, #1e5aa8 100%)'
                              : pt.value > 0
                                ? 'linear-gradient(180deg, #1e5aa8 0%, #0284c7 100%)'
                                : '#e2e8f0',
                            borderRadius: '8px 8px 3px 3px',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: isHovered
                              ? '0 4px 12px rgba(22, 163, 74, 0.35)'
                              : pt.value > 0
                                ? '0 2px 6px rgba(30, 90, 168, 0.15)'
                                : 'none'
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* X-Axis Labels Row (Strictly beneath baseline, preventing any overlap) */}
                <div
                  style={{
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: timeframe === '12m' ? 'clamp(4px, 1.2vw, 12px)' : 'clamp(8px, 2.5vw, 24px)',
                    zIndex: 2
                  }}
                >
                  {revenueData.map((pt, idx) => {
                    const isHovered = hoveredPoint === idx;
                    return (
                      <div
                        key={idx}
                        style={{
                          flex: 1,
                          textAlign: 'center',
                          fontSize: timeframe === '12m' ? 'clamp(0.65rem, 1vw, 0.76rem)' : '0.78rem',
                          color: isHovered ? '#0f2942' : '#64748b',
                          fontWeight: isHovered ? 700 : 600,
                          whiteSpace: 'nowrap',
                          transition: 'color 0.15s ease',
                          paddingTop: '6px'
                        }}
                      >
                        {pt.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
