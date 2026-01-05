import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase/client';
import { useNavigate } from 'react-router-dom';
import CreateJobModal from '../components/jobs/CreateJobModal';
import { Briefcase, Users, Plus, Settings as SettingsIcon, Clock, Link as LinkIcon, CheckCircle, Ban } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';

export default function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deptFilter, setDeptFilter] = useState('all');
  const [fixing, setFixing] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfile(userProfile);

      if (userProfile?.tenantId) {
        const { data: tenantData } = await supabase
            .from('tenants')
            .select('companyName')
            .eq('id', userProfile.tenantId)
            .single();
        
        if (tenantData) setCompanyName(tenantData.companyName);

        const [jobsResult, deptsResult] = await Promise.all([
          supabase.from('jobs').select('*, applications(count)').eq('tenantId', userProfile.tenantId),
          supabase.from('company_departments').select('*').eq('tenantId', userProfile.tenantId)
        ]);

        const rawJobs = jobsResult.data || [];
        const depts = deptsResult.data || [];
        
        const deptMap = {};
        depts.forEach(d => deptMap[d.id] = d.name);

        const processed = rawJobs.map(j => ({
          ...j,
          deptName: j.company_department_id ? (deptMap[j.company_department_id] || 'Geral') : 'Geral',
          candidateCount: j.applications?.[0]?.count || 0,
          daysOpen: differenceInDays(new Date(), parseISO(j.created_at))
        }));

        processed.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setJobs(processed);
      }
    } catch (error) {
      console.error("Erro ao carregar:", error);
    } finally {
      setLoading(false);
    }
  };

  const fixAccount = async () => {
    setFixing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: newTenant, error: tError } = await supabase
        .from('tenants')
        .insert({ "companyName": "Minha Empresa" })
        .select()
        .single();
      if (tError) throw tError;

      const { error: pError } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          name: user.email.split('@')[0],
          "tenantId": newTenant.id,
          role: 'admin'
        });
      if (pError) throw pError;

      await supabase.from('user_tenants').insert({
          user_id: user.id,
          tenant_id: newTenant.id,
          role: 'admin'
      });

      alert("Conta configurada com sucesso!");
      fetchData();
    } catch (err) {
      alert("Erro ao configurar: " + err.message);
    } finally {
      setFixing(false);
    }
  };

  const copyJobLink = (e, job) => {
    e.stopPropagation();
    // Bloqueio extra no clique
    if (job.status !== 'active') return;

    const link = `${window.location.origin}/apply/${job.id}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(job.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Helper para Status (Texto e Cor)
  const getStatusConfig = (status) => {
    switch (status) {
        case 'active': return { label: 'Ativa', classes: 'bg-green-100 text-green-800 border-green-200' };
        case 'inactive': return { label: 'Inativa', classes: 'bg-gray-100 text-gray-600 border-gray-200' };
        case 'filled': return { label: 'Preenchida', classes: 'bg-blue-100 text-blue-800 border-blue-200' };
        case 'suspended': return { label: 'Suspensa', classes: 'bg-orange-100 text-orange-800 border-orange-200' };
        case 'cancelled': return { label: 'Cancelada', classes: 'bg-red-100 text-red-800 border-red-200' };
        default: return { label: status, classes: 'bg-gray-100 text-gray-600' };
    }
  };

  const filteredJobs = useMemo(() => {
    if (deptFilter === 'all') return jobs;
    return jobs.filter(j => j.deptName === deptFilter);
  }, [jobs, deptFilter]);

  const uniqueDepts = [...new Set(jobs.map(j => j.deptName))].sort();

  if (loading) return <div className="p-10 text-center">Carregando Dashboard...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">
               {companyName ? `${companyName} / ` : ''}{profile?.name || 'Usuário'}
            </span>
            <span className="text-gray-300">|</span>
            <button onClick={() => navigate('/settings')} className="text-gray-600 hover:text-blue-600 flex items-center gap-1">
               <SettingsIcon size={14} /> Configurações
            </button>
            <span className="text-gray-300">|</span>
            <button onClick={() => supabase.auth.signOut()} className="text-red-500 hover:underline">
              Sair
            </button>
          </div>
        </div>
        
        {profile?.tenantId && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center shadow transition"
          >
            <Plus className="w-4 h-4 mr-2" /> Nova Vaga
          </button>
        )}
      </div>

      {!profile?.tenantId ? (
        <div className="bg-yellow-50 border border-yellow-200 p-8 rounded-lg text-center shadow-sm max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-yellow-800 mb-2">Finalizar Configuração da Conta</h2>
          <p className="text-yellow-700 mb-6">
            Bem-vindo ao Novva R&S! Para começar, precisamos configurar sua empresa.
          </p>
          <button 
            onClick={fixAccount} 
            disabled={fixing}
            className="bg-yellow-600 text-white px-6 py-3 rounded-md font-bold hover:bg-yellow-700 shadow transition"
          >
            {fixing ? 'Configurando...' : '⚙️ Configurar Minha Empresa Agora'}
          </button>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white p-6 rounded shadow border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-full"><Briefcase size={24}/></div>
              <div>
                <p className="text-sm text-gray-500">Vagas Ativas</p>
                <p className="text-2xl font-bold">{jobs.filter(j => j.status === 'active').length}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded shadow border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-green-100 text-green-600 rounded-full"><Users size={24}/></div>
              <div>
                <p className="text-sm text-gray-500">Total Candidatos</p>
                <p className="text-2xl font-bold">{jobs.reduce((acc, j) => acc + j.candidateCount, 0)}</p>
              </div>
            </div>
          </div>

          {/* Tabela de Vagas */}
          <div className="bg-white rounded shadow border overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h2 className="font-semibold text-gray-700">Listagem de Vagas</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Filtrar:</span>
                <select 
                  className="border p-1 rounded text-sm bg-white outline-none"
                  value={deptFilter}
                  onChange={e => setDeptFilter(e.target.value)}
                >
                  <option value="all">Todas as Áreas</option>
                  {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 border-b">
                <tr>
                  <th className="p-4 font-medium">Área / Depto</th>
                  <th className="p-4 font-medium">Título</th>
                  <th className="p-4 font-medium text-center">Inscritos</th>
                  <th className="p-4 font-medium text-center">Tempo</th>
                  <th className="p-4 font-medium text-center">Divulgação</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.length === 0 ? (
                  <tr><td colSpan="7" className="p-8 text-center text-gray-500">Nenhuma vaga encontrada.</td></tr>
                ) : (
                  filteredJobs.map(job => {
                    const statusConfig = getStatusConfig(job.status);
                    const isActive = job.status === 'active';

                    return (
                        <tr 
                          key={job.id} 
                          onClick={() => navigate(`/jobs/${job.id}`)}
                          className="border-b hover:bg-blue-50 transition cursor-pointer group"
                        >
                          <td className="p-4 text-gray-600">{job.deptName}</td>
                          <td className="p-4 font-bold text-gray-800 group-hover:text-blue-600">{job.title}</td>
                          
                          <td className="p-4 text-center">
                              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-bold text-xs">{job.candidateCount}</span>
                          </td>
                          <td className="p-4 text-center text-gray-500">
                              <div className="flex items-center justify-center gap-1">
                                <Clock size={14}/> {job.daysOpen} dias
                              </div>
                          </td>

                          {/* BOTÃO DE LINK (Bloqueado se não estiver ativo) */}
                          <td className="p-4 text-center">
                            <button 
                              onClick={(e) => copyJobLink(e, job)}
                              disabled={!isActive}
                              className={`p-1.5 rounded transition ${
                                copiedId === job.id 
                                ? 'bg-green-100 text-green-700' 
                                : isActive 
                                    ? 'text-gray-400 hover:text-blue-600 hover:bg-white border border-transparent hover:border-gray-200' 
                                    : 'text-gray-200 cursor-not-allowed'
                              }`}
                              title={isActive ? "Copiar Link para Candidatos" : "Vaga inativa - Link indisponível"}
                            >
                              {copiedId === job.id ? <CheckCircle size={16}/> : isActive ? <LinkIcon size={16}/> : <Ban size={16}/>}
                            </button>
                          </td>

                          <td className="p-4">
                            <span className={`px-2 py-1 rounded text-xs font-semibold border ${statusConfig.classes}`}>
                              {statusConfig.label}
                            </span>
                          </td>
                          <td className="p-4 text-right text-blue-600 font-medium">
                            Gerenciar →
                          </td>
                        </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <CreateJobModal 
        open={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchData} 
      />
    </div>
  );
}