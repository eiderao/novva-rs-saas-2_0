import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './common/LoadingSpinner';

export default function PrivateRoute() {
  // CORREÇÃO: Mudado de 'user' para 'currentUser' para bater com o AuthContext
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  // Se tem usuário, libera. Se não, manda pro login.
  return currentUser ? <Outlet /> : <Navigate to="/login" replace />;
}