import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { 
  ArrowLeft, 
  User, 
  Calendar, 
  MapPin, 
  Briefcase, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Share2,
  Download,
  Settings,
  Plus,
  Trash2,
  Save
} from 'lucide-react';

export default function JobDetails() {
  const { id } = useParams();
  
  // Estados de Dados
  const [job, setJob] = useState(null);
  const [candidates, setCandidates] = useState([]);
  
  // Estados de Controle
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details'); // 'details', 'candidates', 'evaluation'
  const [shareUrl, setShareUrl] = useState('');
  const [savingParams, setSavingParams] = useState(false);

  // Estado Local para Edição dos Parâmetros de Avaliação (V2)
  const [evalParams, setEvalParams] = useState({
    triagem: [], // Perguntas de Yes/No
    tecnico: [], // Critérios de 1 a 5
    cultura: []  // Critérios de Fit Cultural
  });

  useEffect(() => {
    fetchJobDetails();
  }, [id]);

  useEffect(() => {
    const url = `${window.location.origin}/vagas/${id}/candidatar`;
    setShareUrl(url);
  }, [id]);

  const fetchJobDetails = async () => {
    try {
      setLoading(true);

      // 1. Busca Vaga e Parâmetros
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .single();

      if (jobError) throw jobError;
      
      setJob(jobData);
      
      // Carrega os parâmetros existentes ou inicia vazios
      if (jobData.parameters) {
        setEvalParams({
          triagem: jobData.parameters.triagem || [],
          tecnico: jobData.parameters.tecnico || [],
          cultura: jobData.parameters.cultura || []
        });
      }

      // 2. Busca Candidatos (com Join V2)
      const { data: appsData, error: appsError } = await supabase
        .from('applications')
        .select(`
          *,
          candidate:candidates (
            name, email, phone, city, state, resume_url
          )
        `)
        .eq('jobId', id)
        .order('created_at', { ascending: false });

      if (appsError) throw appsError;
      setCandidates(appsData || []);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- LÓGICA DE AVALIAÇÃO (V2) ---

  const handleAddCriteria = (type) => {
    const newCriteria = prompt(`Digite o novo critério para ${type}:`);
    if (!newCriteria) return;

    setEvalParams(prev => ({
      ...prev,
      [type]: [...prev[type], { id: crypto.randomUUID(), text: newCriteria, weight: 1 }]
    }));
  };

  const handleRemoveCriteria = (type, criteriaId) => {
    setEvalParams(prev => ({
      ...prev,
      [type]: prev[type].filter(item => item.id !== criteriaId)
    }));
  };

  const handleWeightChange = (type, criteriaId, newWeight) => {
    setEvalParams(prev => ({
      ...prev,
      [type]: prev[type].map(item => 
        item.id === criteriaId ? { ...item, weight: parseInt(newWeight) } : item
      )
    }));
  };

  const handleSaveParameters = async () => {
    try {
      setSavingParams(true);
      const { error } = await supabase
        .from('jobs')
        .update({ parameters: evalParams })
        .eq('id', id);

      if (error) throw error;
      alert('Parâmetros de avaliação atualizados com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar parâmetros:', err);
      alert('Erro ao salvar. Tente novamente.');
    } finally {
      setSavingParams(false);
    }
  };

  // --- LÓGICA DE UTILIDADES ---

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    alert('Link copiado!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Vaga não encontrada</h2>
        <Link to="/jobs" className="mt-4 inline-flex items-center text-blue-600">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* HEADER DA PÁGINA */}
      <div className="mb-8">
        <Link to="/jobs" className="inline-flex items-center text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Painel
        </Link>
        
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{job.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center"><MapPin className="h-4 w-4 mr-1"/> {job.location || 'Remoto'}</span>
              <span className="flex items-center"><Briefcase className="h-4 w-4 mr-1"/> {job.type || 'CLT'}</span>
              <span className="flex items-center"><Calendar className="h-4 w-4 mr-1"/> {new Date(job.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Share2 className="h-4 w-4 mr-2" /> Compartilhar Link
          </button>
        </div>
      </div>

      {/* NAVEGAÇÃO DE ABAS */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('details')}
            className={`${activeTab === 'details' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Detalhes da Vaga
          </button>
          <button
            onClick={() => setActiveTab('candidates')}
            className={`${activeTab === 'candidates' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            Candidatos
            <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2.5 rounded-full text-xs">{candidates.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('evaluation')}
            className={`${activeTab === 'evaluation' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Settings className="w-4 h-4 mr-2" />
            Configuração de Avaliação
          </button>
        </nav>
      </div>

      {/* CONTEÚDO DAS ABAS */}
      
      {/* 1. ABA DETALHES */}
      {activeTab === 'details' && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Descrição do Cargo</h3>
            <div className="mt-2 text-sm text-gray-500 whitespace-pre-wrap">{job.description || 'N/A'}</div>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Requisitos</h3>
            <div className="mt-2 text-sm text-gray-500 whitespace-pre-wrap">{job.requirements || 'N/A'}</div>
          </div>
        </div>
      )}

      {/* 2. ABA CANDIDATOS (Com Correção Visual) */}
      {activeTab === 'candidates' && (
        <div className="space-y-4">
          {candidates.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
              <User className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum candidato inscrito ainda</h3>
              <p className="mt-1 text-sm text-gray-500">Divulgue o link para começar a receber currículos.</p>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {candidates.map((app) => (
                  <li key={app.id}>
                    <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center min-w-0">
                          <div className="flex-shrink-0">
                            <span className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                              {app.candidate?.name?.charAt(0).toUpperCase() || '?'}
                            </span>
                          </div>
                          <div className="ml-4 truncate">
                            <p className="text-sm font-medium text-blue-600 truncate">{app.candidate?.name || 'Sem Nome'}</p>
                            <div className="flex text-sm text-gray-500 mt-1 gap-4">
                              <span className="flex items-center"><User className="w-4 h-4 mr-1"/> {app.candidate?.email}</span>
                              <span className="flex items-center"><MapPin className="w-4 h-4 mr-1"/> {app.candidate?.city || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {(app.resumeUrl || app.candidate?.resume_url) && (
                            <a href={app.resumeUrl || app.candidate?.resume_url} target="_blank" rel="noreferrer" className="p-2 text-gray-400 hover:text-gray-600 border rounded-full">
                              <Download className="w-5 h-5" />
                            </a>
                          )}
                          <Link to={`/evaluations/${app.id}`} className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200">
                            Avaliar
                          </Link>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 3. ABA AVALIAÇÃO (Funcionalidade Restaurada) */}
      {activeTab === 'evaluation' && (
        <div className="bg-white shadow sm:rounded-lg p-6 space-y-8">
          
          <div className="border-b border-gray-200 pb-4">
            <h2 className="text-xl font-bold text-gray-900">Definição de Notas e Critérios</h2>
            <p className="text-sm text-gray-500">Configure aqui o que será avaliado nos candidatos desta vaga.</p>
          </div>

          {/* Seção 1: Critérios Técnicos (Hard Skills) */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Briefcase className="w-5 h-5 mr-2 text-blue-500"/> Critérios Técnicos (1 a 5)
              </h3>
              <button onClick={() => handleAddCriteria('tecnico')} className="text-sm text-blue-600 hover:text-blue-800 flex items-center">
                <Plus className="w-4 h-4 mr-1"/> Adicionar Critério
              </button>
            </div>
            
            {evalParams.tecnico.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Nenhum critério técnico definido.</p>
            ) : (
              <div className="space-y-3">
                {evalParams.tecnico.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 bg-gray-50 p-3 rounded-md">
                    <span className="flex-1 font-medium text-gray-700">{item.text}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Peso:</span>
                      <select 
                        className="text-sm border-gray-300 rounded-md"
                        value={item.weight}
                        onChange={(e) => handleWeightChange('tecnico', item.id, e.target.value)}
                      >
                        <option value="1">1x</option>
                        <option value="2">2x</option>
                        <option value="3">3x</option>
                      </select>
                    </div>
                    <button onClick={() => handleRemoveCriteria('tecnico', item.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-4 h-4"/>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Seção 2: Fit Cultural (Soft Skills) */}
          <div className="pt-6 border-t border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <User className="w-5 h-5 mr-2 text-purple-500"/> Fit Cultural (Comportamental)
              </h3>
              <button onClick={() => handleAddCriteria('cultura')} className="text-sm text-blue-600 hover:text-blue-800 flex items-center">
                <Plus className="w-4 h-4 mr-1"/> Adicionar Critério
              </button>
            </div>
            
            {evalParams.cultura.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Nenhum critério cultural definido.</p>
            ) : (
              <div className="space-y-3">
                {evalParams.cultura.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 bg-gray-50 p-3 rounded-md">
                    <span className="flex-1 font-medium text-gray-700">{item.text}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Peso:</span>
                      <select 
                        className="text-sm border-gray-300 rounded-md"
                        value={item.weight}
                        onChange={(e) => handleWeightChange('cultura', item.id, e.target.value)}
                      >
                        <option value="1">1x</option>
                        <option value="2">2x</option>
                        <option value="3">3x</option>
                      </select>
                    </div>
                    <button onClick={() => handleRemoveCriteria('cultura', item.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-4 h-4"/>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botão de Salvar Global */}
          <div className="pt-8 border-t border-gray-200 flex justify-end">
            <button
              onClick={handleSaveParameters}
              disabled={savingParams}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50"
            >
              <Save className="w-5 h-5 mr-2" />
              {savingParams ? 'Salvando...' : 'Salvar Configurações de Avaliação'}
            </button>
          </div>

        </div>
      )}
    </div>
  );
}