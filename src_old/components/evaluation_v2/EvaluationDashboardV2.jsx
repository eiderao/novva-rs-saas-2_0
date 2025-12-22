import React, { useEffect, useState } from 'react';
import { prepareEvaluationV2, getEvaluationSummaryV2 } from '../../services/evaluationService';
import { supabase } from '../../supabase/client';

export default function EvaluationDashboardV2({ applicationId, jobId, currentUser }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [viewMode, setViewMode] = useState('summary'); // 'summary' ou 'evaluate'

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        // Garante que o banco está pronto
        await prepareEvaluationV2(jobId);
        // Carrega dados
        const data = await getEvaluationSummaryV2(applicationId);
        setSummary(data);
      } catch (error) {
        console.error("Erro ao carregar V2:", error);
      } finally {
        setLoading(false);
      }
    };
    if (jobId && applicationId) init();
  }, [applicationId, jobId]);

  if (loading) return <div className="p-4 text-center">Carregando Avaliação 360º...</div>;

  return (
    <div className="bg-white rounded-lg shadow p-6 mt-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Avaliação 360º</h2>
        <button 
          onClick={() => setViewMode(viewMode === 'summary' ? 'evaluate' : 'summary')}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          {viewMode === 'summary' ? 'Minha Avaliação' : 'Voltar ao Resumo'}
        </button>
      </div>

      {viewMode === 'summary' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card da Nota Final */}
          <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 text-center">
            <span className="block text-gray-500 text-sm uppercase tracking-wide">Média Geral</span>
            <span className="block text-5xl font-extrabold text-blue-600 mt-2">
              {summary?.final_score || '-'}
            </span>
          </div>
          
          {/* Lista de Avaliadores */}
          <div className="col-span-2">
            <h3 className="font-semibold text-gray-700 mb-3">Avaliadores Participantes</h3>
            <div className="flex gap-2">
              {summary?.evaluators?.map(ev => (
                <span key={ev.id} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  {ev.name}
                </span>
              ))}
              {(!summary?.evaluators || summary.evaluators.length === 0) && (
                <span className="text-gray-400 italic">Nenhuma avaliação concluída ainda.</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
          {/* AQUI ENTRARÁ O FORMULÁRIO DE NOTAS NO PRÓXIMO PASSO */}
          <p>O formulário de avaliação individual será carregado aqui.</p>
        </div>
      )}
    </div>
  );
}