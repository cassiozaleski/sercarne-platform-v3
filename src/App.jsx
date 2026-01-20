import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoginPage from '@/pages/LoginPage';
import AdminDashboard from '@/pages/AdminDashboard';
import VendedorDashboard from '@/pages/VendedorDashboard';
import ClienteDashboard from '@/pages/ClienteDashboard';
import OrderReservationPage from '@/pages/OrderReservationPage';
import ConfirmacaoPedidoPublica from '@/pages/ConfirmacaoPedidoPublica';
import '@/styles/theme.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin', 'Admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Alias de rotas internas (definidas na aba USUARIOS) */}
          <Route
            path="/gestorcomercial"
            element={
              <ProtectedRoute allowedRoles={['gestorcomercial','admin']}>
                <VendedorDashboard />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/vendedor"
            element={
              <ProtectedRoute allowedRoles={['vendor','vendedor','representantepj','gestorcomercial','admin']}>
                <VendedorDashboard />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/cliente"
            element={
              <ProtectedRoute allowedRoles={['public', 'cliente', 'Cliente', 'vendor', 'admin']}>
                <ClienteDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/cliente_b2b"
            element={
              <ProtectedRoute allowedRoles={['cliente_b2b','vendor','admin','public']}>
                <ClienteDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/cliente_b2c"
            element={
              <ProtectedRoute allowedRoles={['cliente_b2c','vendor','admin','public']}>
                <ClienteDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/pedido-reservado/:id"
            element={
              <ProtectedRoute allowedRoles={['public', 'cliente', 'Cliente', 'vendor', 'admin']}>
                <OrderReservationPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/confirmar/:orderId/:token"
            element={<ConfirmacaoPedidoPublica />}
          />
          
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster />
      </Router>
    </AuthProvider>
  );
}

export default App;