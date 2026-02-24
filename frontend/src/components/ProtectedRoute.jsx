import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { roleDefaultPath, useAuth } from '../context/AuthContext';
import LoadingState from './LoadingState';

function ProtectedRoute({ roles }) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingState label="Validating session..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return <Navigate to={roleDefaultPath(user.role)} replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
