import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabase/client';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import JobDetails from './pages/JobDetails';
import ApplicationDetails from './pages/ApplicationDetails';
import Settings from './pages/Settings';
import ApplyJob from './pages/ApplyJob'; // NOVO IMPORT
import SuperAdminDashboard from './pages/SuperAdminDashboard';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="p-10 text-center">Carregando Sistema...</div>;

  return (
    <BrowserRouter>
      <Routes>
        {/* ROTAS PÚBLICAS (Candidatos) */}
        <Route path="/apply/:jobId" element={<ApplyJob />} />

        {/* ROTAS DE AUTENTICAÇÃO */}
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        <Route path="/register" element={!session ? <Register /> : <Navigate to="/" />} />
        
        {/* ROTAS PROTEGIDAS (Admin/Recrutador) */}
        <Route path="/" element={session ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/jobs/:jobId" element={session ? <JobDetails /> : <Navigate to="/login" />} />
        <Route path="/applications/:appId" element={session ? <ApplicationDetails /> : <Navigate to="/login" />} />
        <Route path="/settings" element={session ? <Settings /> : <Navigate to="/login" />} />
        <Route path="/admin/super" element={session ? <SuperAdminDashboard /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}