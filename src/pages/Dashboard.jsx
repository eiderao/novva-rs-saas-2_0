import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Busca Perfil
    let { data: userProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    setProfile(userProfile);

    // 2. Se tiver Tenant, busca vagas
    if (userProfile?.tenantId) {
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('*')
        .eq('tenantId', userProfile.tenantId);
      setJobs(jobsData || []);
    }
    setLoading(false);
  };

  // --- FUNÇÃO DE AUTO-REPARO ---
  const fixAccount = async () => {
    setFixing(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    try {
      // 1. Cria Empresa
      const { data: newTenant, error: tError } = await supabase
        .from('tenants')
        .insert({ "companyName": "Minha Empresa" })
        .select()
        .single();
      if (tError) throw tError;

      // 2. Vincula Usuário à Empresa
      const { error: pError } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          name: user.email,
          "tenantId": newTenant.id
        });
      if (pError) throw pError;

      alert("Conta configurada com sucesso!");
      fetchData(); // Recarrega tudo
    } catch (err) {
      alert("Erro ao configurar: " + err.message);
    } finally {
      setFixing(false);
    }
  };

  const createTestJob = async () => {
    if (!profile?.tenantId) return;
    const { error } = await supabase.from('jobs').insert({
      title: "Vaga Teste",
      status: "active",
      "tenantId": profile.tenantId, // ID CORRETO AGORA
      description: "Teste"
    });
    if (error) alert(error.message);
    else fetchData();
  };

  if (loading) return <div className="p-10 text-center">Carregando...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8 border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard de Recuperação</h1>
        <button onClick={() => supabase.auth.signOut()} className="text-red-500">Sair</button>
      </div>

      {/* CENÁRIO 1: USUÁRIO QUEBRADO (Sem Empresa) */}
      {!profile?.tenantId ? (
        <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg text-center">
          <h2 className="text-xl font-bold text-yellow-800 mb-2">Atenção: Configuração Pendente</h2>
          <p className="text-yellow-700 mb-4">Seu usuário existe, mas não está vinculado a uma empresa. Isso impede a criação de vagas.</p>
          <button 
            onClick={fixAccount} 
            disabled={fixing}
            className="bg-yellow-600 text-white px-6 py-3 rounded-md font-bold hover:bg-yellow-700"
          >
            {fixing ? 'Consertando...' : '⚙️ Corrigir Minha Conta Agora'}
          </button>
        </div>
      ) : (
        /* CENÁRIO 2: USUÁRIO CORRIGIDO (Dashboard Funcional) */
        <div>
          <div className="bg-green-50 border border-green-200 p-4 rounded-md mb-6 flex justify-between items-center">
            <div>
              <p className="text-green-800 font-bold">Sistema Operacional</p>
              <p className="text-sm text-green-700">Empresa ID: {profile.tenantId}</p>
            </div>
            <button onClick={createTestJob} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
              + Criar Vaga
            </button>
          </div>

          <h3 className="font-bold text-lg mb-4">Suas Vagas</h3>
          {jobs.length === 0 ? <p className="text-gray-500">Nenhuma vaga encontrada.</p> : (
            <ul className="space-y-2">
              {jobs.map(job => (
                <li key={job.id} className="p-4 border rounded bg-white shadow-sm">
                  <strong>{job.title}</strong> - <span className="text-sm text-gray-500">{job.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}