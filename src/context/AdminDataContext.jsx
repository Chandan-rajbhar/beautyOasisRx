import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabaseDataService } from '../services/supabaseDataService';
import {
  getAppointmentDateObj,
  isAppointmentUpcoming,
  isAppointmentToday,
  getUpcomingAppointments
} from '../utils/appointmentUtils';

const AdminDataContext = createContext(null);

export const AdminDataProvider = ({ children }) => {
  // Synchronous cache hydration for instant initial paint (0ms latency)
  const [appointments, setAppointments] = useState(() => supabaseDataService.getCachedData('appointments', []));
  const [clients, setClients] = useState(() => supabaseDataService.getCachedData('clients', []));
  const [services, setServices] = useState(() => supabaseDataService.getCachedData('services', []));
  const [products, setProducts] = useState(() => supabaseDataService.getCachedData('products', []));
  const [categories, setCategories] = useState(() => supabaseDataService.getCachedData('categories', []));
  const [orders, setOrders] = useState(() => supabaseDataService.getCachedData('orders', []));
  const [payments, setPayments] = useState(() => supabaseDataService.getCachedData('payments', []));
  const [providers, setProviders] = useState(() => supabaseDataService.getCachedData('providers', []));
  const [inquiries, setInquiries] = useState(() => supabaseDataService.getCachedData('inquiries', []));
  const [notifications, setNotifications] = useState(() => supabaseDataService.getCachedData('notifications', []));
  const [activityLogs, setActivityLogs] = useState(() => supabaseDataService.getCachedData('activity_logs', []));
  const [users, setUsers] = useState(() => supabaseDataService.getCachedData('users', []));
  const [coupons, setCoupons] = useState(() => supabaseDataService.getCachedData('coupons', []));
  const [websiteContent, setWebsiteContent] = useState(() => supabaseDataService.getCachedData('website_content', {}));
  const [settings, setSettings] = useState(() => supabaseDataService.getCachedData('settings', {}));

  // If we already have cached data, don't show full-page blocking spinner
  const hasInitialCache = Boolean(
    (appointments && appointments.length > 0) ||
    (clients && clients.length > 0) ||
    (services && services.length > 0) ||
    (products && products.length > 0)
  );

  const [isLoading, setIsLoading] = useState(!hasInitialCache);
  const [error, setError] = useState(null);

  // Background data fetch from Supabase (deduped & cached)
  useEffect(() => {
    let isMounted = true;

    async function loadAll() {
      if (!hasInitialCache) {
        setIsLoading(true);
      }
      setError(null);
      try {
        const [
          apptData, clientData, serviceData, productData, categoryData,
          orderData, paymentData, providerData, inquiryData,
          notifData, actData, userData, couponData, contentData, settingsData
        ] = await Promise.all([
          supabaseDataService.fetchAll('appointments'),
          supabaseDataService.fetchAll('clients'),
          supabaseDataService.fetchAll('services'),
          supabaseDataService.fetchAll('products'),
          supabaseDataService.fetchAll('categories'),
          supabaseDataService.fetchAll('orders'),
          supabaseDataService.fetchAll('payments'),
          supabaseDataService.fetchAll('providers'),
          supabaseDataService.fetchAll('inquiries'),
          supabaseDataService.fetchAll('notifications'),
          supabaseDataService.fetchAll('activity_logs'),
          supabaseDataService.fetchAll('users'),
          supabaseDataService.fetchAll('coupons'),
          supabaseDataService.fetchAll('website_content'),
          supabaseDataService.fetchAll('settings'),
        ]);

        if (isMounted) {
          setAppointments(apptData);
          setClients(clientData);
          setServices(serviceData);
          setProducts(productData);
          setCategories(categoryData);
          setOrders(orderData);
          setPayments(paymentData);
          setProviders(providerData);
          setInquiries(inquiryData);
          setNotifications(notifData);
          setActivityLogs(actData);
          setUsers(userData);
          setCoupons(couponData);
          setWebsiteContent(contentData);
          setSettings(settingsData);
        }
      } catch (err) {
        console.error('Failed to load data from Supabase:', err);
        if (isMounted && !hasInitialCache) {
          setError('Failed to connect to database. Please check your connection.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadAll();

    return () => {
      isMounted = false;
    };
  }, [hasInitialCache]);

  // Subscribe to in-memory cache updates (triggered after create/update/delete)
  useEffect(() => {
    const unsubs = [
      supabaseDataService.subscribe('appointments', setAppointments),
      supabaseDataService.subscribe('clients', setClients),
      supabaseDataService.subscribe('services', setServices),
      supabaseDataService.subscribe('products', setProducts),
      supabaseDataService.subscribe('categories', setCategories),
      supabaseDataService.subscribe('orders', setOrders),
      supabaseDataService.subscribe('payments', setPayments),
      supabaseDataService.subscribe('providers', setProviders),
      supabaseDataService.subscribe('inquiries', setInquiries),
      supabaseDataService.subscribe('notifications', setNotifications),
      supabaseDataService.subscribe('activity_logs', setActivityLogs),
      supabaseDataService.subscribe('users', setUsers),
      supabaseDataService.subscribe('coupons', setCoupons),
      supabaseDataService.subscribe('website_content', setWebsiteContent),
      supabaseDataService.subscribe('settings', setSettings),
    ];
    // Enable Realtime Supabase change listeners for live updates
    supabaseDataService.enableRealtime(['appointments', 'clients', 'orders', 'payments', 'inquiries', 'notifications', 'activity_logs']);

    return () => unsubs.forEach(fn => fn());
  }, []);

  // Generic collection operations (async — return promises)
  const createItem = useCallback(async (collection, item) => {
    return supabaseDataService.createItem(collection, item);
  }, []);

  const updateItem = useCallback(async (collection, id, updates) => {
    return supabaseDataService.updateItem(collection, id, updates);
  }, []);

  const deleteItem = useCallback(async (collection, id) => {
    return supabaseDataService.deleteItem(collection, id);
  }, []);

  // Notification helpers
  const markNotificationAsRead = useCallback(async (id) => {
    return supabaseDataService.markNotificationRead(id);
  }, []);

  const markAllNotificationsAsRead = useCallback(async () => {
    return supabaseDataService.markAllNotificationsRead();
  }, []);

  // Content helpers
  const updateWebsiteSection = useCallback(async (section, data) => {
    return supabaseDataService.updateWebsiteSection(section, data);
  }, []);

  // Reset / re-fetch all data
  const resetToFactoryData = useCallback(async () => {
    setIsLoading(true);
    const [apptData, clientData, serviceData, productData, orderData, paymentData, providerData, inquiryData, notifData, actData, userData, contentData, settingsData] = await Promise.all([
      supabaseDataService.fetchAll('appointments'),
      supabaseDataService.fetchAll('clients'),
      supabaseDataService.fetchAll('services'),
      supabaseDataService.fetchAll('products'),
      supabaseDataService.fetchAll('orders'),
      supabaseDataService.fetchAll('payments'),
      supabaseDataService.fetchAll('providers'),
      supabaseDataService.fetchAll('inquiries'),
      supabaseDataService.fetchAll('notifications'),
      supabaseDataService.fetchAll('activity_logs'),
      supabaseDataService.fetchAll('users'),
      supabaseDataService.fetchAll('website_content'),
      supabaseDataService.fetchAll('settings'),
    ]);
    setAppointments(apptData);
    setClients(clientData);
    setServices(serviceData);
    setProducts(productData);
    setOrders(orderData);
    setPayments(paymentData);
    setProviders(providerData);
    setInquiries(inquiryData);
    setNotifications(notifData);
    setActivityLogs(actData);
    setUsers(userData);
    setWebsiteContent(contentData);
    setSettings(settingsData);
    setIsLoading(false);
  }, []);

  // Computed Business Analytics & Metrics (Unified with Appointments Module)
  const stats = useMemo(() => {
    const isToday = (dateVal) => {
      if (!dateVal) return false;
      return isAppointmentToday({ date: dateVal });
    };

    const todayAppointments = appointments.filter(isAppointmentToday);
    const upcomingAppointments = getUpcomingAppointments(appointments);

    const completedAppointments = appointments.filter(a => a.status === 'Completed');
    const cancelledAppointments = appointments.filter(a => a.status === 'Cancelled');
    const pendingAppointments = appointments.filter(a => a.status === 'Pending');

    const totalClientsCount = clients.length;
    const activeClientsCount = clients.filter(c => c.status === 'Active').length;
    const newClientsCount = clients.filter(c => {
      if (!c.created_at) return false;
      const created = new Date(c.created_at);
      const diffDays = (new Date() - created) / (1000 * 60 * 60 * 24);
      return diffDays <= 30;
    }).length;

    const totalPaidPayments = payments
      .filter(p => String(p.status || p.payment_status || '').toLowerCase() === 'paid')
      .reduce((sum, p) => sum + Number(p.amount ?? p.total_amount ?? 0), 0);

    const paidAppointmentsRevenue = appointments
      .filter(a => String(a.paymentStatus || a.payment_status || '').toLowerCase() === 'paid')
      .reduce((sum, a) => sum + Number(a.price || a.amount || 0), 0);

    const totalRevenue = totalPaidPayments > 0 ? totalPaidPayments : paidAppointmentsRevenue;

    const pendingRevenue = payments
      .filter(p => String(p.status || p.payment_status || '').toLowerCase() === 'pending')
      .reduce((sum, p) => sum + Number(p.amount ?? p.total_amount ?? 0), 0);

    const refundedRevenue = payments
      .filter(p => String(p.status || p.payment_status || '').toLowerCase() === 'refunded')
      .reduce((sum, p) => sum + Number(p.amount ?? p.total_amount ?? 0), 0);

    const todayRevenue = payments
      .filter(p => String(p.status || p.payment_status || '').toLowerCase() === 'paid' && isToday(p.date || p.created_at))
      .reduce((sum, p) => sum + Number(p.amount ?? p.total_amount ?? 0), 0);

    const activeServicesCount = services.filter(s => s.status === 'Active' || s.practice_status === 'Active').length;

    const serviceBookingCounts = {};
    appointments.forEach(apt => {
      const sName = apt.service_name || apt.serviceName || apt.protocol_title || 'Treatment Protocol';
      serviceBookingCounts[sName] = (serviceBookingCounts[sName] || 0) + 1;
    });

    const topServices = Object.entries(serviceBookingCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const unreadNotificationsCount = notifications.filter(n => !n.is_read && !n.read).length;
    const newInquiriesCount = inquiries.filter(i => i.status === 'New').length;

    return {
      totalAppointmentsCount: appointments.length,
      todayAppointmentsCount: todayAppointments.length,
      upcomingAppointmentsCount: upcomingAppointments.length,
      completedAppointmentsCount: completedAppointments.length,
      cancelledAppointmentsCount: cancelledAppointments.length,
      pendingAppointmentsCount: pendingAppointments.length,
      totalClientsCount,
      activeClientsCount,
      newClientsCount,
      totalRevenue,
      todayRevenue,
      monthlyRevenue: totalRevenue,
      pendingRevenue,
      refundedRevenue,
      totalServicesCount: services.length,
      activeServicesCount,
      topServices,
      unreadNotificationsCount,
      newInquiriesCount,
      totalOrdersCount: orders.length,
      pendingOrdersCount: orders.filter(o => String(o.orderStatus || o.status || '').toLowerCase() === 'pending').length,
    };
  }, [appointments, clients, payments, services, orders, notifications, inquiries]);

  return (
    <AdminDataContext.Provider
      value={{
        appointments,
        clients,
        services,
        products,
        categories,
        orders,
        payments,
        providers,
        inquiries,
        notifications,
        activityLogs,
        users,
        coupons,
        websiteContent,
        settings,
        stats,
        isLoading,
        error,
        createItem,
        updateItem,
        deleteItem,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        updateWebsiteSection,
        resetToFactoryData,
      }}
    >
      {children}
    </AdminDataContext.Provider>
  );
};

export const useAdminData = () => {
  const context = useContext(AdminDataContext);
  if (!context) {
    throw new Error('useAdminData must be used within an AdminDataProvider');
  }
  return context;
};
