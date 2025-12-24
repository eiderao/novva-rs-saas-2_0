import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import EvaluationForm from '../components/EvaluationForm';
import { 
    ArrowLeft, 
    Mail, 
    MapPin, 
    BookOpen, 
    FileText, 
    Calendar, 
    Download, 
    TrendingUp,
    Users
} from 'lucide-react';

export default function ApplicationDetails() {
  const { appId } = useParams();
  const navigate = useNavigate();
  
  const [appData, setAppData] = useState(null);
  const [job, setJob] = useState(null);
  const [currentUserEvaluation, setCurrentUserEvaluation] = useState(null);
  const [evaluatorsCount, setEvaluatorsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [appId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Busca Aplicação (com a nota geral consolidada)
      const { data: application, error: appError } = await supabase
        .from('applications')
        .select('*, candidates(*)')
        .eq('id', appId)
        .single();
      
      if (appError) throw appError;

      const candidateObj = Array.isArray(application.candidates) 
        ? application.candidates[0] 
        : application.candidates;

      setAppData({
        ...application,
        candidate: candidateObj
      });

      // 2. Busca Vaga (Parâmetros)
      if (application.jobId) {
        const { data: jobData } = await supabase
            .from('jobs')
            .select('*')
            .eq('id', application.jobId)
            .single();
        setJob(jobData);
      }

      // 3. Busca quantos avaliaram e a avaliação DO USUÁRIO ATUAL
      // Isso permite que o formulário abra preenchido com O QUE EU FIZ, não o que os outros fizeram
      const { data: allEvals, error: evalsError } = await supabase
        .from('evaluations')
        .select('evaluator_id, scores, notes')
        .eq('application_id', appId);

      if (!evalsError && allEvals) {
          setEvaluatorsCount(allEvals.length);
          
          if (user) {
              const myEval = allEvals.find(e => e.evaluator_id === user.id);
              if (myEval) {
                  // Reconstrói estrutura para o form
                  setCurrentUserEvaluation({
                      ...myEval.scores,
                      anotacoes_gerais: myEval.notes || myEval.scores.anotacoes_gerais
                  });
              } else {
                  setCurrentUserEvaluation(null);
              }
          }
      }

    } catch (err) {
      console.error(err);
      alert("Erro ao carregar dados: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  // --- HELPERS ---
  const renderEducation = (edu) => {
    if (!edu || typeof edu !== 'object') return <span className="text-gray-500">Não informado</span>;
    // ... (Mantém lógica anterior de mapeamento)
    const nivelMap = { medio: 'Ensino Médio', tecnico: 'Técnico', superior: 'Superior', pos: 'Pós-Graduação', mestrado: 'Mestrado' };
    const statusMap = { completo: 'Concluído', cursando: 'Cursando', incompleto: 'Incompleto' };
    const nivel = nivelMap[edu.level] || edu.level || '';
    const status = statusMap[edu.status] || edu.status || '';
    return (
      <div className="bg-gray-50 p-3 rounded border border-gray-200 text-sm mt-1">
        <p className="font-bold text-gray-800">{nivel} {status && <span className="font-normal text-gray-500">• {status}</span>}</p>
        <p className="text-gray-700 mt-1">{edu.course} {edu.institution ? `| ${edu.institution}` : ''}</p>
      </div>
    );
  };

  const translateLabel = (key) => {
    const map = { motivation: "Carta de Apresentação", education: "Formação Acadêmica", applied_at: "Data da Candidatura" };
    return map[key] || key.toUpperCase();
  };

  // --- Badge da Média 360 ---
  const renderGlobalScore = (score, count) => {
    if (score === null || score === undefined) {
        return <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-sm font-medium border border-gray-200">Aguardando Avaliação</span>;
    }
    
    // Escala 0-30 (Soma das médias dos 3 pilares)
    let colorClass = "bg-gray-50 text-gray-900 border-gray-200";
    let label = "Média da Equipe";
    
    if (score >= 24) { 
        colorClass = "bg-green-50 text-green-700 border-green-200";
        label = "Perfil Excelente";
    } else if (score >= 15) { 
        colorClass = "bg-yellow-50 text-yellow-700 border-yellow-200";
        label = "Perfil na Média";
    } else {
        colorClass = "bg-red-50 text-red-700 border-red-200";
        label = "Perfil Abaixo";
    }

    return (
        <div className={`flex items-center justify-between px-6 py-4 rounded-xl shadow-sm mt-4 border ${colorClass}`}>
            <div className="flex items-center gap-4">
                <div className="p-2 bg-white bg-opacity-50 rounded-lg">
                    <TrendingUp size={28} />
                </div>
                <div className="text-left">
                    <span className="block text-xs uppercase font-bold opacity-80 tracking-wider mb-1">{label}</span>
                    <span className="block text-3xl font-black leading-none">
                        {Number(score).toFixed(2)} <span className="text-sm font-medium opacity-60">/ 30</span>
                    </span>
                </div>
            </div>
            <div className="text-right border-l pl-4 border-gray-300 border-opacity-30">
                <div className="flex items-center gap-1 text-sm font-bold opacity-80 justify-end">
                    <Users size={14}/> {count}
                </div>
                <span className="text-[10px] uppercase tracking-wide opacity-60">Avaliadores</span>
            </div>
        </div>
    );
  };

  if (loading) return <div className="p-10 text-center">Carregando candidato...</div>;
  if (!appData) return <div className="p-10 text-center">Candidato não encontrado.</div>;

  const params = job?.parameters || {};
  const formData = appData.formData || {};

  return (
    <div className="p-8 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      <button onClick={() => navigate(-1)} className="flex items-center text-gray-500 hover:text-gray-900 mb-6 transition">
        <ArrowLeft className="w-4 h-4 mr-2"/> Voltar
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Coluna Esquerda: Info do Candidato */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white font-bold text-4xl mb-4 shadow-md uppercase">
                {appData.candidate?.name?.[0] || '?'}
              </div>
              <h1 className="text-xl font-bold text-gray-900">{appData.candidate?.name}</h1>
              <p className="text-sm text-gray-500 mt-1">{job?.title}</p>
              
              {/* EXIBIÇÃO DA NOTA GERAL 360 */}
              {renderGlobalScore(appData.score_general, evaluatorsCount)}
            </div>
            
            <div className="mt-6 space-y-3 border-t pt-4">
              <div className="flex items-center text-sm text-gray-600">
                <Mail className="w-4 h-4 mr-3 text-gray-400"/> {appData.candidate?.email}
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <MapPin className="w-4 h-4 mr-3 text-gray-400"/> {appData.candidate?.city || 'Não informado'}
              </div>
              {appData.candidate?.resume_url && (
                <a href={appData.candidate.resume_url} target="_blank" rel="noreferrer" className="flex items-center text-sm text-blue-600 hover:underline mt-2 justify-center bg-blue-50 p-2 rounded">
                    <Download className="w-4 h-4 mr-2"/> Ver Currículo
                </a>
              )}
            </div>

            <div className="mt-6 pt-4 border-t">
               <h4 className="font-bold text-sm mb-4 text-gray-700">Detalhes da Inscrição</h4>
               <div className="space-y-4">
                 {formData.education && (
                    <div>
                        <span className="text-xs text-gray-400 uppercase font-semibold flex items-center gap-1">
                            <BookOpen size={12}/> {translateLabel('education')}
                        </span>
                        {renderEducation(formData.education)}
                    </div>
                 )}
                 {formData.motivation && (
                    <div>
                        <span className="text-xs text-gray-400 uppercase font-semibold flex items-center gap-1">
                            <FileText size={12}/> {translateLabel('motivation')}
                        </span>
                        <p className="text-sm text-gray-800 mt-1 bg-gray-50 p-2 rounded border border-gray-100 whitespace-pre-line">
                            {formData.motivation}
                        </p>
                    </div>
                 )}
                 <div>
                    <span className="text-xs text-gray-400 uppercase font-semibold flex items-center gap-1">
                        <Calendar size={12}/> Data de Envio
                    </span>
                    <p className="text-sm text-gray-800 mt-1">
                        {new Date(appData.created_at).toLocaleDateString('pt-BR')}
                    </p>
                 </div>
               </div>
            </div>
          </div>
        </div>

        {/* Coluna Direita: Avaliação */}
        <div className="lg:col-span-2">
          {/* Componente de Avaliação - Recebe os dados DO USUÁRIO LOGADO */}
          <EvaluationForm 
            applicationId={appData.id}
            jobParameters={params}
            initialData={currentUserEvaluation} 
            onSaved={fetchData} 
          />
        </div>

      </div>
    </div>
  );
}