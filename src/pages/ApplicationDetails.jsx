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
    TrendingUp 
} from 'lucide-react';

export default function ApplicationDetails() {
  const { appId } = useParams();
  const navigate = useNavigate();
  
  const [appData, setAppData] = useState(null);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [appId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Busca Aplicação + Candidato
      const { data: application, error: appError } = await supabase
        .from('applications')
        .select('*, candidates(*)')
        .eq('id', appId)
        .single();
      
      if (appError) throw appError;

      // Normaliza o objeto do candidato
      const candidateObj = Array.isArray(application.candidates) 
        ? application.candidates[0] 
        : application.candidates;

      setAppData({
        ...application,
        candidate: candidateObj
      });

      // 2. Busca Vaga (para pegar os parâmetros de avaliação)
      if (application.jobId) {
        const { data: jobData } = await supabase
            .from('jobs')
            .select('*')
            .eq('id', application.jobId)
            .single();
        setJob(jobData);
      }

    } catch (err) {
      console.error(err);
      alert("Erro ao carregar dados: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  // --- HELPER: Renderiza Educação ---
  const renderEducation = (edu) => {
    if (!edu || typeof edu !== 'object') return <span className="text-gray-500">Não informado</span>;
    
    const nivelMap = { medio: 'Ensino Médio', tecnico: 'Técnico', superior: 'Superior', pos: 'Pós-Graduação', mestrado: 'Mestrado' };
    const statusMap = { completo: 'Concluído', cursando: 'Cursando', incompleto: 'Incompleto' };

    const nivel = nivelMap[edu.level] || edu.level || 'Nível não informado';
    const status = statusMap[edu.status] || edu.status || '';

    return (
      <div className="bg-gray-50 p-3 rounded border border-gray-200 text-sm mt-1">
        <p className="font-bold text-gray-800">{nivel} {status && <span className="font-normal text-gray-500">• {status}</span>}</p>
        {(edu.course || edu.institution) && (
           <p className="text-gray-700 mt-1">{edu.course} {edu.institution ? `| ${edu.institution}` : ''}</p>
        )}
        {(edu.date || edu.period) && (
           <p className="text-gray-500 text-xs mt-1">
             {edu.date && `Data: ${edu.date} `} {edu.period && `• ${edu.period}`}
           </p>
        )}
      </div>
    );
  };

  // --- HELPER: Tradução ---
  const translateLabel = (key) => {
    const map = {
      motivation: "Carta de Apresentação",
      education: "Formação Acadêmica",
      applied_at: "Data da Candidatura"
    };
    return map[key] || key.toUpperCase();
  };

  // --- HELPER: Renderiza Badge de Nota (Escala 0 a 30) ---
  const renderScoreBadge = (score) => {
    if (score === null || score === undefined) {
        return <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-sm font-medium border border-gray-200">Aguardando Avaliação</span>;
    }
    
    let colorClass = "bg-gray-50 text-gray-900 border-gray-200";
    let label = "Nota Final";
    
    // Escala 0 a 30
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
        <div className={`flex items-center gap-4 px-6 py-4 rounded-xl shadow-sm mt-4 border ${colorClass}`}>
            <div className="p-2 bg-white bg-opacity-50 rounded-lg">
                <TrendingUp size={28} />
            </div>
            <div className="text-left">
                <span className="block text-xs uppercase font-bold opacity-80 tracking-wider mb-1">{label}</span>
                <span className="block text-3xl font-black leading-none">
                    {Number(score).toFixed(1)} <span className="text-sm font-medium opacity-60">/ 30</span>
                </span>
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
              
              {/* EXIBIÇÃO DA NOTA GERAL */}
              {renderScoreBadge(appData.score_general)}
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
                 
                 {/* 1. ESCOLARIDADE */}
                 {formData.education && (
                    <div>
                        <span className="text-xs text-gray-400 uppercase font-semibold flex items-center gap-1">
                            <BookOpen size={12}/> {translateLabel('education')}
                        </span>
                        {renderEducation(formData.education)}
                    </div>
                 )}

                 {/* 2. MOTIVAÇÃO */}
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
          {/* Componente de Avaliação */}
          <EvaluationForm 
            applicationId={appData.id}
            jobParameters={params}
            initialData={appData.evaluation} 
            onSaved={fetchData} 
          />
        </div>

      </div>
    </div>
  );
}