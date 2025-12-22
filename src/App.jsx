import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabase/client';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import JobDetails from './pages/JobDetails'; // Vamos criar este no próximo passo para fechar o link
import ApplicationDetails from './pages/ApplicationDetails'; // Adicionado agora

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

  if (loading) return <div className="p-10 text-center">Carregando...</div>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        
        {/* Rotas Protegidas */}
        <Route path="/" element={session ? <Dashboard /> : <Navigate to="/login" />} />
        
        {/* Detalhe da Vaga (Listar Candidatos) */}
        <Route path="/jobs/:jobId" element={session ? <JobDetails /> : <Navigate to="/login" />} />
        
        {/* Detalhe da Aplicação (Avaliar Candidato) */}
        <Route path="/applications/:appId" element={session ? <ApplicationDetails /> : <Navigate to="/login" />} />
        
      </Routes>
    </BrowserRouter>
  );
}