import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase/client';
import CreateJobModal from '../components/jobs/CreateJobModal';
import { Briefcase, Users, Plus } from 'lucide-react';

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deptFilter, setDeptFilter] = useState('all');

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

      if (userProfile?.tenantId) {
        // 2. Busca Vagas e Departamentos separadamente (Segurança contra erro de FK)
        const [jobsResult, deptsResult] = await Promise.all([
          supabase.from('jobs').select('*').eq('tenantId', userProfile.tenantId),
          supabase.from('company_departments').select('*').eq('tenantId', userProfile.tenantId)
        ]);

        const rawJobs = jobsResult.data || [];
        const depts = deptsResult.data || [];

        // 3. Cruzamento Manual dos Dados
        const deptMap = {};
        depts.forEach(d => deptMap[d.id] = d.name);

        const processed = rawJobs.map(j => ({
          ...j,
          // Se tiver ID de depto, usa o nome do mapa. Senão 'Geral'
          deptName: j.company_department_id ? (deptMap[j.company_department_id] || 'Geral') : 'Geral'
        }));

        // 4. Ordenação (Regra 5: Depto -> Data)
        processed.sort((a, b) => {
          const deptCompare = a.deptName.localeCompare(b.deptName);
          if (deptCompare !== 0) return deptCompare;
          return new Date(b.created_at) - new Date(a.created_at);
        });

        setJobs(processed);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Filtro
  const filteredJobs = useMemo(() => {
    if (deptFilter === 'all') return jobs;
    return jobs.filter(j => j.deptName === deptFilter);
  }, [jobs, deptFilter]);

  const uniqueDepts = [...new Set(jobs.map(j => j.deptName))].sort();

  if (loading) return <div className="p-10 text-center">Carregando...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard de Vagas</h1>
          <p className="text-sm text-gray-500">
            {profile?.name || 'Usuário'} | Tenant: {profile?.tenantId || '...'}
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center shadow"
        >
          <Plus className="w-4 h-4 mr-2" /> Nova Vaga
        </button>
      </div>

      {/* Estatísticas Simples */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-6 rounded shadow border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-full"><Briefcase size={24}/></div>
          <div><p className="text-sm text-gray-500">Vagas Ativas</p><p className="text-2xl font-bold">{jobs.filter(j => j.status === 'active').length}</p></div>
        </div>
        <div className="bg-white p-6 rounded shadow border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-green-100 text-green-600 rounded-full"><Users size={24}/></div>
          <div><p className="text-sm text-gray-500">Total Vagas</p><p className="text-2xl font-bold">{jobs.length}</p></div>
        </div>
      </div>

      {/* Lista com Filtro */}
      <div className="bg-white rounded shadow border overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
          <h2 className="font-semibold text-gray-700">Listagem de Vagas</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Filtrar por Área:</span>
            <select 
              className="border p-1 rounded text-sm bg-white"
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
            >
              <option value="all">Todas</option>
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
            </tr>
          </thead>
          <tbody>
            {filteredJobs.length === 0 ? (
              <tr><td colSpan="4" className="p-8 text-center text-gray-500">Nenhuma vaga encontrada.</td></tr>
            ) : (
              filteredJobs.map(job => (
                <tr key={job.id} className="border-b hover:bg-gray-50 transition cursor-default">
                  <td className="p-4 text-gray-600">{job.deptName}</td>
                  <td className="p-4 font-bold text-gray-800">{job.title}</td>
                  <td className="p-4 text-gray-600">{job.location_type}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${job.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {job.status === 'active' ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CreateJobModal 
        open={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchData} 
      />
    </div>
  );
}