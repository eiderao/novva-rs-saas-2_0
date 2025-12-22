import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { useAuth } from '../context/AuthContext';
import { Plus, Briefcase, Users, Building } from 'lucide-react';
import { Button } from '../components/ui/button'; // Se não tiver, use HTML button normal temporariamente
import CreateJobModal from '../components/jobs/CreateJobModal';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [departments, setDepartments] = useState({});
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Filtros
  const [deptFilter, setDeptFilter] = useState('all');

  const fetchData = async () => {
    try {
      setLoading(true);
      if (!user) return;

      // 1. Busca Tenant ID
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tenantId')
        .eq('id', user.id)
        .single();

      if (!profile) return;

      // 2. Busca Departamentos (Para mapear ID -> Nome)
      const { data: depts } = await supabase
        .from('company_departments')
        .select('id, name')
        .eq('tenantId', profile.tenantId);
      
      const deptMap = {};
      depts?.forEach(d => deptMap[d.id] = d.name);
      setDepartments(deptMap);

      // 3. Busca Vagas
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('*, applications(count)')
        .eq('tenantId', profile.tenantId);

      // Processa e Ordena (Regra 5)
      const processed = (jobsData || []).map(j => ({
        ...j,
        deptName: deptMap[j.company_department_id] || 'Geral',
        candidateCount: j.applications?.[0]?.count || 0
      })).sort((a, b) => {
        // Ordem: Depto (A-Z) -> Data (Desc)
        const deptCompare = a.deptName.localeCompare(b.deptName);
        if (deptCompare !== 0) return deptCompare;
        return new Date(b.created_at) - new Date(a.created_at);
      });

      setJobs(processed);

    } catch (error) {
      console.error("Erro Dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  const filteredJobs = useMemo(() => {
    return deptFilter === 'all' 
      ? jobs 
      : jobs.filter(j => j.deptName === deptFilter);
  }, [jobs, deptFilter]);

  const uniqueDepts = [...new Set(Object.values(departments))].sort();

  if (loading) return <div className="p-10 text-center">Carregando...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Painel de Vagas</h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2"/> Nova Vaga
        </button>
      </div>

      {/* Filtros e KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-4 rounded shadow border">
          <p className="text-sm text-gray-500">Vagas Ativas</p>
          <p className="text-2xl font-bold">{jobs.filter(j => j.status === 'active').length}</p>
        </div>
        <div className="bg-white p-4 rounded shadow border">
          <p className="text-sm text-gray-500">Total Candidatos</p>
          <p className="text-2xl font-bold">{jobs.reduce((acc, j) => acc + j.candidateCount, 0)}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
          <h2 className="font-semibold text-gray-700">Listagem</h2>
          <select 
            className="border rounded p-1 text-sm"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="all">Todos Departamentos</option>
            {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500 border-b">
            <tr>
              <th className="p-4">Empresa / Área</th>
              <th className="p-4">Vaga</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-center">Candidatos</th>
            </tr>
          </thead>
          <tbody>
            {filteredJobs.map(job => (
              <tr 
                key={job.id} 
                className="border-b hover:bg-gray-50 cursor-pointer transition"
                onClick={() => navigate(`/jobs/${job.id}`)}
              >
                <td className="p-4 text-gray-600 font-medium">
                  {/* Assumindo nome fixo da empresa por enquanto para simplificar */}
                  Novva <span className="text-gray-300 mx-1">/</span> {job.deptName}
                </td>
                <td className="p-4 font-semibold text-blue-600">{job.title}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${job.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
                    {job.status === 'active' ? 'Ativa' : 'Fechada'}
                  </span>
                </td>
                <td className="p-4 text-center">
                  <span className="bg-gray-100 px-2 py-1 rounded text-xs">{job.candidateCount}</span>
                </td>
              </tr>
            ))}
            {filteredJobs.length === 0 && (
              <tr><td colSpan="4" className="p-8 text-center text-gray-500">Nenhuma vaga encontrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <CreateJobModal 
        open={isModalOpen} 
        handleClose={() => setIsModalOpen(false)} 
        onJobCreated={fetchData} 
      />
    </div>
  );
}