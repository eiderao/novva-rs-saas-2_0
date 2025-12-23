import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { Building, MapPin, Briefcase, CheckCircle, Send, GraduationCap, User, Link as LinkIcon, FileText, Upload, Paperclip } from 'lucide-react';

export default function ApplyJob() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Estados para Upload de Arquivo
  const [resumeType, setResumeType] = useState('file'); // 'file' ou 'link'
  const [resumeFile, setResumeFile] = useState(null);

  // Estado do Formulário
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    state: '',
    linkedin_profile: '',
    github_profile: '',
    resume_url: '', // Será preenchido automaticamente após upload
    
    motivation: '',
    education_level: '',
    education_status: '',
    course_name: '',
    institution: '',
    conclusion_date: '',
    current_period: ''
  });

  useEffect(() => {
    fetchJobDetails();
  }, [jobId]);

  const fetchJobDetails = async () => {
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

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setResumeFile(e.target.files[0]);
    }
  };

  const uploadResumeToStorage = async () => {
    if (!resumeFile) return null;

    const fileExt = resumeFile.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const filePath = `${fileName}`;

    // 1. Upload para o bucket 'resumes'
    const { error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(filePath, resumeFile);

    if (uploadError) throw new Error("Erro no upload do arquivo: " + uploadError.message);

    // 2. Pegar URL pública
    const { data } = supabase.storage.from('resumes').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (job.status !== 'active') throw new Error("Esta vaga não está mais aceitando candidaturas.");
      
      let finalResumeUrl = formData.resume_url;

      // --- LÓGICA DE UPLOAD ---
      if (resumeType === 'file') {
        if (!resumeFile) throw new Error("Por favor, selecione um arquivo de currículo.");
        finalResumeUrl = await uploadResumeToStorage();
      } else {
        if (!formData.resume_url) throw new Error("Por favor, informe o link do currículo.");
      }

      // 1. Upsert Candidato
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
            resume_url: finalResumeUrl, // Usa a URL gerada ou o link colado
            updated_at: new Date()
        }, { onConflict: 'email' }) // Isso agora vai funcionar com a constraint criada no SQL
        .select()
        .single();

      if (candError) throw candError;

      // 2. Prepara Application Data
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

      // 3. Insert Application
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
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Candidatura Enviada!</h2>
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
        <div className="bg-slate-800 p-8 text-white relative">
            <h1 className="text-3xl font-bold mb-3">{job.title}</h1>
            <div className="flex flex-wrap gap-4 text-slate-300 text-sm font-medium">
                <span className="flex items-center gap-1 bg-slate-700 px-3 py-1 rounded-full"><Briefcase size={14}/> {job.type}</span>
                <span className="flex items-center gap-1 bg-slate-700 px-3 py-1 rounded-full"><MapPin size={14}/> {job.location_type}</span>
                <span className="flex items-center gap-1 bg-slate-700 px-3 py-1 rounded-full"><Building size={14}/> Novva R&S</span>
            </div>
        </div>

        <div className="grid lg:grid-cols-12">
            <div className="lg:col-span-5 p-8 bg-gray-50 border-r border-gray-100 sticky top-0 h-fit">
                <div className="space-y-8">
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

            <div className="lg:col-span-7 p-8 bg-white">
                <h2 className="text-2xl font-bold text-slate-800 mb-6 pb-2 border-b border-gray-100">Ficha de Inscrição</h2>
                
                <form onSubmit={handleSubmit} className="space-y-8">
                    
                    {/* DADOS PESSOAIS */}
                    <section>
                        <h4 className="flex items-center gap-2 text-sm font-bold text-blue-600 uppercase mb-4 tracking-wide">
                            <User size={16}/> Dados Básicos
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1">Nome Completo *</label>
                                <input required className="w-full border p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition" 
                                    value={formData.name} onChange={e => handleInputChange('name', e.target.value)} />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1">Email *</label>
                                <input required type="email" className="w-full border p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition" 
                                    value={formData.email} onChange={e => handleInputChange('email', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Telefone / Celular *</label>
                                <input required className="w-full border p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition" 
                                    value={formData.phone} onChange={e => handleInputChange('phone', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Cidade</label>
                                    <input className="w-full border p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition" 
                                        value={formData.city} onChange={e => handleInputChange('city', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">UF</label>
                                    <select className="w-full border p-2.5 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-100"
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

                    {/* CURRÍCULO E LINKS (COM UPLOAD) */}
                    <section>
                        <h4 className="flex items-center gap-2 text-sm font-bold text-blue-600 uppercase mb-4 tracking-wide border-t border-gray-100 pt-6">
                            <Paperclip size={16}/> Currículo e Links
                        </h4>
                        
                        {/* Toggle Tipo de Currículo */}
                        <div className="bg-gray-50 p-4 rounded-lg border mb-4">
                            <label className="block text-xs font-bold text-gray-500 mb-2">Como deseja enviar seu currículo?</label>
                            <div className="flex gap-4 mb-4">
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input type="radio" name="resumeType" checked={resumeType === 'file'} onChange={() => setResumeType('file')} />
                                    <Upload size={16} className="text-gray-600"/> Enviar Arquivo (PDF/DOC)
                                </label>
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input type="radio" name="resumeType" checked={resumeType === 'link'} onChange={() => setResumeType('link')} />
                                    <LinkIcon size={16} className="text-gray-600"/> Colar Link (Drive/LinkedIn)
                                </label>
                            </div>

                            {resumeType === 'file' ? (
                                <div>
                                    <input 
                                      type="file" 
                                      accept=".pdf,.doc,.docx"
                                      onChange={handleFileChange}
                                      className="block w-full text-sm text-slate-500
                                        file:mr-4 file:py-2 file:px-4
                                        file:rounded-full file:border-0
                                        file:text-sm file:font-semibold
                                        file:bg-blue-50 file:text-blue-700
                                        hover:file:bg-blue-100"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">Formatos aceitos: PDF, DOC, DOCX. Máx 5MB.</p>
                                </div>
                            ) : (
                                <input 
                                    className="w-full border p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition" 
                                    placeholder="Cole aqui o link do seu currículo..."
                                    value={formData.resume_url} 
                                    onChange={e => handleInputChange('resume_url', e.target.value)} 
                                />
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Linkedin (Opcional)</label>
                                <input className="w-full border p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition" 
                                    placeholder="linkedin.com/in/..."
                                    value={formData.linkedin_profile} onChange={e => handleInputChange('linkedin_profile', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">GitHub / Portfólio (Opcional)</label>
                                <input className="w-full border p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition" 
                                    placeholder="github.com/..."
                                    value={formData.github_profile} onChange={e => handleInputChange('github_profile', e.target.value)} />
                            </div>
                        </div>
                    </section>

                    {/* ESCOLARIDADE (CONDICIONAL) */}
                    <section>
                        <h4 className="flex items-center gap-2 text-sm font-bold text-blue-600 uppercase mb-4 tracking-wide border-t border-gray-100 pt-6">
                            <GraduationCap size={16}/> Formação
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Nível de Escolaridade *</label>
                                <select required className="w-full border p-2.5 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-100"
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

                            {formData.education_level && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Status *</label>
                                    <select required className="w-full border p-2.5 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-100"
                                        value={formData.education_status} onChange={e => handleInputChange('education_status', e.target.value)}
                                    >
                                        <option value="">Selecione...</option>
                                        <option value="completo">Completo</option>
                                        <option value="cursando">Cursando</option>
                                        <option value="incompleto">Incompleto / Trancado</option>
                                    </select>
                                </div>
                            )}

                            {isSuperiorOrTech && formData.education_status && (
                                <>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Nome do Curso *</label>
                                        <input required className="w-full border p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition" 
                                            value={formData.course_name} onChange={e => handleInputChange('course_name', e.target.value)} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Instituição de Ensino *</label>
                                        <input required className="w-full border p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition" 
                                            value={formData.institution} onChange={e => handleInputChange('institution', e.target.value)} />
                                    </div>
                                </>
                            )}

                            {isSuperiorOrTech && isStudying && (
                                <>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Previsão de Formatura *</label>
                                        <input required type="month" className="w-full border p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100" 
                                            value={formData.conclusion_date} onChange={e => handleInputChange('conclusion_date', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Período Atual *</label>
                                        <select required className="w-full border p-2.5 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-100"
                                            value={formData.current_period} onChange={e => handleInputChange('current_period', e.target.value)}
                                        >
                                            <option value="">Selecione...</option>
                                            {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={`${n}º Semestre`}>{n}º Semestre</option>)}
                                        </select>
                                    </div>
                                </>
                            )}

                            {isSuperiorOrTech && isCompleted && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Ano de Conclusão *</label>
                                    <input required type="number" min="1970" max="2030" className="w-full border p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100" 
                                        value={formData.conclusion_date} onChange={e => handleInputChange('conclusion_date', e.target.value)} />
                                </div>
                            )}
                        </div>
                    </section>

                    {/* MOTIVAÇÃO */}
                    <section>
                        <h4 className="flex items-center gap-2 text-sm font-bold text-blue-600 uppercase mb-4 tracking-wide border-t border-gray-100 pt-6">
                            <FileText size={16}/> Motivação
                        </h4>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Por que você quer esta vaga?</label>
                        <textarea className="w-full border p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition" rows="4" 
                            value={formData.motivation} onChange={e => handleInputChange('motivation', e.target.value)} />
                    </section>

                    <div className="pt-4">
                        <button 
                            disabled={submitting}
                            className="w-full bg-blue-600 text-white font-bold py-4 rounded-lg hover:bg-blue-700 transition flex justify-center items-center gap-2 shadow-lg disabled:opacity-70"
                        >
                           {submitting ? 'Enviando...' : <><Send size={18}/> Confirmar Candidatura</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      </div>
    </div>
  );
}