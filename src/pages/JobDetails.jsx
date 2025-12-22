import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { ArrowLeft, User } from 'lucide-react';

export default function JobDetails() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      // 1. Vaga
      const { data: j } = await supabase.from('jobs').select('*').eq('id', jobId).single();
      setJob(j);

      // 2. Candidatos (Applications)
      const { data: apps } = await supabase
        .from('applications')
        .select('*, candidate:candidates(*)')
        .eq('jobId', jobId);
      
      setCandidates(apps || []);
      setLoading(false);
    };
    fetch();
  }, [jobId]);

  const createFakeCandidate = async () => {
    // Helper para você testar sem precisar criar form de candidatura externo agora
    const { data: cand } = await supabase.from('candidates').select('id').limit(1).single();
    if(cand) {
        await supabase.from('applications').insert({
            jobId: jobId,
            candidateId: cand.id,
            status: 'new',
            formData: { motivation: "Quero muito essa vaga!" }
        });
        window.location.reload();
    } else {
        alert("Rode o SQL de inserção de candidato fictício primeiro!");
    }
  };

  if (loading) return <div className="p-10 text-center">Carregando...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <button onClick={() => navigate('/')} className="flex items-center text-gray-500 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4 mr-2"/> Voltar para Dashboard
      </button>

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{job?.title}</h1>
        <button onClick={createFakeCandidate} className="text-sm text-blue-600 underline">
          + Simular Candidato (Teste)
        </button>
      </div>

      <div className="bg-white rounded shadow border">
        {candidates.length === 0 ? (
          <div className="p-10 text-center text-gray-500">Nenhum candidato ainda.</div>
        ) : (
          candidates.map(app => (
            <div 
              key={app.id} 
              onClick={() => navigate(`/applications/${app.id}`)}
              className="p-4 border-b last:border-0 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600">
                  <User size={20}/>
                </div>
                <div>
                  <p className="font-bold text-gray-800">{app.candidate?.name}</p>
                  <p className="text-xs text-gray-500">{app.candidate?.email}</p>
                </div>
              </div>
              <div className="text-sm text-blue-600 font-medium">Avaliar →</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}