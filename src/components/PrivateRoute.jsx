import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PrivateRoute() {
  const { user, loading } = useAuth();

  // 1. Enquanto verifica o login, mostra um spinner para não "piscar" a tela de login
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // 2. Regra de Negócio: Se tem user, libera o acesso (Outlet). Se não, chuta pro Login.
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}