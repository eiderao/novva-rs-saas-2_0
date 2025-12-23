import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import EvaluationForm from '../components/EvaluationForm';
import { ArrowLeft, Mail, MapPin, BookOpen, FileText, Calendar, Download } from 'lucide-react';

export default function ApplicationDetails() {
  const { appId } = useParams();
  const navigate = useNavigate();
  
  const [appData, setAppData] = useState(null);
  const [job, setJob] = useState(null);
  const [myEvaluation, setMyEvaluation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [appId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Busca Aplicação + Candidato (MÉTODO SEGURO)
      // Usamos 'candidates(*)' sem apelidos para evitar erros de relacionamento
      const { data: application, error: appError } = await supabase
        .from('applications')
        .select('*, candidates(*)')
        .eq('id', appId)
        .single();
      
      if (appError) throw appError;

      // Normaliza o dado (caso venha como array ou objeto)
      const candidateObj = Array.isArray(application.candidates) 
        ? application.candidates[0] 
        : application.candidates;

      setAppData({
        ...application,
        candidate: candidateObj
      });

      // 2. Busca Vaga
      if (application.jobId) {
        const { data: jobData } = await supabase
            .from('jobs')
            .select('*')
            .eq('id', application.jobId)
            .single();
        setJob(jobData);
      }

      // 3. Busca Avaliação existente
      if (user) {
        const { data: evalData } = await supabase
          .from('evaluations')
          .select('*')
          .eq('application_id', appId)
          .eq('evaluator_id', user.id)
          .maybeSingle();
        setMyEvaluation(evalData);
      }

    } catch (err) {
      console.error(err);
      alert("Erro ao carregar dados: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  // --- FUNÇÕES DE FORMATAÇÃO (Mantidas para a interface ficar correta) ---
  
  const translateLabel = (key) => {
    const map = {
      motivation: "Carta de Apresentação",
      education: "Formação Acadêmica",
      applied_at: "Data da Candidatura",
      resume_url: "Currículo",
      linkedin_profile: "LinkedIn",
      github_profile: "GitHub/Portfólio"
    };
    return map[key] || key.toUpperCase();
  };

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

  if (loading) return <div className="p-10 text-center">Carregando candidato...</div>;
  if (!appData) return <div className="p-10 text-center">Candidato não encontrado.</div>;

  const defaultParams = {
    triagem: [], cultura: [], tecnico: [],
    notas: [{id:'1',nome:'Abaixo',valor:0}, {id:'2',nome:'Atende',valor:50}, {id:'3',nome:'Supera',valor:100}]
  };

  const params = job?.parameters || defaultParams;
  const formData = appData.formData || {};

  return (
    <div className="p-8 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      <button onClick={() => navigate(-1)} className="flex items-center text-gray-500 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4 mr-2"/> Voltar
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Coluna Esquerda: Info do Candidato */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-3xl mb-4 uppercase">
                {appData.candidate?.name?.[0] || '?'}
              </div>
              <h1 className="text-xl font-bold text-gray-900">{appData.candidate?.name}</h1>
              <p className="text-sm text-gray-500 mt-1">{job?.title}</p>
            </div>
            
            <div className="mt-6 space-y-3 border-t pt-4">
              <div className="flex items-center text-sm text-gray-600">
                <Mail className="w-4 h-4 mr-3 text-gray-400"/> {appData.candidate?.email}
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <MapPin className="w-4 h-4 mr-3 text-gray-400"/> {appData.candidate?.city || 'Não informado'}
              </div>
              {appData.candidate?.resume_url && (
                <a href={appData.candidate.resume_url} target="_blank" rel="noreferrer" className="flex items-center text-sm text-blue-600 hover:underline mt-2">
                    <Download className="w-4 h-4 mr-3"/> Ver Currículo
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

                 {/* 3. DATA */}
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
          <EvaluationForm 
            applicationId={appData.id}
            jobParameters={params}
            initialData={myEvaluation}
            onSaved={fetchData} 
          />
        </div>

      </div>
    </div>
  );
}