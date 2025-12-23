import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { ArrowLeft, Users, Settings, Trash2, Save, AlertTriangle, Share2, Copy } from 'lucide-react';
import JobCriteria from '../components/jobs/JobCriteria';
import AreaSelect from '../components/AreaSelect';

export default function JobDetails() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  
  // Estados de Dados
  const [job, setJob] = useState(null);
  const [candidates, setCandidates] = useState([]);
  
  // Estados de UI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false); // Para o botão de salvar dados
  const [statusLoading, setStatusLoading] = useState(false); // Para status/exclusão
  const [activeTab, setActiveTab] = useState('candidates'); 

  // Estado do Formulário de Edição
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requirements: '',
    type: 'CLT',
    location_type: 'Híbrido',
    company_department_id: ''
  });

  useEffect(() => {
    fetchData();
  }, [jobId]);

  const fetchData = async () => {
    setLoading(true);
    // 1. Busca Vaga
    const { data: j, error } = await supabase.from('jobs').select('*').eq('id', jobId).single();
    
    if (error) {
      alert("Vaga não encontrada ou excluída.");
      navigate('/');
      return;
    }
    setJob(j);
    
    // Preenche o formulário de edição com os dados atuais
    setFormData({
      title: j.title || '',
      description: j.description || '',
      requirements: j.requirements || '',
      type: j.type || 'CLT',
      location_type: j.location_type || 'Híbrido',
      company_department_id: j.company_department_id || ''
    });

    // 2. Busca Candidatos
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

  // --- NOVA FUNÇÃO: COPIAR LINK PÚBLICO ---
  const copyPublicLink = () => {
    const url = `${window.location.origin}/apply/${jobId}`;
    navigator.clipboard.writeText(url);
    alert("Link de candidatura copiado para a área de transferência!");
  };

  // --- AÇÃO: ATUALIZAR DADOS DA VAGA ---
  const handleUpdateJob = async (e) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
        ...formData,
        company_department_id: formData.company_department_id ? parseInt(formData.company_department_id) : null
    };

    const { error } = await supabase
      .from('jobs')
      .update(payload)
      .eq('id', jobId);

    if (error) {
      alert("Erro ao atualizar: " + error.message);
    } else {
      alert("Dados da vaga atualizados com sucesso!");
      // Atualiza o objeto job local para refletir no cabeçalho
      setJob({ ...job, ...payload });
    }
    setSaving(false);
  };

  // --- AÇÃO: MUDAR STATUS ---
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

  // --- AÇÃO: EXCLUIR VAGA ---
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
        navigate('/'); 
      }
    }
  };

  // Helpers Visuais
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
        
        <div className="flex gap-2">
            {/* BOTÃO DE COMPARTILHAR LINK */}
            {job?.status === 'active' && (
                <button 
                  onClick={copyPublicLink}
                  className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 font-medium text-sm transition border border-indigo-100"
                  title="Copiar link para candidatos"
                >
                    <Share2 size={16}/> Copiar Link
                </button>
            )}

            {/* BOTÃO DE SIMULAR INTERNAMENTE */}
            {job?.status === 'active' && (
              <button 
                onClick={createFakeCandidate} 
                className="text-sm text-blue-600 underline hover:text-blue-800 ml-2 px-3 py-2"
              >
                  + Simular Internamente
              </button>
            )}
        </div>
      </div>

      {/* Navegação de Abas */}
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

      {/* --- CONTEÚDO: CANDIDATOS --- */}
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
        /* --- CONTEÚDO: CONFIGURAÇÕES --- */
        <div className="space-y-6">
          
          {/* 1. EDITAR DADOS DA VAGA */}
          <div className="bg-white rounded shadow border p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b">Dados da Vaga</h2>
            <form onSubmit={handleUpdateJob} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                    <input 
                        required 
                        className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.title}
                        onChange={e => setFormData({...formData, title: e.target.value})}
                    />
                </div>

                {job?.tenantId && (
                    <AreaSelect 
                        tenantId={job.tenantId} 
                        value={formData.company_department_id}
                        onChange={val => setFormData({...formData, company_department_id: val})}
                    />
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
                        <select 
                            className="w-full border p-2 rounded bg-white" 
                            value={formData.location_type} 
                            onChange={e => setFormData({...formData, location_type: e.target.value})}
                        >
                            <option>Presencial</option>
                            <option>Híbrido</option>
                            <option>Remoto</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Contrato</label>
                        <select 
                            className="w-full border p-2 rounded bg-white" 
                            value={formData.type} 
                            onChange={e => setFormData({...formData, type: e.target.value})}
                        >
                            <option>CLT</option>
                            <option>PJ</option>
                            <option>Estágio</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                    <textarea 
                        className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" 
                        rows="3" 
                        value={formData.description} 
                        onChange={e => setFormData({...formData, description: e.target.value})}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Requisitos</label>
                    <textarea 
                        className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" 
                        rows="3" 
                        value={formData.requirements} 
                        onChange={e => setFormData({...formData, requirements: e.target.value})}
                    />
                </div>

                <div className="flex justify-end pt-2">
                    <button 
                        type="submit" 
                        disabled={saving}
                        className="bg-blue-600 text-white px-6 py-2 rounded flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
                    >
                        <Save size={16}/> {saving ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </form>
          </div>

          {/* 2. GERENCIAMENTO DE STATUS */}
          <div className="bg-white rounded shadow border p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b">Status e Ciclo de Vida</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status Atual</label>
                <div className="flex gap-2">
                  <select 
                    className="flex-1 border p-2 rounded bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={job?.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={statusLoading}
                  >
                    <option value="active">Ativa (Recebendo candidatos)</option>
                    <option value="inactive">Inativa (Pausada)</option>
                    <option value="closed">Fechada (Preenchida)</option>
                    <option value="canceled">Cancelada</option>
                  </select>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Apenas vagas <strong>Ativas</strong> contam para o limite do plano.
                </p>
              </div>

              <div className="border-l pl-8 border-gray-100">
                 <h3 className="text-sm font-bold text-red-600 mb-2 flex items-center gap-2">
                   <AlertTriangle size={16}/> Zona de Perigo
                 </h3>
                 <p className="text-xs text-gray-500 mb-3">
                   A exclusão apaga todos os dados desta vaga.
                 </p>
                 <button 
                   onClick={handleDeleteJob}
                   disabled={statusLoading}
                   className="border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2 rounded text-sm font-medium flex items-center gap-2 transition w-full justify-center"
                 >
                   <Trash2 size={16}/> Excluir Vaga
                 </button>
              </div>
            </div>
          </div>

          {/* 3. CRITÉRIOS DE AVALIAÇÃO */}
          <div className="bg-white rounded shadow border p-6">
            <JobCriteria job={job} onUpdate={fetchData} />
          </div>
        </div>
      )}
    </div>
  );
}