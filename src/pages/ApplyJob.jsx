import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { Building, MapPin, Briefcase, CheckCircle, Send, GraduationCap, User, Link as LinkIcon, FileText, Upload, Paperclip, AlertCircle, Languages } from 'lucide-react';

export default function ApplyJob() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resumeType, setResumeType] = useState('file'); 
  const [resumeFile, setResumeFile] = useState(null);

  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', city: '', state: '',
    linkedin_profile: '', github_profile: '', resume_link_input: '', 
    birthDate: '', englishLevel: '', spanishLevel: '', source: '',
    motivation: '', education_level: '', education_status: '', course_name: '', institution: '', conclusion_date: '', current_period: ''
  });

  useEffect(() => {
    const fetchJob = async () => {
        const { data } = await supabase.from('jobs').select('title, description, requirements, location_type, type, status').eq('id', jobId).single();
        if (data) setJob(data);
        else alert("Vaga não encontrada.");
        setLoading(false);
    };
    fetchJob();
  }, [jobId]);

  const handleInputChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
  
  const handleFileChange = (e) => {
    if (e.target.files?.length > 0) setResumeFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (job.status !== 'active') throw new Error("Vaga encerrada.");
      
      let finalResumeUrl = formData.resume_link_input;
      if (resumeType === 'file') {
        if (!resumeFile) throw new Error("Anexe seu currículo.");
        const fileName = `${formData.email.replace(/[^a-zA-Z0-9]/g, '')}_${Date.now()}.${resumeFile.name.split('.').pop()}`;
        const { error } = await supabase.storage.from('resumes').upload(fileName, resumeFile);
        if (error) throw error;
        const { data } = supabase.storage.from('resumes').getPublicUrl(fileName);
        finalResumeUrl = data.publicUrl;
      } else if (!finalResumeUrl) {
          throw new Error("Informe o link do currículo.");
      }

      const res = await fetch('/api/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId,
            resume_url: finalResumeUrl,
            ...formData
          })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSuccess(true);
    } catch (err) {
      alert(err.message);
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
                <CheckCircle className="text-green-600 w-12 h-12 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Candidatura Recebida!</h2>
                <p className="text-gray-600 mb-6">Boa sorte! Seus dados foram enviados.</p>
                <button onClick={() => window.location.reload()} className="text-blue-600 hover:underline text-sm">Voltar</button>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 font-sans">
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-slate-800 p-8 text-white">
            <h1 className="text-3xl font-bold mb-3">{job.title}</h1>
            <div className="flex gap-4 text-sm font-medium text-slate-300">
                <span className="flex gap-1 items-center"><Briefcase size={14}/> {job.type}</span>
                <span className="flex gap-1 items-center"><MapPin size={14}/> {job.location_type}</span>
            </div>
        </div>
        <div className="grid lg:grid-cols-12">
            <div className="lg:col-span-5 p-8 bg-gray-50 border-r border-gray-100 h-fit sticky top-0">
                <h3 className="font-bold text-slate-800 mb-2 flex gap-2"><FileText size={20} className="text-blue-600"/> Descrição</h3>
                <p className="text-slate-600 text-sm whitespace-pre-line mb-6">{job.description}</p>
                <h3 className="font-bold text-slate-800 mb-2 flex gap-2"><CheckCircle size={20} className="text-green-600"/> Requisitos</h3>
                <p className="text-slate-600 text-sm whitespace-pre-line">{job.requirements}</p>
            </div>
            <div className="lg:col-span-7 p-8 bg-white">
                <h2 className="text-2xl font-bold text-slate-800 mb-6 border-b pb-2">Ficha de Inscrição</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <section>
                        <h4 className="flex gap-2 text-sm font-bold text-blue-600 uppercase mb-4"><User size={16}/> Dados Básicos</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2"><label className="text-xs font-bold text-gray-500">Nome Completo *</label><input required className="w-full border p-2 rounded" value={formData.name} onChange={e=>handleInputChange('name',e.target.value)}/></div>
                            <div className="md:col-span-2"><label className="text-xs font-bold text-gray-500">Email *</label><input required type="email" className="w-full border p-2 rounded" value={formData.email} onChange={e=>handleInputChange('email',e.target.value)}/></div>
                            <div><label className="text-xs font-bold text-gray-500">Celular *</label><input required className="w-full border p-2 rounded" value={formData.phone} onChange={e=>handleInputChange('phone',e.target.value)}/></div>
                            <div><label className="text-xs font-bold text-gray-500">Data de Nascimento *</label><input required type="date" className="w-full border p-2 rounded" value={formData.birthDate} onChange={e=>handleInputChange('birthDate',e.target.value)}/></div>
                            <div className="md:col-span-2 grid grid-cols-3 gap-2">
                                <div className="col-span-2"><label className="text-xs font-bold text-gray-500">Cidade</label><input className="w-full border p-2 rounded" value={formData.city} onChange={e=>handleInputChange('city',e.target.value)}/></div>
                                <div><label className="text-xs font-bold text-gray-500">UF</label><select className="w-full border p-2 rounded bg-white" value={formData.state} onChange={e=>handleInputChange('state',e.target.value)}><option value="">--</option>{['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(u=><option key={u}>{u}</option>)}</select></div>
                            </div>
                        </div>
                    </section>
                    <section>
                        <h4 className="flex gap-2 text-sm font-bold text-blue-600 uppercase mb-4 border-t pt-6"><Languages size={16}/> Idiomas</h4>
                        <div className="grid grid-cols-2 gap-4">
                            {['Inglês', 'Espanhol'].map((lang, i) => (
                                <div key={lang}>
                                    <label className="text-xs font-bold text-gray-500">{lang}</label>
                                    <select className="w-full border p-2 rounded bg-white" value={i===0?formData.englishLevel:formData.spanishLevel} onChange={e=>handleInputChange(i===0?'englishLevel':'spanishLevel',e.target.value)}>
                                        <option value="">Selecione...</option><option value="basico">Básico</option><option value="intermediario">Intermediário</option><option value="avancado">Avançado</option><option value="fluente">Fluente</option>
                                    </select>
                                </div>
                            ))}
                        </div>
                    </section>
                    <section>
                        <h4 className="flex gap-2 text-sm font-bold text-blue-600 uppercase mb-4 border-t pt-6"><GraduationCap size={16}/> Formação</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-xs font-bold text-gray-500">Nível *</label><select required className="w-full border p-2 rounded bg-white" value={formData.education_level} onChange={e=>handleInputChange('education_level',e.target.value)}><option value="">Selecione...</option><option value="medio">Médio</option><option value="tecnico">Técnico</option><option value="superior">Superior</option><option value="pos">Pós/MBA</option></select></div>
                            {formData.education_level && <div><label className="text-xs font-bold text-gray-500">Status *</label><select required className="w-full border p-2 rounded bg-white" value={formData.education_status} onChange={e=>handleInputChange('education_status',e.target.value)}><option value="">Selecione...</option><option value="completo">Completo</option><option value="cursando">Cursando</option></select></div>}
                            {isSuperiorOrTech && formData.education_status && <><div className="col-span-2"><label className="text-xs font-bold text-gray-500">Curso</label><input className="w-full border p-2 rounded" value={formData.course_name} onChange={e=>handleInputChange('course_name',e.target.value)}/></div><div className="col-span-2"><label className="text-xs font-bold text-gray-500">Instituição</label><input className="w-full border p-2 rounded" value={formData.institution} onChange={e=>handleInputChange('institution',e.target.value)}/></div></>}
                            {isSuperiorOrTech && (isStudying ? <div><label className="text-xs font-bold text-gray-500">Previsão</label><input type="month" className="w-full border p-2 rounded" value={formData.conclusion_date} onChange={e=>handleInputChange('conclusion_date',e.target.value)}/></div> : isCompleted ? <div><label className="text-xs font-bold text-gray-500">Ano Conclusão</label><input type="number" className="w-full border p-2 rounded" value={formData.conclusion_date} onChange={e=>handleInputChange('conclusion_date',e.target.value)}/></div> : null)}
                        </div>
                    </section>
                    <section>
                        <h4 className="flex gap-2 text-sm font-bold text-blue-600 uppercase mb-4 border-t pt-6"><Paperclip size={16}/> Currículo</h4>
                        <div className="bg-gray-50 p-4 rounded border">
                            <div className="flex gap-4 mb-4">
                                <label className="flex gap-2 cursor-pointer"><input type="radio" checked={resumeType==='file'} onChange={()=>setResumeType('file')}/> Upload Arquivo</label>
                                <label className="flex gap-2 cursor-pointer"><input type="radio" checked={resumeType==='link'} onChange={()=>setResumeType('link')}/> Link Externo</label>
                            </div>
                            {resumeType==='file' ? <input type="file" accept=".pdf,.doc,.docx" onChange={handleFileChange} className="w-full text-sm"/> : <input className="w-full border p-2 rounded" placeholder="https://..." value={formData.resume_link_input} onChange={e=>handleInputChange('resume_link_input',e.target.value)}/>}
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div><label className="text-xs font-bold text-gray-500">LinkedIn</label><input className="w-full border p-2 rounded" value={formData.linkedin_profile} onChange={e=>handleInputChange('linkedin_profile',e.target.value)}/></div>
                            <div><label className="text-xs font-bold text-gray-500">Origem (Onde viu a vaga?)</label><input className="w-full border p-2 rounded" value={formData.source} onChange={e=>handleInputChange('source',e.target.value)}/></div>
                        </div>
                    </section>
                    <section>
                        <h4 className="flex gap-2 text-sm font-bold text-blue-600 uppercase mb-4 border-t pt-6"><FileText size={16}/> Motivação</h4>
                        <textarea className="w-full border p-2 rounded" rows="4" value={formData.motivation} onChange={e=>handleInputChange('motivation',e.target.value)}/>
                    </section>
                    <button disabled={submitting} className="w-full bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700 disabled:opacity-50">{submitting ? 'Enviando...' : 'Confirmar Candidatura'}</button>
                </form>
            </div>
        </div>
      </div>
    </div>
  );
}