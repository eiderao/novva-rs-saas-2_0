import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { Building, MapPin, Briefcase, CheckCircle, Send } from 'lucide-react';

export default function ApplyJob() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Formulário do Candidato
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    resume_url: '', // Link do LinkedIn ou PDF
    motivation: ''
  });

  useEffect(() => {
    fetchJobDetails();
  }, [jobId]);

  const fetchJobDetails = async () => {
    // Busca dados públicos da vaga
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (job.status !== 'active') throw new Error("Esta vaga não está mais aceitando candidaturas.");

      // 1. Cria ou Atualiza o Candidato (Busca pelo email)
      // Upsert: Se existir email, atualiza. Se não, cria.
      const { data: candidate, error: candError } = await supabase
        .from('candidates')
        .upsert({
            email: formData.email,
            name: formData.name,
            phone: formData.phone,
            city: formData.city,
            resume_url: formData.resume_url
        }, { onConflict: 'email' })
        .select()
        .single();

      if (candError) throw candError;

      // 2. Cria a Aplicação
      const { error: appError } = await supabase
        .from('applications')
        .insert({
            jobId: jobId,
            candidateId: candidate.id,
            status: 'new',
            formData: { motivation: formData.motivation } // Salva a carta de apresentação no JSON
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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50">Carregando...</div>;
  if (!job) return <div className="min-h-screen flex items-center justify-center bg-gray-50">Vaga indisponível.</div>;

  if (success) {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md w-full">
                <div className="flex justify-center mb-4">
                    <CheckCircle className="text-green-500 w-16 h-16" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Candidatura Enviada!</h2>
                <p className="text-gray-600 mb-6">
                    Recebemos seus dados para a vaga de <strong>{job.title}</strong>. 
                    Boa sorte!
                </p>
                <button onClick={() => window.location.reload()} className="text-blue-600 underline text-sm">
                    Voltar
                </button>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden border border-gray-100">
        
        {/* Cabeçalho da Vaga */}
        <div className="bg-blue-600 p-8 text-white">
            <h1 className="text-3xl font-bold mb-2">{job.title}</h1>
            <div className="flex flex-wrap gap-4 text-blue-100 text-sm">
                <span className="flex items-center gap-1"><Briefcase size={16}/> {job.type}</span>
                <span className="flex items-center gap-1"><MapPin size={16}/> {job.location_type}</span>
                <span className="flex items-center gap-1"><Building size={16}/> Novva R&S</span>
            </div>
        </div>

        <div className="p-8 grid md:grid-cols-3 gap-8">
            {/* Coluna Esquerda: Descrição */}
            <div className="md:col-span-2 space-y-6">
                <div>
                    <h3 className="font-bold text-gray-800 text-lg mb-2">Sobre a Vaga</h3>
                    <p className="text-gray-600 whitespace-pre-line">{job.description || "Sem descrição detalhada."}</p>
                </div>
                {job.requirements && (
                    <div>
                        <h3 className="font-bold text-gray-800 text-lg mb-2">Requisitos</h3>
                        <p className="text-gray-600 whitespace-pre-line">{job.requirements}</p>
                    </div>
                )}
            </div>

            {/* Coluna Direita: Formulário */}
            <div className="md:col-span-1">
                <div className="bg-gray-50 p-6 rounded-lg border">
                    <h3 className="font-bold text-gray-800 mb-4">Inscreva-se</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Completo</label>
                            <input required className="w-full border p-2 rounded text-sm" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                            <input required type="email" className="w-full border p-2 rounded text-sm" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefone / WhatsApp</label>
                            <input required className="w-full border p-2 rounded text-sm" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cidade / Estado</label>
                            <input className="w-full border p-2 rounded text-sm" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Link do Currículo/LinkedIn</label>
                            <input required className="w-full border p-2 rounded text-sm" placeholder="URL do Google Drive, LinkedIn..." value={formData.resume_url} onChange={e => setFormData({...formData, resume_url: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Por que você?</label>
                            <textarea className="w-full border p-2 rounded text-sm" rows="3" placeholder="Resumo breve..." value={formData.motivation} onChange={e => setFormData({...formData, motivation: e.target.value})} />
                        </div>

                        <button 
                            disabled={submitting}
                            className="w-full bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700 transition flex justify-center items-center gap-2"
                        >
                           {submitting ? 'Enviando...' : <><Send size={16}/> Enviar Candidatura</>}
                        </button>
                    </form>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}