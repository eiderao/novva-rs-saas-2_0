import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { ArrowLeft, Users, Settings, Trash2, Save, AlertTriangle } from 'lucide-react';
import JobCriteria from '../components/jobs/JobCriteria';

export default function JobDetails() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('candidates'); // 'candidates' ou 'settings'
  const [statusLoading, setStatusLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [jobId]);

  const fetchData = async () => {
    setLoading(true);
    // 1. Vaga
    const { data: j, error } = await supabase.from('jobs').select('*').eq('id', jobId).single();
    
    if (error) {
      alert("Vaga não encontrada ou excluída.");
      navigate('/');
      return;
    }
    setJob(j);

    // 2. Candidatos
    const { data: apps } = await supabase
      .from('applications')
      .select('*, candidate:candidates(*)')
      .eq('jobId', jobId);
    
    setCandidates(apps || []);
    setLoading(false);
  };

  const createFakeCandidate = async () => {
    const { data: cand } = await supabase.from('candidates').select('id').limit(1).single();
    if(cand) {
        await supabase.from('applications').insert({
            jobId: jobId,
            candidateId: cand.id,
            status: 'new',
            formData: { motivation: "Quero muito essa vaga!" }
        });
        fetchData();
    } else {
        alert("Rode o SQL de inserção de candidato fictício primeiro!");
    }
  };

  // --- FUNÇÕES DE GERENCIAMENTO ---

  const handleStatusChange = async (newStatus) => {
    setStatusLoading(true);
    const { error } = await supabase
      .from('jobs')
      .update({ status: newStatus })
      .eq('id', jobId);

    if (error) {
      alert("Erro ao atualizar status: " + error.message);
    } else {
      setJob({ ...job, status: newStatus });
    }
    setStatusLoading(false);
  };

  const handleDeleteJob = async () => {
    const confirmDelete = window.confirm(
      "Tem certeza que deseja EXCLUIR esta vaga?\n\nIsso apagará todas as candidaturas e avaliações associadas permanentemente.\n\nEssa ação não pode ser desfeita."
    );

    if (confirmDelete) {
      setStatusLoading(true);
      const { error } = await supabase.from('jobs').delete().eq('id', jobId);

      if (error) {
        alert("Erro ao excluir: " + error.message);
        setStatusLoading(false);
      } else {
        alert("Vaga excluída com sucesso.");
        navigate('/'); // Volta para o Dashboard
      }
    }
  };

  // Helper para cores de status
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'closed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'canceled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active': return 'Ativa';
      case 'inactive': return 'Inativa (Pausada)';
      case 'closed': return 'Fechada (Preenchida)';
      case 'canceled': return 'Cancelada';
      default: return status;
    }
  };

  if (loading) return <div className="p-10 text-center">Carregando...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <button onClick={() => navigate('/')} className="flex items-center text-gray-500 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4 mr-2"/> Voltar para Dashboard
      </button>

      {/* Cabeçalho da Vaga */}
      <div className="flex justify-between items-start mb-6">
        <div>
           <div className="flex items-center gap-3 mb-1">
             <h1 className="text-3xl font-bold text-gray-900">{job?.title}</h1>
             <span className={`text-xs px-2 py-1 rounded border font-bold uppercase ${getStatusColor(job?.status)}`}>
               {getStatusLabel(job?.status)}
             </span>
           </div>
           <p className="text-gray-500">{job?.location_type} • {job?.type} • Criada em {new Date(job?.created_at).toLocaleDateString()}</p>
        </div>
        
        {/* Só permite simular candidato se a vaga estiver ativa */}
        {job?.status === 'active' && (
          <button onClick={createFakeCandidate} className="text-sm text-blue-600 underline hover:text-blue-800">
            + Simular Candidato
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b mb-6">
        <button 
          onClick={() => setActiveTab('candidates')}
          className={`pb-3 px-1 flex items-center gap-2 transition ${activeTab === 'candidates' ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Users size={18}/> Candidatos ({candidates.length})
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`pb-3 px-1 flex items-center gap-2 transition ${activeTab === 'settings' ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Settings size={18}/> Configurações
        </button>
      </div>

      {/* Conteúdo da Aba */}
      {activeTab === 'candidates' ? (
        <div className="bg-white rounded shadow border">
          {candidates.length === 0 ? (
            <div className="p-10 text-center text-gray-500">Nenhum candidato ainda.</div>
          ) : (
            candidates.map(app => (
              <div 
                key={app.id} 
                onClick={() => navigate(`/applications/${app.id}`)}
                className="p-4 border-b last:border-0 hover:bg-gray-50 cursor-pointer flex justify-between items-center group transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-bold group-hover:bg-blue-100 group-hover:text-blue-600">
                    {app.candidate?.name?.[0]}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{app.candidate?.name}</p>
                    <p className="text-xs text-gray-500">{app.candidate?.email}</p>
                  </div>
                </div>
                <div className="text-sm text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition">Avaliar →</div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* PAINEL DE STATUS E EXCLUSÃO */}
          <div className="bg-white rounded shadow border p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b">Gerenciamento da Vaga</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Coluna 1: Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status da Vaga</label>
                <div className="flex gap-2">
                  <select 
                    className="flex-1 border p-2 rounded bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={job.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={statusLoading}
                  >
                    <option value="active">Ativa (Recebendo candidatos)</option>
                    <option value="inactive">Inativa (Pausada)</option>
                    <option value="closed">Fechada (Vaga preenchida)</option>
                    <option value="canceled">Cancelada</option>
                  </select>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Vagas <strong>Ativas</strong> consomem o limite do seu plano. Inative ou Feche vagas antigas para liberar espaço.
                </p>
              </div>

              {/* Coluna 2: Zona de Perigo */}
              <div className="border-l pl-8 border-gray-100">
                 <h3 className="text-sm font-bold text-red-600 mb-2 flex items-center gap-2">
                   <AlertTriangle size={16}/> Zona de Perigo
                 </h3>
                 <p className="text-xs text-gray-500 mb-3">
                   A exclusão é irreversível. Todos os dados de candidatos vinculados a esta vaga serão perdidos.
                 </p>
                 <button 
                   onClick={handleDeleteJob}
                   disabled={statusLoading}
                   className="border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2 rounded text-sm font-medium flex items-center gap-2 transition w-full justify-center"
                 >
                   <Trash2 size={16}/> {statusLoading ? 'Processando...' : 'Excluir Vaga Permanentemente'}
                 </button>
              </div>
            </div>
          </div>

          {/* PAINEL DE CRITÉRIOS (REUTILIZADO) */}
          <div className="bg-white rounded shadow border p-6">
            <JobCriteria job={job} onUpdate={fetchData} />
          </div>
        </div>
      )}
    </div>
  );
}