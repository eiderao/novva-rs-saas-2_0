import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { ArrowLeft, User, Mail, Phone, MapPin, Calendar, BookOpen, FileText, Download, Star } from 'lucide-react';

export default function ApplicationDetails() {
  const { appId } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [evaluation, setEvaluation] = useState({ notes: '', score: 0 }); // Estado simples para avaliação
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [appId]);

  const fetchData = async () => {
    setLoading(true);
    // Busca aplicação + dados do candidato
    const { data, error } = await supabase
      .from('applications')
      .select('*, candidate:candidates(*), job:jobs(title)')
      .eq('id', appId)
      .single();

    if (error) {
      alert("Erro ao buscar candidato.");
      navigate('/');
    } else {
      setApp(data);
      // Se já tiver avaliação, carrega aqui (lógica futura)
    }
    setLoading(false);
  };

  // --- FUNÇÕES AUXILIARES DE FORMATAÇÃO ---

  const translateLabel = (key) => {
    const map = {
      motivation: "Carta de Apresentação / Motivação",
      education: "Formação Acadêmica",
      applied_at: "Data da Candidatura"
    };
    return map[key] || key.toUpperCase();
  };

  const renderEducation = (edu) => {
    if (!edu || typeof edu !== 'object') return "Não informado";
    
    // Mapeia valores para português amigável
    const nivelMap = { medio: 'Ensino Médio', tecnico: 'Técnico', superior: 'Superior', pos: 'Pós-Graduação' };
    
    return (
      <div className="bg-gray-50 p-3 rounded border border-gray-100 text-sm">
        <p className="font-bold text-gray-800">
          {nivelMap[edu.level] || edu.level} <span className="font-normal text-gray-500">• {edu.status}</span>
        </p>
        {(edu.course || edu.institution) && (
           <p className="text-gray-700 mt-1">
             {edu.course} {edu.course && edu.institution ? 'na' : ''} {edu.institution}
           </p>
        )}
        {(edu.date || edu.period) && (
           <p className="text-gray-500 text-xs mt-1">
             {edu.date ? `Conclusão: ${edu.date}` : ''} {edu.period ? `• ${edu.period}` : ''}
           </p>
        )}
      </div>
    );
  };

  // --- AÇÃO DE AVALIAR (Exemplo Simplificado) ---
  const handleSaveEvaluation = async () => {
    // Aqui você conectaria com a tabela 'evaluations' que criamos antes
    alert("Funcionalidade de salvar avaliação será conectada aqui.");
  };

  if (loading) return <div className="p-10 text-center">Carregando...</div>;
  if (!app) return null;

  // Extrai dados do JSON formData
  const { formData } = app;
  // Filtra chaves que queremos exibir (ignorando nulos ou objetos vazios)
  const displayKeys = Object.keys(formData).filter(k => formData[k]);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center text-gray-500 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4 mr-2"/> Voltar
      </button>

      {/* Cartão do Candidato */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden mb-6">
        <div className="p-6 border-b bg-gray-50 flex justify-between items-start">
            <div className="flex gap-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-2xl font-bold">
                    {app.candidate.name?.[0]}
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{app.candidate.name}</h1>
                    <p className="text-gray-500 text-sm">{app.job?.title} • {app.candidate.city} - {app.candidate.state}</p>
                    
                    <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                        <span className="flex items-center gap-1"><Mail size={14}/> {app.candidate.email}</span>
                        <span className="flex items-center gap-1"><Phone size={14}/> {app.candidate.phone}</span>
                    </div>
                </div>
            </div>

            {/* Ações Rápidas */}
            <div className="flex gap-2">
                 {app.candidate.resume_url && (
                    <a 
                      href={app.candidate.resume_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-white border text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Download size={14}/> Ver Currículo
                    </a>
                 )}
            </div>
        </div>

        {/* Links Externos */}
        {(app.candidate.linkedin_profile || app.candidate.github_profile) && (
            <div className="px-6 py-3 bg-gray-50 border-b flex gap-4 text-sm">
                {app.candidate.linkedin_profile && (
                    <a href={app.candidate.linkedin_profile.startsWith('http') ? app.candidate.linkedin_profile : `https://${app.candidate.linkedin_profile}`} target="_blank" className="text-blue-600 hover:underline">LinkedIn</a>
                )}
                {app.candidate.github_profile && (
                    <a href={app.candidate.github_profile.startsWith('http') ? app.candidate.github_profile : `https://${app.candidate.github_profile}`} target="_blank" className="text-gray-700 hover:underline">GitHub / Portfólio</a>
                )}
            </div>
        )}

        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Coluna Esquerda: Respostas do Formulário */}
            <div className="md:col-span-2 space-y-6">
                <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Respostas do Candidato</h3>
                
                {/* 1. Escolaridade (Tratamento Especial) */}
                {formData.education && (
                    <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1">
                            <BookOpen size={14}/> {translateLabel('education')}
                        </h4>
                        {renderEducation(formData.education)}
                    </div>
                )}

                {/* 2. Motivação (Tratamento Especial) */}
                {formData.motivation && (
                    <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1">
                            <FileText size={14}/> {translateLabel('motivation')}
                        </h4>
                        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded border border-gray-100 whitespace-pre-line">
                            {formData.motivation}
                        </p>
                    </div>
                )}

                {/* 3. Data de Aplicação */}
                {formData.applied_at && (
                    <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1">
                            <Calendar size={14}/> {translateLabel('applied_at')}
                        </h4>
                        <p className="text-sm text-gray-800">
                            {new Date(formData.applied_at).toLocaleString('pt-BR')}
                        </p>
                    </div>
                )}
            </div>

            {/* Coluna Direita: Avaliação Rápida (Placeholder) */}
            <div className="bg-gray-50 p-4 rounded border h-fit">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Star size={16} className="text-yellow-500"/> Avaliação
                </h3>
                <div className="space-y-3">
                    <p className="text-xs text-gray-500">Módulo de avaliação em desenvolvimento.</p>
                    <button disabled className="w-full bg-blue-600 text-white py-2 rounded opacity-50 cursor-not-allowed text-sm">
                        Avaliar Candidato
                    </button>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
}