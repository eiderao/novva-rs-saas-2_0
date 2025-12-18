// src/App.jsx (Versão com Rota /admin/tenant/:tenantId)
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

import LoginPage from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import JobDetails from './pages/JobDetails.jsx';
import ApplicationDetails from './pages/ApplicationDetails.jsx';
import ApplyPage from './pages/ApplyPage.jsx';
import HiredPage from './pages/HiredPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import AdminTenantPage from './pages/AdminTenantPage.jsx'; // ADICIONADO
import LoadingSpinner from './components/common/LoadingSpinner.jsx';

// Agrupa as rotas do usuário padrão
const ProtectedRoutes = () => (
  <Routes>
    <Route path="/" element={<Dashboard />} />
    <Route path="/vaga/:jobId" element={<JobDetails />} />
    <Route path="/vaga/:jobId/candidato/:applicationId" element={<ApplicationDetails />} />
    <Route path="/aprovados" element={<HiredPage />} />
    <Route path="/admin" element={<AdminPage />} />
    <Route path="/admin/tenant/:tenantId" element={<AdminTenantPage />} /> {/* ADICIONADO */}
  </Routes>
);

function App() {
    const { currentUser, loading } = useAuth();

    if (loading) {
        return <LoadingSpinner />;
    }

    return (
        <Routes>
            {/* ROTA PÚBLICA */}
            <Route path="/vaga/:jobId/apply" element={<ApplyPage />} />

            {/* ROTAS PRIVADAS */}
            <Route path="/*" element={currentUser ? <ProtectedRoutes /> : <LoginPage />} />
        </Routes>
    );
}

export default App;