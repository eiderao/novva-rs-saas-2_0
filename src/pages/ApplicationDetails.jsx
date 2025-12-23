import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { ArrowLeft, User, Mail, Phone, MapPin, Calendar, BookOpen, FileText, Download, Star } from 'lucide-react';

export default function ApplicationDetails() {
  const { appId } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [appId]);

  const fetchData = async () => {
    setLoading(true);
    // Busca aplicação + dados do candidato + dados da vaga
    const { data, error } = await supabase
      .from('applications')
      .select(`
        *,
        candidate:candidates(*),
        job:jobs(title)
      `)
      .eq('id', appId)
      .single();

    if (error) {
      console.error("Erro detalhado:", error);
      alert("Erro ao buscar dados do candidato. Verifique se você está logado.");
      navigate('/');
    } else {
      setApp(data);
    }
    setLoading(false);
  };

  // --- FUNÇÕES DE FORMATAÇÃO (Correção do [object Object]) ---

  // Traduz os campos técnicos para Português
  const translateLabel = (key) => {
    const map = {
      motivation: "Carta de Apresentação",
      education: "Formação Acadêmica",
      applied_at: "Data da Candidatura",
      resume_url: "Currículo"
    };
    return map[key] || key;
  };

  // Formata o objeto de educação para texto legível
  const renderEducation = (edu) => {
    if (!edu || typeof edu !== 'object') return "Não informado";
    
    // Mapeia os códigos para nomes bonitos
    const nivelMap = { 
        medio: 'Ensino Médio', 
        tecnico: 'Ensino Técnico', 
        superior: 'Ensino Superior', 
        pos: 'Pós-Graduação',
        mestrado: 'Mestrado/Doutorado' 
    };
    
    const statusMap = {
        completo: 'Concluído',
        cursando: 'Cursando',
        incompleto: 'Incompleto'
    };

    const nivel = nivelMap[edu.level] || edu.level || 'Nível não informado';
    const status = statusMap[edu.status] || edu.status || '';

    return (
      <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
        <div className="flex justify-between items-start">
            <div>
                <p className="font-bold text-gray-800 text-lg">
                  {nivel}
                </p>
                {/* Mostra Curso e Instituição se existirem */}
                {(edu.course || edu.institution) && (
                   <p className="text-gray-700 font-medium mt-1">
                     {edu.course} <span className="text-gray-400 mx-1">|</span> {edu.institution}
                   </p>
                )}
            </div>
            {status && (
                <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${status === 'Concluído' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {status}
                </span>
            )}
        </div>
        
        {/* Mostra Datas/Período */}
        {(edu.date || edu.period) && (
           <div className="mt-3 text-sm text-gray-500 flex gap-4">
             {edu.date && <span>📅 {status === 'Cursando' ? 'Previsão:' : 'Conclusão:'} {edu.date}</span>}
             {edu.period && <span>🎓 Período Atual: {edu.period}</span>}
           </div>
        )}
      </div>
    );
  };

  if (loading) return <div className="p-10 text-center">Carregando perfil...</div>;
  if (!app) return null;

  const { formData } = app;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center text-gray-500 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4 mr-2"/> Voltar para a Vaga
      </button>

      {/* CABEÇALHO DO CANDIDATO */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden mb-6">
        <div className="p-8 border-b bg-gradient-to-r from-gray-50 to-white flex justify-between items-start">
            <div className="flex gap-6">
                <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-md">
                    {app.candidate.name?.[0]}
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{app.candidate.name}</h1>
                    <div className="flex items-center gap-2 mt-1 text-gray-600">
                        <Briefcase size={16} />
                        <span className="font-medium">{app.job?.title}</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-6 mt-4 text-sm text-gray-600">
                        <span className="flex items-center gap-2"><MapPin size={16}/> {app.candidate.city} - {app.candidate.state}</span>
                        <span className="flex items-center gap-2"><Mail size={16}/> {app.candidate.email}</span>
                        <span className="flex items-center gap-2"><Phone size={16}/> {app.candidate.phone}</span>
                    </div>
                </div>
            </div>

            {/* Botão de Currículo */}
            {app.candidate.resume_url && (
            <a 
                href={app.candidate.resume_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow flex items-center gap-2 transition"
            >
                <Download size={16}/> Baixar Currículo
            </a>
            )}
        </div>

        {/* Links Sociais */}
        {(app.candidate.linkedin_profile || app.candidate.github_profile) && (
            <div className="px-8 py-3 bg-gray-50 border-b flex gap-6 text-sm">
                {app.candidate.linkedin_profile && (
                    <a href={app.candidate.linkedin_profile.startsWith('http') ? app.candidate.linkedin_profile : `https://${app.candidate.linkedin_profile}`} target="_blank" className="text-blue-600 hover:underline font-medium">LinkedIn Profile</a>
                )}
                {app.candidate.github_profile && (
                    <a href={app.candidate.github_profile.startsWith('http') ? app.candidate.github_profile : `https://${app.candidate.github_profile}`} target="_blank" className="text-gray-700 hover:underline font-medium">GitHub / Portfólio</a>
                )}
            </div>
        )}

        <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* COLUNA ESQUERDA: DADOS DA APLICAÇÃO */}
            <div className="lg:col-span-2 space-y-8">
                
                {/* Seção Escolaridade */}
                {formData.education && (
                    <section>
                        <h3 className="text-sm font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                            <BookOpen size={16}/> {translateLabel('education')}
                        </h3>
                        {renderEducation(formData.education)}
                    </section>
                )}

                {/* Seção Motivação */}
                {formData.motivation && (
                    <section>
                        <h3 className="text-sm font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                            <FileText size={16}/> {translateLabel('motivation')}
                        </h3>
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-gray-700 whitespace-pre-line leading-relaxed">
                            {formData.motivation}
                        </div>
                    </section>
                )}

                {/* Data de Aplicação */}
                <div className="pt-4 border-t text-sm text-gray-400 flex items-center gap-2">
                    <Calendar size={14}/> Candidatou-se em: {new Date(app.created_at).toLocaleString('pt-BR')}
                </div>
            </div>

            {/* COLUNA DIREITA: PAINEL DE AVALIAÇÃO */}
            <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-100 h-fit">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Star size={18} className="text-yellow-600 fill-yellow-600"/> Avaliação Rápida
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                    Atribua uma nota preliminar para classificar este candidato no ranking da vaga.
                </p>
                
                {/* Aqui entrará o componente de estrelas/notas em breve */}
                <div className="space-y-3">
                    <div className="h-2 bg-yellow-200 rounded animate-pulse"></div>
                    <div className="h-2 bg-yellow-200 rounded w-2/3 animate-pulse"></div>
                </div>
                
                <button disabled className="mt-6 w-full bg-yellow-600 text-white py-2 rounded font-medium opacity-70 cursor-not-allowed text-sm">
                    Salvar Avaliação (Em breve)
                </button>
            </div>

        </div>
      </div>
    </div>
  );
}