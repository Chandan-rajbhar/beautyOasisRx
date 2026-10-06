import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Users,
  DollarSign,
  Sparkles,
  Plus,
  Clock,
  AlertCircle,
  Activity,
  ShoppingBag,
  MessageSquare,
  UserCheck,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAdminData } from '../../context/AdminDataContext';
import { AdminCard } from '../../components/admin/ui/AdminCard';
import { AdminButton } from '../../components/admin/ui/AdminButton';
import { DashboardCharts } from '../../components/admin/charts/DashboardCharts';
import { formatActivityTime, deriveActivityLogsFromData } from '../../services/activityLogService';
import { getUpcomingAppointments, isAppointmentToday } from '../../utils/appointmentUtils';

export const AdminDashboardPage = () => {
  const {
    appointments = [],
    clients = [],
    payments = [],
    services = [],
    orders = [],
    inquiries = [],
    providers = [],
    activityLogs = [],
    stats = {},
    isLoading = false,
    error = null,
    resetToFactoryData
  } = useAdminData();
  const navigate = useNavigate();

  // Pagination state for Recent Activity (max 20 per page)
  const [activityPage, setActivityPage] = useState(1);
  const ACTIVITIES_PER_PAGE = 20;

  // 100% dynamic upcoming appointments count synchronized with Appointments module
  const dynamicUpcomingCount = useMemo(() => {
    return getUpcomingAppointments(appointments).length;
  }, [appointments]);

  // 100% dynamic today appointments count synchronized with Supabase appointments
  const dynamicTodayCount = useMemo(() => {
    return appointments.filter(isAppointmentToday).length;
  }, [appointments]);


  // Dynamic Total New Leads count from existing Firebase / local / Supabase leads
  const { totalNewLeadsCount, totalLeadsCount } = useMemo(() => {
    let combinedLeads = Array.isArray(inquiries) ? [...inquiries] : [];

    // Also include any cached leads from Firebase or browser persistence
    try {
      const candidateKeys = ['firebase_leads', 'leads', 'bo_inquiries_dynamic_cache', 'bo_leads'];
      candidateKeys.forEach(k => {
        const raw = localStorage.getItem(k);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            list.forEach(item => {
              if (item && !combinedLeads.some(e => (e.id && e.id === item.id) || (e.ticket_id && e.ticket_id === item.ticket_id))) {
                combinedLeads.push(item);
              }
            });
          }
        }
      });
    } catch (_) {}

    const newLeads = combinedLeads.filter(item => {
      const st = String(item.status || '').toLowerCase().trim();
      return st === 'new' || st === 'unread' || st === 'pending' || st === 'open';
    });

    const newCount = newLeads.length || (stats.newInquiriesCount ?? 0);
    return {
      totalNewLeadsCount: newCount,
      totalLeadsCount: combinedLeads.length || newCount
    };
  }, [inquiries, stats.newInquiriesCount]);

  // Dynamic Recent Activity logs from Supabase with resilient live fallback
  const allActivities = useMemo(() => {
    if (Array.isArray(activityLogs) && activityLogs.length > 0) {
      return activityLogs;
    }
    return deriveActivityLogsFromData({ appointments, clients, payments, orders, inquiries });
  }, [activityLogs, appointments, clients, payments, orders, inquiries]);

  const totalActivities = allActivities.length;
  const totalActivityPages = Math.ceil(totalActivities / ACTIVITIES_PER_PAGE);

  // Auto-correct activityPage if it goes beyond totalActivityPages
  useEffect(() => {
    if (activityPage > totalActivityPages && totalActivityPages > 0) {
      setActivityPage(totalActivityPages);
    }
  }, [totalActivityPages, activityPage]);

  // Paginated activities slice for the current page
  const paginatedActivities = useMemo(() => {
    const start = (activityPage - 1) * ACTIVITIES_PER_PAGE;
    return allActivities.slice(start, start + ACTIVITIES_PER_PAGE);
  }, [allActivities, activityPage]);

  // Navigate to appropriate module / detail page based on activity type
  const handleActivityClick = (act) => {
    if (!act) return;
    const type = String(act.entity_type || '').toLowerCase();
    const id = act.entity_id || act.entityId || act.metadata?.entity_id || act.metadata?.id;

    switch (type) {
      case 'patient':
      case 'client':
        if (id) {
          navigate(`/clients/${encodeURIComponent(id)}`, { state: { patientId: id } });
        } else {
          navigate('/clients');
        }
        break;

      case 'appointment':
        navigate(id ? `/appointments?id=${encodeURIComponent(id)}` : '/appointments', {
          state: { selectedAppointmentId: id, highlightId: id }
        });
        break;

      case 'payment':
        navigate(id ? `/payments?id=${encodeURIComponent(id)}` : '/payments', {
          state: { selectedPaymentId: id, highlightId: id }
        });
        break;

      case 'order':
        if (id) {
          navigate(`/orders/${encodeURIComponent(id)}`, { state: { selectedOrderId: id } });
        } else {
          navigate('/orders');
        }
        break;

      case 'treatment':
      case 'service':
        navigate('/services', { state: { serviceId: id } });
        break;

      case 'inquiry':
      case 'ticket':
        navigate('/inquiries', { state: { selectedInquiryId: id, highlightId: id } });
        break;

      default:
        navigate('/dashboard');
        break;
    }
  };

  const getActivityIcon = (entityType) => {
    const t = String(entityType || '').toLowerCase();
    switch (t) {
      case 'appointment':
        return <Calendar size={18} />;
      case 'patient':
      case 'client':
        return <Users size={18} />;
      case 'payment':
        return <DollarSign size={18} />;
      case 'order':
        return <ShoppingBag size={18} />;
      case 'treatment':
      case 'service':
        return <Sparkles size={18} />;
      case 'inquiry':
        return <MessageSquare size={18} />;
      default:
        return <Activity size={18} />;
    }
  };

  const getActivityIconColor = (entityType) => {
    const t = String(entityType || '').toLowerCase();
    switch (t) {
      case 'appointment':
        return '#1e5aa8';
      case 'patient':
      case 'client':
        return '#16a34a';
      case 'payment':
        return '#0284c7';
      case 'order':
        return '#d97706';
      case 'treatment':
      case 'service':
        return '#db2777';
      case 'inquiry':
        return '#eab308';
      default:
        return '#475569';
    }
  };

  const getActivityIconBg = (entityType) => {
    const t = String(entityType || '').toLowerCase();
    switch (t) {
      case 'appointment':
        return '#f0f7ff';
      case 'patient':
      case 'client':
        return '#f0fdf4';
      case 'payment':
        return '#f0f9ff';
      case 'order':
        return '#fffbeb';
      case 'treatment':
      case 'service':
        return '#fdf2f8';
      case 'inquiry':
        return '#fefce8';
      default:
        return '#f1f5f9';
    }
  };

  return (
    <div style={{ maxWidth: '100%', margin: '0 auto' }}>
      {/* ── Optional Error Notice ── */}
      {error && (
        <div style={{ padding: '12px 18px', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={resetToFactoryData} style={{ background: 'transparent', border: 'none', color: '#b91c1c', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
            Retry connection
          </button>
        </div>
      )}

      {/* ── Top Page Header ── */}
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Clinical Practice Overview</h1>
          <p>Real-time analytics for appointments, patient registry, treatments, and practice revenue.</p>
        </div>

        <div className="admin-page-actions">
          <AdminButton
            variant="secondary"
            onClick={() => navigate('/clients')}
            icon={<Users size={16} />}
          >
            Patient Registry
          </AdminButton>

          <AdminButton
            variant="primary"
            onClick={() => navigate('/appointments?action=new')}
            icon={<Plus size={16} />}
          >
            Book Appointment
          </AdminButton>
        </div>
      </div>

      {/* ── Core Metric Cards Grid (Balanced 4-col / 3-col KPI Layout) ── */}
      <div className="admin-stats-grid admin-dashboard-stats-grid">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="admin-card" style={{ padding: '16px 20px' }}>
              <div className="admin-card-header" style={{ marginBottom: '10px' }}>
                <div style={{ height: '13px', width: '55%', background: '#e2e8f0', borderRadius: '4px', animation: 'shimmer 1.4s infinite' }} />
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#e2e8f0', animation: 'shimmer 1.4s infinite' }} />
              </div>
              <div style={{ height: '26px', width: '40%', background: '#e2e8f0', borderRadius: '6px', marginBottom: '6px', animation: 'shimmer 1.4s infinite' }} />
              <div style={{ height: '12px', width: '65%', background: '#f1f5f9', borderRadius: '4px', animation: 'shimmer 1.4s infinite' }} />
            </div>
          ))
        ) : (
          <>
            {/* 1. Total Appointments */}
            <AdminCard
              title="Total Appointments"
              value={appointments.length || stats.totalAppointmentsCount || 0}
              subtitle={`${dynamicTodayCount} today • ${dynamicUpcomingCount} upcoming`}
              icon={<Calendar size={18} />}
              iconBg="#f0fdf4"
              iconColor="#16a34a"
              onClick={() => navigate('/appointments')}
            />

            {/* 2. Total Upcoming Appointments (100% dynamic from Supabase) */}
            <AdminCard
              title="Total Upcoming Appointments"
              value={dynamicUpcomingCount}
              subtitle={`${stats.pendingAppointmentsCount ?? 0} pending confirmation`}
              icon={<Clock size={18} />}
              iconBg="#eff6ff"
              iconColor="#2563eb"
              onClick={() => navigate('/appointments?tab=upcoming')}
            />

            {/* 3. Total Patients / Clients */}
            <AdminCard
              title="Total Patients / Clients"
              value={stats.totalClientsCount ?? clients.length}
              subtitle={`${stats.activeClientsCount ?? stats.totalClientsCount ?? clients.length} active in registry`}
              icon={<Users size={18} />}
              iconBg="#f0f7ff"
              iconColor="#1e5aa8"
              onClick={() => navigate('/clients')}
            />

            {/* 4. Total Revenue */}
            <AdminCard
              title="Total Revenue"
              value={`$${Number(stats.totalRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
              subtitle={`$${Number(stats.pendingRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} pending collections`}
              icon={<DollarSign size={18} />}
              iconBg="#fefce8"
              iconColor="#ca8a04"
              valueStyle={{
                fontSize: '1.45rem',
                fontWeight: 700,
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
              onClick={() => navigate('/payments')}
            />

            {/* 5. Total Orders */}
            <AdminCard
              title="Total Orders"
              value={stats.totalOrdersCount ?? (orders ? orders.length : 0)}
              subtitle={`${stats.pendingOrdersCount ?? 0} pending fulfillment`}
              icon={<ShoppingBag size={18} />}
              iconBg="#f5f3ff"
              iconColor="#7c3aed"
              onClick={() => navigate('/orders')}
            />

            {/* 6. Total New Leads (Dynamic from Firebase / Inquiries lead data) */}
            <AdminCard
              title="Total New Leads"
              value={totalNewLeadsCount}
              subtitle={`${totalLeadsCount} total inquiry leads • Inquiries & Leads`}
              icon={<MessageSquare size={18} />}
              iconBg="#fefce8"
              iconColor="#ca8a04"
              onClick={() => navigate('/inquiries')}
            />

            {/* 7. Active Treatments / Services */}
            <AdminCard
              title="Active Treatments / Services"
              value={stats.activeServicesCount ?? services.length}
              subtitle={`${stats.totalServicesCount ?? services.length} total published protocols`}
              icon={<Sparkles size={18} />}
              iconBg="#fdf2f8"
              iconColor="#db2777"
              onClick={() => navigate('/services')}
            />

            {/* 8. Staff & Providers */}
            <AdminCard
              title="Staff & Providers"
              value={providers.length || 0}
              subtitle={`${providers.filter(p => p.status !== 'Inactive').length || providers.length || 0} active specialists`}
              icon={<UserCheck size={18} />}
              iconBg="#f0fdf4"
              iconColor="#16a34a"
              onClick={() => navigate('/providers')}
            />
          </>
        )}
      </div>

      {/* ── Dynamic Revenue Overview Section ── */}
      <DashboardCharts
        appointments={appointments}
        payments={payments}
        services={services}
        isLoading={isLoading}
      />

      {/* ── Section: Recent Activity Audit Feed (with Dynamic Pagination) ── */}
      <div style={{ marginTop: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif-display)', fontSize: '1.35rem', color: '#0f2942', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={20} color="#1e5aa8" /> Recent Activity
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.84rem', color: '#64748b' }}>
              Real-time audit log of client registrations, consultations, payments, and clinic operations
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {totalActivities > 0 && (
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
                {totalActivities} {totalActivities === 1 ? 'event' : 'events'} recorded
              </span>
            )}
            <span style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f0fdf4', padding: '4px 10px', borderRadius: '9999px', border: '1px solid #bbf7d0' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} /> Live Supabase Feed
            </span>
          </div>
        </div>

        <div className="admin-card" style={{ padding: '0', overflow: 'hidden' }}>
          {paginatedActivities.length > 0 ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {paginatedActivities.map((act, idx) => {
                  const isLast = idx === paginatedActivities.length - 1;
                  return (
                    <div
                      key={act.id || idx}
                      onClick={() => handleActivityClick(act)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleActivityClick(act);
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 20px',
                        borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
                        gap: '16px',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      title={`View ${act.entity_type || 'activity'} details`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            background: getActivityIconBg(act.entity_type),
                            color: getActivityIconColor(act.entity_type)
                          }}
                        >
                          {getActivityIcon(act.entity_type)}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#0f2942', lineHeight: 1.3, wordBreak: 'break-word' }}>
                            {act.description}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                textTransform: 'uppercase',
                                fontWeight: 700,
                                letterSpacing: '0.04em',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: '#f1f5f9',
                                color: '#475569'
                              }}
                            >
                              {act.entity_type}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        <Clock size={13} />
                        <span>{act.timeAgo || formatActivityTime(act.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Dynamic Pagination (Shown when > 20 activities) ── */}
              {totalActivities > ACTIVITIES_PER_PAGE && (
                <div className="admin-pagination">
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    Showing <strong style={{ color: '#0f2942', fontWeight: 600 }}>{(activityPage - 1) * ACTIVITIES_PER_PAGE + 1}</strong> to{' '}
                    <strong style={{ color: '#0f2942', fontWeight: 600 }}>{Math.min(activityPage * ACTIVITIES_PER_PAGE, totalActivities)}</strong> of{' '}
                    <strong style={{ color: '#0f2942', fontWeight: 600 }}>{totalActivities}</strong> activities
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      className="admin-page-btn"
                      disabled={activityPage === 1}
                      onClick={() => setActivityPage(p => Math.max(1, p - 1))}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      aria-label="Previous page"
                    >
                      <ChevronLeft size={14} />
                      <span>Previous</span>
                    </button>

                    {Array.from({ length: totalActivityPages }).map((_, idx) => {
                      const pageNum = idx + 1;
                      if (
                        pageNum === 1 ||
                        pageNum === totalActivityPages ||
                        (pageNum >= activityPage - 1 && pageNum <= activityPage + 1)
                      ) {
                        return (
                          <button
                            key={pageNum}
                            className={`admin-page-btn ${activityPage === pageNum ? 'active' : ''}`}
                            onClick={() => setActivityPage(pageNum)}
                          >
                            {pageNum}
                          </button>
                        );
                      } else if (
                        (pageNum === activityPage - 2 && pageNum > 1) ||
                        (pageNum === activityPage + 2 && pageNum < totalActivityPages)
                      ) {
                        return (
                          <span key={pageNum} style={{ color: '#94a3b8', padding: '0 4px', fontSize: '0.8rem' }}>
                            ...
                          </span>
                        );
                      }
                      return null;
                    })}

                    <button
                      className="admin-page-btn"
                      disabled={activityPage === totalActivityPages}
                      onClick={() => setActivityPage(p => Math.min(totalActivityPages, p + 1))}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      aria-label="Next page"
                    >
                      <span>Next</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
              <Activity size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#0f2942' }}>No activities logged yet</p>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>New practice updates and client actions will appear here in real time.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
