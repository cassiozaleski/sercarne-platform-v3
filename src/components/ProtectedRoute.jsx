
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

// ✅ fallback de home por papel: evita loop quando a planilha tem homePath incompatível
function safeHomePath(user) {
  const role = String(user?.role || '').toLowerCase();
  if (role === 'admin') return '/admin';
  if (role === 'gestorcomercial') return '/gestorcomercial';
  if (['vendor', 'vendedor', 'representantepj'].includes(role)) return '/vendedor';
  if (role === 'cliente_b2b') return '/cliente_b2b';
  if (role === 'cliente_b2c') return '/cliente_b2c';
  return '/cliente';
}

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--orange-primary)', borderTopColor: 'transparent' }}></div>
          <p className="mt-4" style={{ color: 'var(--text-light)' }}>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    // Se o usuário está logado mas caiu numa rota sem permissão, manda ele para um home seguro.
    const target = (user?.homePath && String(user.homePath).startsWith('/')) ? user.homePath : safeHomePath(user);
    return <Navigate to={target} replace />;
  }

  return children;
};

export default ProtectedRoute;
