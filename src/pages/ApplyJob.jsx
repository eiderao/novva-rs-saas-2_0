import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { Building, MapPin, Briefcase, CheckCircle, Send, GraduationCap, User, Link as LinkIcon, FileText } from 'lucide-react';

export default function ApplyJob() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Estado alinhado com a tabela 'candidates' da V2.0 e 'applications'
  const [formData, setFormData] = useState({
    // Campos da tabela candidates (V2.0)
    name: '',
    email: '',
    phone: '',
    city: '',
    state: '',            // Coluna 'state' da V2
    linkedin_profile: '', // Coluna 'linkedin_profile' da V2
    github_profile: '',   // Coluna 'github_profile' da V2
    resume_url: '',       // Coluna 'resume_url' da V2
    
    // Campos lógicos (armazenados no JSON formData da aplicação)
    motivation: '',
    education_level: '',       // Médio, Técnico, Superior, Pós
    education_status: '',      // Completo, Cursando, Incompleto
    course_name: '',           // Apenas se Técnico/Superior/Pós
    institution: '',           // Apenas se Técnico/Superior/Pós
    conclusion_date: '',       // Se Completo (Ano) ou Cursando (Previsão Mês/Ano)
    current_period: ''         // Apenas se Cursando
  });

  useEffect(() => {
    fetchJobDetails();
  }, [jobId]);

  const fetchJobDetails = async () => {
    // Busca dados públicos da vaga (RLS público configurado anteriormente)
    const { data, error } = await supabase
      .from('jobs')
      .select('title, description, requirements, location_type, type, status')
      .eq('id', jobId)
      .single();

    if (error || !data) {
      alert("Vaga não encontrada ou encerrada.");
    } else {
      setJob(data);
    }
    setLoading(false);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (job.status !== 'active') throw new Error("Esta vaga não está mais aceitando candidaturas.");

      // 1. Upsert na tabela 'candidates'
      // Usa os campos exatos da V2.0 (linkedin_profile, github_profile, state)
      const { data: candidate, error: candError } = await supabase
        .from('candidates')
        .upsert({
            email: formData.email,
            name: formData.name,
            phone: formData.phone,
            city: formData.city,
            state: formData.state,
            linkedin_profile: formData.linkedin_profile,
            github_profile: formData.github_profile,
            resume_url: formData.resume_url,
            updated_at: new Date()
        }, { onConflict: 'email' })
        .select()
        .single();

      if (candError) throw candError;

      // 2. Monta o JSON para a tabela 'applications' (Dados variáveis de escolaridade)
      const appPayload = {
        motivation: formData.motivation,
        education: {
            level: formData.education_level,
            status: formData.education_status,
            course: formData.course_name,
            institution: formData.institution,
            date: formData.conclusion_date, 
            period: formData.current_period
        },
        applied_at: new Date().toISOString()
      };

      // 3. Insere na tabela 'applications'
      const { error: appError } = await supabase
        .from('applications')
        .insert({
            jobId: jobId,
            candidateId: candidate.id,
            status: 'new',
            formData: appPayload
        });

      if (appError) {
        if (appError.code === '23505') throw new Error("Você já se candidatou para esta vaga.");
        throw appError;
      }

      setSuccess(true);

    } catch (err) {
      alert("Erro ao enviar: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // --- REGRAS DE EXIBIÇÃO ---
  const isSuperiorOrTech = ['tecnico', 'superior', 'pos', 'mestrado'].includes(formData.education_level);
  const isStudying = formData.education_status === 'cursando';
  const isCompleted = formData.education_status === 'completo';

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50">Carregando...</div>;
  if (!job) return <div className="min-h-screen flex items-center justify-center bg-gray-50">Vaga indisponível.</div>;

  if (success) {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md w-full border-t-4 border-green-500">
                <div className="flex justify-center mb-4">
                    <div className="bg-green-100 p-3 rounded-full">
                        <CheckCircle className="text-green-600 w-12 h-12" />
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Candidatura Recebida!</h2>
                <p className="text-gray-600 mb-6">
                    Seus dados foram enviados com sucesso para a vaga de <strong>{job.title}</strong>.
                </p>
                <button onClick={() => window.location.reload()} className="text-blue-600 font-medium hover:underline text-sm">
                    Voltar para a vaga
                </button>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 font-sans">
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-xl overflow-hidden border border-gray-100">
        
        {/* Header da Vaga */}
        <div className="bg-slate-800 p-8 text-white relative overflow-hidden">
            <div className="relative z-10">
                <h1 className="text-3xl font-bold mb-3">{job.title}</h1>
                <div className="flex flex-wrap gap-4 text-slate-300 text-sm font-medium">
                    <span className="flex items-center gap-1 bg-slate-700 px-3 py-1 rounded-full"><Briefcase size={14}/> {job.type}</span>
                    <span className="flex items-center gap-1 bg-slate-700 px-3 py-1 rounded-full"><MapPin size={14}/> {job.location_type}</span>
                    <span className="flex items-center gap-1 bg-slate-700 px-3 py-1 rounded-full"><Building size={14}/> Novva R&S</span>
                </div>
            </div>
        </div>

        <div className="grid lg:grid-cols-12">
            
            {/* Coluna Esquerda: Detalhes da Vaga (5 cols) */}
            <div className="lg:col-span-5 p-8 bg-gray-50 border-r border-gray-100">
                <div className="sticky top-8 space-y-8">
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg mb-3 flex items-center gap-2">
                            <FileText size={20} className="text-blue-600"/> Descrição
                        </h3>
                        <p className="text-slate-600 whitespace-pre-line text-sm leading-relaxed">{job.description || "Sem descrição."}</p>
                    </div>
                    {job.requirements && (
                        <div>
                            <h3 className="font-bold text-slate-800 text-lg mb-3 flex items-center gap-2">
                                <CheckCircle size={20} className="text-green-600"/> Requisitos
                            </h3>
                            <p className="text-slate-600 whitespace-pre-line text-sm leading-relaxed">{job.requirements}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Coluna Direita: Formulário (7 cols) */}
            <div className="lg:col-span-7 p-8 bg-white">
                <h2 className="text-2xl font-bold text-slate-800 mb-6 pb-2 border-b border-gray-100">Ficha de Inscrição</h2>
                
                <form onSubmit={handleSubmit} className="space-y-8">
                    
                    {/* 1. DADOS PESSOAIS */}
                    <section>
                        <h4 className="flex items-center gap-2 text-sm font-bold text-blue-600 uppercase mb-4 tracking-wide">
                            <User size={16}/> Dados Básicos
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1">Nome Completo *</label>
                                <input required className="w-full border border-gray-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition" 
                                    value={formData.name} onChange={e => handleInputChange('name', e.target.value)} />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1">Email *</label>
                                <input required type="email" className="w-full border border-gray-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition" 
                                    value={formData.email} onChange={e => handleInputChange('email', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Telefone / Celular *</label>
                                <input required className="w-full border border-gray-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition" 
                                    placeholder="(00) 00000-0000"
                                    value={formData.phone} onChange={e => handleInputChange('phone', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Cidade</label>
                                    <input className="w-full border border-gray-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition" 
                                        value={formData.city} onChange={e => handleInputChange('city', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">UF</label>
                                    <select className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-100 outline-none"
                                        value={formData.state} onChange={e => handleInputChange('state', e.target.value)}>
                                        <option value="">--</option>
                                        {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                                            <option key={uf} value={uf}>{uf}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 2. LINKS E PORTFÓLIO */}
                    <section>
                        <h4 className="flex items-center gap-2 text-sm font-bold text-blue-600 uppercase mb-4 tracking-wide border-t border-gray-100 pt-6">
                            <LinkIcon size={16}/> Links Profissionais
                        </h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Link do Currículo (PDF/Drive) *</label>
                                <input required className="w-full border border-gray-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition" 
                                    placeholder="https://..."
                                    value={formData.resume_url} onChange={e => handleInputChange('resume_url', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Perfil LinkedIn</label>
                                    <input className="w-full border border-gray-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition" 
                                        placeholder="linkedin.com/in/..."
                                        value={formData.linkedin_profile} onChange={e => handleInputChange('linkedin_profile', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Perfil GitHub / Portfólio</label>
                                    <input className="w-full border border-gray-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition" 
                                        placeholder="github.com/..."
                                        value={formData.github_profile} onChange={e => handleInputChange('github_profile', e.target.value)} />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 3. ESCOLARIDADE (LÓGICA CONDICIONAL COMPLETA) */}
                    <section>
                        <h4 className="flex items-center gap-2 text-sm font-bold text-blue-600 uppercase mb-4 tracking-wide border-t border-gray-100 pt-6">
                            <GraduationCap size={16}/> Formação Acadêmica
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Nível de Escolaridade *</label>
                                <select required className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-100 outline-none"
                                    value={formData.education_level} onChange={e => handleInputChange('education_level', e.target.value)}
                                >
                                    <option value="">Selecione...</option>
                                    <option value="medio">Ensino Médio</option>
                                    <option value="tecnico">Ensino Técnico</option>
                                    <option value="superior">Superior (Graduação)</option>
                                    <option value="pos">Pós-Graduação / MBA</option>
                                    <option value="mestrado">Mestrado / Doutorado</option>
                                </select>
                            </div>

                            {/* Só exibe Status se tiver Nível selecionado */}
                            {formData.education_level && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Status *</label>
                                    <select required className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-100 outline-none"
                                        value={formData.education_status} onChange={e => handleInputChange('education_status', e.target.value)}
                                    >
                                        <option value="">Selecione...</option>
                                        <option value="completo">Completo</option>
                                        <option value="cursando">Cursando (Em andamento)</option>
                                        <option value="incompleto">Incompleto / Trancado</option>
                                    </select>
                                </div>
                            )}

                            {/* Lógica: Se Técnico/Superior E Status definido */}
                            {isSuperiorOrTech && formData.education_status && (
                                <>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Nome do Curso *</label>
                                        <input required className="w-full border border-gray-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition" 
                                            placeholder="Ex: Engenharia de Software"
                                            value={formData.course_name} onChange={e => handleInputChange('course_name', e.target.value)} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Instituição de Ensino *</label>
                                        <input required className="w-full border border-gray-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition" 
                                            value={formData.institution} onChange={e => handleInputChange('institution', e.target.value)} />
                                    </div>
                                </>
                            )}

                            {/* Lógica: Cursando -> Previsão + Período */}
                            {isSuperiorOrTech && isStudying && (
                                <>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Previsão de Formatura *</label>
                                        <input required type="month" className="w-full border border-gray-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 outline-none" 
                                            value={formData.conclusion_date} onChange={e => handleInputChange('conclusion_date', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Período Atual *</label>
                                        <select required className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-100 outline-none"
                                            value={formData.current_period} onChange={e => handleInputChange('current_period', e.target.value)}
                                        >
                                            <option value="">Selecione...</option>
                                            {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={`${n}º Semestre`}>{n}º Semestre</option>)}
                                        </select>
                                    </div>
                                </>
                            )}

                            {/* Lógica: Completo -> Ano de Conclusão */}
                            {isSuperiorOrTech && isCompleted && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Ano de Conclusão *</label>
                                    <input required type="number" min="1970" max="2030" className="w-full border border-gray-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 outline-none" 
                                        placeholder="Ex: 2022"
                                        value={formData.conclusion_date} onChange={e => handleInputChange('conclusion_date', e.target.value)} />
                                </div>
                            )}
                        </div>
                    </section>

                    {/* 4. MOTIVAÇÃO */}
                    <section>
                        <h4 className="flex items-center gap-2 text-sm font-bold text-blue-600 uppercase mb-4 tracking-wide border-t border-gray-100 pt-6">
                            <FileText size={16}/> Motivação
                        </h4>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Por que você quer esta vaga?</label>
                        <textarea className="w-full border border-gray-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition" rows="4" 
                            placeholder="Conte um pouco sobre suas experiências e objetivos..."
                            value={formData.motivation} onChange={e => handleInputChange('motivation', e.target.value)} />
                    </section>

                    <div className="pt-4">
                        <button 
                            disabled={submitting}
                            className="w-full bg-blue-600 text-white font-bold py-4 rounded-lg hover:bg-blue-700 transition flex justify-center items-center gap-2 shadow-lg disabled:opacity-70"
                        >
                           {submitting ? 'Enviando Inscrição...' : <><Send size={18}/> Confirmar Candidatura</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      </div>
    </div>
  );
}