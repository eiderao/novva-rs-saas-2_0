import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase/client';
import { useNavigate } from 'react-router-dom'; // Navegação necessária
import CreateJobModal from '../components/jobs/CreateJobModal';
import { Briefcase, Users, Plus, AlertTriangle, Settings } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deptFilter, setDeptFilter] = useState('all');
  const [fixing, setFixing] = useState(false); // Estado para o botão de reparo

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Busca Perfil
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfile(userProfile);

      // 2. Se tiver Tenant, busca vagas e departamentos
      if (userProfile?.tenantId) {
        const [jobsResult, deptsResult] = await Promise.all([
          supabase.from('jobs').select('*').eq('tenantId', userProfile.tenantId),
          supabase.from('company_departments').select('*').eq('tenantId', userProfile.tenantId)
        ]);

        const rawJobs = jobsResult.data || [];
        const depts = deptsResult.data || [];
        
        // Mapeamento de Departamentos
        const deptMap = {};
        depts.forEach(d => deptMap[d.id] = d.name);

        const processed = rawJobs.map(j => ({
          ...j,
          deptName: j.company_department_id ? (deptMap[j.company_department_id] || 'Geral') : 'Geral'
        }));

        // Ordenação: Data de criação (mais recente primeiro)
        processed.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setJobs(processed);
      }
    } catch (error) {
      console.error("Erro ao carregar:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- LÓGICA DE AUTO-REPARO (Para novos usuários vindos do Registro) ---
  const fixAccount = async () => {
    setFixing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
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
          name: user.email.split('@')[0],
          "tenantId": newTenant.id
        });
      if (pError) throw pError;

      alert("Conta configurada com sucesso!");
      fetchData(); // Recarrega a tela
    } catch (err) {
      alert("Erro ao configurar: " + err.message);
    } finally {
      setFixing(false);
    }
  };

  // Filtros
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
              {profile?.name || 'Usuário'}
            </span>
            <button onClick={() => supabase.auth.signOut()} className="text-red-500 hover:underline ml-2">
              Sair
            </button>
          </div>
        </div>
        
        {/* Botão Nova Vaga só aparece se tiver conta configurada */}
        {profile?.tenantId && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center shadow transition"
          >
            <Plus className="w-4 h-4 mr-2" /> Nova Vaga
          </button>
        )}
      </div>

      {/* --- CENÁRIO 1: CONTA NOVA (SEM EMPRESA) --- */}
      {!profile?.tenantId ? (
        <div className="bg-yellow-50 border border-yellow-200 p-8 rounded-lg text-center shadow-sm max-w-2xl mx-auto">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-yellow-100 rounded-full text-yellow-600">
              <Settings size={32} />
            </div>
          </div>
          <h2 className="text-xl font-bold text-yellow-800 mb-2">Finalizar Configuração da Conta</h2>
          <p className="text-yellow-700 mb-6">
            Bem-vindo ao Novva R&S! Para começar a criar vagas, precisamos configurar seu ambiente de trabalho (Empresa).
          </p>
          <button 
            onClick={fixAccount} 
            disabled={fixing}
            className="bg-yellow-600 text-white px-6 py-3 rounded-md font-bold hover:bg-yellow-700 shadow transition flex items-center justify-center gap-2 mx-auto"
          >
            {fixing ? 'Configurando...' : (
              <>
                <Settings className="w-4 h-4" /> Configurar Automaticamente
              </>
            )}
          </button>
        </div>
      ) : (
        /* --- CENÁRIO 2: DASHBOARD OPERACIONAL --- */
        <>
          {/* KPIs */}
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
                <p className="text-sm text-gray-500">Total Vagas</p>
                <p className="text-2xl font-bold">{jobs.length}</p>
              </div>
            </div>
          </div>

          {/* Lista de Vagas */}
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
                  <th className="p-4 font-medium">Modelo</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.length === 0 ? (
                  <tr><td colSpan="5" className="p-8 text-center text-gray-500">Nenhuma vaga encontrada.</td></tr>
                ) : (
                  filteredJobs.map(job => (
                    <tr 
                      key={job.id} 
                      onClick={() => navigate(`/jobs/${job.id}`)} // AQUI ESTÁ O CLIQUE
                      className="border-b hover:bg-blue-50 transition cursor-pointer group"
                    >
                      <td className="p-4 text-gray-600">{job.deptName}</td>
                      <td className="p-4 font-bold text-gray-800 group-hover:text-blue-600">{job.title}</td>
                      <td className="p-4 text-gray-600">{job.location_type}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${job.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {job.status === 'active' ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>
                      <td className="p-4 text-right text-blue-600 font-medium">
                        Gerenciar →
                      </td>
                    </tr>
                  ))
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