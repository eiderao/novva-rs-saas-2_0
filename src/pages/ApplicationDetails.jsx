import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import EvaluationForm from '../components/EvaluationForm';
import { ArrowLeft, User, Mail, MapPin } from 'lucide-react';

export default function ApplicationDetails() {
  const { appId } = useParams(); // ID da Aplicação
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

      // 1. Busca Aplicação + Candidato
      const { data: application, error: appError } = await supabase
        .from('applications')
        .select('*, candidate:candidates(*)')
        .eq('id', appId)
        .single();
      
      if (appError) throw appError;
      setAppData(application);

      // 2. Busca Vaga (para pegar os parâmetros de avaliação)
      const { data: jobData } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', application.jobId)
        .single();
      setJob(jobData);

      // 3. Busca Avaliação existente deste usuário (se houver)
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
      alert("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-10 text-center">Carregando candidato...</div>;
  if (!appData) return <div className="p-10 text-center">Candidato não encontrado.</div>;

  // Parâmetros padrão se a vaga não tiver nada configurado
  const defaultParams = {
    triagem: [], cultura: [], tecnico: [],
    notas: [{id:'1',nome:'Abaixo',valor:0}, {id:'2',nome:'Atende',valor:50}, {id:'3',nome:'Supera',valor:100}]
  };

  const params = job?.parameters || defaultParams;

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
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-3xl mb-4">
                {appData.candidate?.name?.[0]}
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
            </div>

            <div className="mt-6 pt-4 border-t">
               <h4 className="font-bold text-sm mb-2 text-gray-700">Respostas do Formulário</h4>
               <div className="space-y-2">
                 {Object.entries(appData.formData || {}).map(([k, v]) => (
                   <div key={k}>
                     <span className="text-xs text-gray-400 uppercase font-semibold">{k}</span>
                     <p className="text-sm text-gray-800">{String(v)}</p>
                   </div>
                 ))}
                 {Object.keys(appData.formData || {}).length === 0 && <p className="text-sm text-gray-400 italic">Sem respostas.</p>}
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
            onSaved={fetchData} // Recarrega após salvar
          />
        </div>

      </div>
    </div>
  );
}