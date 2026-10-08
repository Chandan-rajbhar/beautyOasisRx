import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { AdminDataProvider } from './context/AdminDataContext';
import { AdminLayout } from './components/admin/layout/AdminLayout';
import { ScrollToTop } from './components/admin/layout/ScrollToTop';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './styles/admin.css';

// ── Public Website (no auth required) ──
const PublicWebsitePage = lazy(() => import('./pages/PublicWebsitePage').then(m => ({ default: m.PublicWebsitePage })));

// ── Lazy-loaded Admin Pages (Code Splitting for Optimal Load Performance) ──
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage').then(m => ({ default: m.AdminLoginPage })));
const SignUpPage = lazy(() => import('./pages/admin/SignUpPage').then(m => ({ default: m.SignUpPage })));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));
const AppointmentsPage = lazy(() => import('./pages/admin/AppointmentsPage').then(m => ({ default: m.AppointmentsPage })));
const ClientsPage = lazy(() => import('./pages/admin/ClientsPage').then(m => ({ default: m.ClientsPage })));
const ServicesPage = lazy(() => import('./pages/admin/ServicesPage').then(m => ({ default: m.ServicesPage })));
const ProductsPage = lazy(() => import('./pages/admin/ProductsPage').then(m => ({ default: m.ProductsPage })));
const CouponsPage = lazy(() => import('./pages/admin/CouponsPage').then(m => ({ default: m.CouponsPage || m.default })));
const OrdersPage = lazy(() => import('./pages/admin/OrdersPage').then(m => ({ default: m.OrdersPage })));
const PaymentsPage = lazy(() => import('./pages/admin/PaymentsPage').then(m => ({ default: m.PaymentsPage })));
const ProvidersPage = lazy(() => import('./pages/admin/ProvidersPage').then(m => ({ default: m.ProvidersPage })));
const InquiriesPage = lazy(() => import('./pages/admin/InquiriesPage').then(m => ({ default: m.InquiriesPage })));
const WebsiteContentPage = lazy(() => import('./pages/admin/WebsiteContentPage').then(m => ({ default: m.WebsiteContentPage })));
const NotificationsPage = lazy(() => import('./pages/admin/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ProfilePage = lazy(() => import('./pages/admin/ProfilePage').then(m => ({ default: m.ProfilePage })));
const AppointmentTimePage = lazy(() => import('./pages/admin/AppointmentTimePage').then(m => ({ default: m.AppointmentTimePage || m.default })));
const PatientProfilePage = lazy(() => import('./pages/admin/PatientProfilePage').then(m => ({ default: m.PatientProfilePage || m.default })));
const OrderDetailsPage = lazy(() => import('./pages/admin/OrderDetailsPage').then(m => ({ default: m.OrderDetailsPage || m.default })));

// ── Lightweight Page Suspense Fallback ──
const PageLoader = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      width: '100%',
      gap: '12px'
    }}
  >
    <div
      style={{
        width: '36px',
        height: '36px',
        border: '3px solid rgba(30, 90, 168, 0.12)',
        borderTop: '3px solid #1e5aa8',
        borderRadius: '50%',
        animation: 'boSpin 0.7s linear infinite'
      }}
    />
    <style>{`
      @keyframes boSpin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

export function App() {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <AdminDataProvider>
          <ScrollToTop />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: {
                background: '#0f2942',
                color: '#ffffff',
                fontSize: '0.86rem',
                fontWeight: 500,
                borderRadius: '8px',
                padding: '10px 16px',
                boxShadow: '0 8px 24px rgba(15, 41, 66, 0.2)',
              },
              success: {
                iconTheme: {
                  primary: '#16a34a',
                  secondary: '#ffffff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#dc2626',
                  secondary: '#ffffff',
                },
              },
            }}
          />
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* ── Public Website (no auth required) ── */}
                <Route path="/home" element={<PublicWebsitePage />} />
                <Route path="/public" element={<PublicWebsitePage />} />
                <Route path="/website" element={<PublicWebsitePage />} />

                {/* Login Route */}
                <Route path="/login" element={<AdminLoginPage />} />
                <Route path="/admin/login" element={<AdminLoginPage />} />
                <Route path="/signup" element={<SignUpPage />} />
                <Route path="/admin/signup" element={<SignUpPage />} />

                {/* Protected Dashboard Shell (Root Routes) */}
                <Route element={<AdminLayout />}>
                  <Route path="/" element={<AdminDashboardPage />} />
                  <Route path="/dashboard" element={<AdminDashboardPage />} />
                  <Route path="/appointments" element={<AppointmentsPage />} />
                  <Route path="/appointment-times" element={<AppointmentTimePage />} />
                  <Route path="/clients" element={<ClientsPage />} />
                  <Route path="/patients/:patientId" element={<PatientProfilePage />} />
                  <Route path="/clients/:patientId" element={<PatientProfilePage />} />
                  <Route path="/services" element={<ServicesPage />} />
                  <Route path="/products" element={<ProductsPage />} />
                  <Route path="/coupons" element={<CouponsPage />} />
                  <Route path="/orders" element={<OrdersPage />} />
                  <Route path="/orders/:orderId" element={<OrderDetailsPage />} />
                  <Route path="/payments" element={<PaymentsPage />} />
                  <Route path="/providers" element={<ProvidersPage />} />
                  <Route path="/inquiries" element={<InquiriesPage />} />
                  <Route path="/content" element={<WebsiteContentPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/users" element={<AdminUsersPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />

                  {/* Aliases for /admin/* paths for compatibility */}
                  <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
                  <Route path="/admin/appointments" element={<AppointmentsPage />} />
                  <Route path="/admin/appointment-times" element={<AppointmentTimePage />} />
                  <Route path="/admin/clients" element={<ClientsPage />} />
                  <Route path="/admin/patients/:patientId" element={<PatientProfilePage />} />
                  <Route path="/admin/clients/:patientId" element={<PatientProfilePage />} />
                  <Route path="/admin/services" element={<ServicesPage />} />
                  <Route path="/admin/products" element={<ProductsPage />} />
                  <Route path="/admin/coupons" element={<CouponsPage />} />
                  <Route path="/admin/orders" element={<OrdersPage />} />
                  <Route path="/admin/orders/:orderId" element={<OrderDetailsPage />} />
                  <Route path="/admin/payments" element={<PaymentsPage />} />
                  <Route path="/admin/providers" element={<ProvidersPage />} />
                  <Route path="/admin/inquiries" element={<InquiriesPage />} />
                  <Route path="/admin/content" element={<WebsiteContentPage />} />
                  <Route path="/admin/notifications" element={<NotificationsPage />} />
                  <Route path="/admin/users" element={<AdminUsersPage />} />
                  <Route path="/admin/settings" element={<SettingsPage />} />
                  <Route path="/admin/profile" element={<ProfilePage />} />
                </Route>

                {/* Catch-all fallback directly to dashboard */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </AdminDataProvider>
      </AdminAuthProvider>
    </BrowserRouter>
  );
}

export default App;
