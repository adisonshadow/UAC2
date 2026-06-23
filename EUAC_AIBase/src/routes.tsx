import { AIChatDisplay } from '@euac/ai-base';
import { Navigate, Route, Routes } from 'react-router-dom';
import AuthGate from '@/auth/AuthGate';
import AuthCallback from '@/auth/AuthCallback';
import LoginPage from '@/auth/LoginPage';
import AppShell from '@/layout/AppShell';
import DashboardPage from '@/pages/demo/Dashboard';
import OrdersPage from '@/pages/demo/Orders';
import UsersPage from '@/pages/demo/Users';
import ProductsPage from '@/pages/demo/Products';
import ComplaintsPage from '@/pages/demo/Complaints';

export default function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/auth/login"
        element={
          <AIChatDisplay mode="hidden">
            <LoginPage />
          </AIChatDisplay>
        }
      />
      <Route
        path="/auth/callback"
        element={
          <AIChatDisplay mode="hidden">
            <AuthCallback />
          </AIChatDisplay>
        }
      />
      <Route
        path="/"
        element={
          <AuthGate>
            <AppShell />
          </AuthGate>
        }
      >
        <Route index element={<Navigate to="/demo/dashboard" replace />} />
        <Route path="demo/dashboard" element={<DashboardPage />} />
        <Route path="demo/orders" element={<OrdersPage />} />
        <Route path="demo/users" element={<UsersPage />} />
        <Route path="demo/products" element={<ProductsPage />} />
        <Route path="demo/complaints" element={<ComplaintsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
