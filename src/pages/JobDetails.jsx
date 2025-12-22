import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Loader2, ArrowLeft, MapPin, Briefcase, Calendar, Share2, User, Download, Settings, Plus, Trash2, Save } from 'lucide-react';

export default function JobDetails() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [savingParams, setSavingParams] = useState(false);
  const [evalParams, setEvalParams] = useState({ triagem: [], tecnico: [], cultura: [] });

  useEffect(() => {
    const fetchJobDetails = async () => {
      try {
        setLoading(true);
        const { data: jobData, error: jobError } = await supabase.from('jobs').select('*').eq('id', id).single();
        if (jobError) throw jobError;
        setJob(jobData);
        
        if (jobData.parameters) {
          setEvalParams({
            triagem: jobData.parameters.triagem || [],
            tecnico: jobData.parameters.tecnico || [],
            cultura: jobData.parameters.cultura || []
          });
        }

        const { data: appsData, error: appsError } = await supabase
          .from('applications')
          .select(`*, candidate:candidates(name, email, city, resume_url)`)
          .eq('jobId', id)
          .order('created_at', { ascending: false });
        if (appsError) throw appsError;
        setCandidates(appsData || []);
      } catch (error) {
        console.error('Erro:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchJobDetails();
  }, [id]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/vagas/${id}/candidatar`);
    alert('Link copiado!');
  };

  const handleSaveParameters = async () => {
    setSavingParams(true);
    try {
        await supabase.from('jobs').update({ parameters: evalParams }).eq('id', id);
        alert('Salvo com sucesso!');
    } catch(e) { console.error(e); }
    finally { setSavingParams(false); }
  };

  // Funções auxiliares para manipulação de critérios (simplificadas)
  const addCriteria = (type) => {
    const text = prompt("Novo critério:");
    if(text) setEvalParams(p => ({...p, [type]: [...p[type], {id: crypto.randomUUID(), text, weight: 1}]}));
  };
  const removeCriteria = (type, id) => setEvalParams(p => ({...p, [type]: p[type].filter(x => x.id !== id)}));

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin w-8 h-8 text-blue-600"/></div>;
  if (!job) return <div className="text-center p-10">Vaga não encontrada</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link to="/jobs" className="inline-flex items-center text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="w-4 h-4 mr-2"/> Voltar</Link>
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">{job.title}</h1>
                <div className="flex gap-4 mt-2 text-sm text-gray-500">
                    <span className="flex items-center"><MapPin className="w-4 h-4 mr-1"/> {job.location || 'Remoto'}</span>
                    <span className="flex items-center"><Briefcase className="w-4 h-4 mr-1"/> {job.type || 'CLT'}</span>
                    <span className="flex items-center"><Calendar className="w-4 h-4 mr-1"/> {new Date(job.created_at).toLocaleDateString()}</span>
                </div>
            </div>
            <Button variant="outline" onClick={handleCopyLink}><Share2 className="w-4 h-4 mr-2"/> Compartilhar</Button>
        </div>
      </div>

      <div className="border-b border-gray-200 mb-6 flex gap-8">
        {['details', 'candidates', 'evaluation'].map(tab => (
            <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
                {tab === 'details' ? 'Detalhes' : tab === 'candidates' ? `Candidatos (${candidates.length})` : 'Avaliação'}
            </button>
        ))}
      </div>

      {activeTab === 'details' && (
        <div className="bg-white p-6 rounded-lg shadow-sm border space-y-6">
            <div><h3 className="font-medium text-gray-900">Descrição</h3><p className="mt-2 text-gray-600 whitespace-pre-wrap">{job.description}</p></div>
            <div><h3 className="font-medium text-gray-900">Requisitos</h3><p className="mt-2 text-gray-600 whitespace-pre-wrap">{job.requirements}</p></div>
        </div>
      )}

      {activeTab === 'candidates' && (
        <div className="space-y-4">
            {candidates.map(app => (
                <div key={app.id} className="bg-white p-4 rounded-lg border shadow-sm flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">{app.candidate?.name?.[0]}</div>
                        <div>
                            <p className="font-medium text-gray-900">{app.candidate?.name}</p>
                            <p className="text-sm text-gray-500">{app.candidate?.email}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {app.resumeUrl && <a href={app.resumeUrl} target="_blank" className="p-2 text-gray-500 border rounded-full hover:bg-gray-50"><Download className="w-4 h-4"/></a>}
                        <Link to={`/evaluations/${app.id}`}><Button size="sm" variant="outline">Avaliar</Button></Link>
                    </div>
                </div>
            ))}
            {candidates.length === 0 && <div className="text-center py-10 text-gray-500">Nenhum candidato ainda.</div>}
        </div>
      )}

      {activeTab === 'evaluation' && (
        <div className="bg-white p-6 rounded-lg border shadow-sm space-y-6">
            <div className="flex justify-between">
                <h3 className="font-medium">Critérios Técnicos</h3>
                <Button size="sm" variant="ghost" onClick={() => addCriteria('tecnico')}><Plus className="w-4 h-4 mr-2"/> Adicionar</Button>
            </div>
            {evalParams.tecnico.map(item => (
                <div key={item.id} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                    <span>{item.text}</span>
                    <button onClick={() => removeCriteria('tecnico', item.id)} className="text-red-500"><Trash2 className="w-4 h-4"/></button>
                </div>
            ))}
            <div className="pt-4 border-t flex justify-end">
                <Button onClick={handleSaveParameters} disabled={savingParams}>
                    {savingParams ? <Loader2 className="animate-spin w-4 h-4"/> : <><Save className="w-4 h-4 mr-2"/> Salvar Configurações</>}
                </Button>
            </div>
        </div>
      )}
    </div>
  );
}