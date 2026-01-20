import { Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

function PrivateRoute({ children, role }) {
  const { user, loading } = useAuth();

  if (loading) return null; // ⛔ ESSENCIAL (mata o pisca-pisca)

  if (!user) return <Navigate to="/" replace />;

  if (role && user.role !== role) {
    return <Navigate to={user.homePath || '/'} replace />;
  }

  return children;
}
