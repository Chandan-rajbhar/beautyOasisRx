import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from '../../components/admin/layout/AdminLayout';
import { AdminLoginPage } from './AdminLoginPage';
import { AdminDashboardPage } from './AdminDashboardPage';
import { AppointmentsPage } from './AppointmentsPage';
import { ClientsPage } from './ClientsPage';
import { ServicesPage } from './ServicesPage';
import { ProductsPage } from './ProductsPage';
import { OrdersPage } from './OrdersPage';
import { PaymentsPage } from './PaymentsPage';
import { ProvidersPage } from './ProvidersPage';
import { InquiriesPage } from './InquiriesPage';
import { WebsiteContentPage } from './WebsiteContentPage';
import { NotificationsPage } from './NotificationsPage';
import { AdminUsersPage } from './AdminUsersPage';
import { SettingsPage } from './SettingsPage';
import { ProfilePage } from './ProfilePage';

export const AdminRootRouter = () => {
  return (
    <Routes>
      {/* Public Admin Auth Route */}
      <Route path="login" element={<AdminLoginPage />} />

      {/* Protected Admin Shell */}
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="providers" element={<ProvidersPage />} />
        <Route path="inquiries" element={<InquiriesPage />} />
        <Route path="content" element={<WebsiteContentPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
};
