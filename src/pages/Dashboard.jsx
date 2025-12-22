import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';

export default function Dashboard({ session }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Busca simplificada direta para testar conexão
      const { data, error } = await supabase
        .from('jobs')
        .select('*'); // Seleciona tudo simples primeiro

      if (error) throw error;
      setJobs(data || []);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createTestJob = async () => {
    // Cria uma vaga de teste para validar a escrita
    const { error } = await supabase.from('jobs').insert({
        title: "Vaga Teste V2",
        status: "active",
        tenantId: session.user.id, // Assumindo tenantId = userId provisoriamente para teste
        description: "Teste de criação",
        type: "CLT"
    });
    if (error) alert("Erro ao criar: " + error.message);
    else fetchData();
  };

  const handleLogout = () => supabase.auth.signOut();

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Dashboard V2.0 (Limpo)</h1>
        <button onClick={handleLogout} className="text-red-600">Sair</button>
      </div>

      {error && <div className="bg-red-100 p-4 text-red-700 mb-4 rounded">Erro: {error}</div>}

      <button onClick={createTestJob} className="bg-green-600 text-white px-4 py-2 rounded mb-6">
        + Criar Vaga Teste
      </button>

      {loading ? (
        <p>Carregando dados...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {jobs.length === 0 ? <p>Nenhuma vaga encontrada.</p> : jobs.map(job => (
            <div key={job.id} className="bg-white p-4 rounded shadow border">
              <h3 className="font-bold text-lg">{job.title}</h3>
              <p className="text-sm text-gray-500">Status: {job.status}</p>
              <p className="text-sm mt-2">{job.description || "Sem descrição"}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}