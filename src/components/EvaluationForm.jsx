import React, { useState } from 'react';
import { supabase } from '../supabase/client';

export default function EvaluationForm({ applicationId, jobParameters, initialData, onSaved }) {
  const [scores, setScores] = useState(initialData?.scores || {});
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  // Regra 3: Cálculo no Frontend ignorando N/A
  const calculateScore = () => {
    let total = 0;
    let max = 0;
    
    // Mapeia valores: { "1": 0, "2": 50, "3": 100 }
    const notesMap = new Map((jobParameters.notas || []).map(n => [n.id, Number(n.valor)]));

    ['triagem', 'cultura', 'tecnico'].forEach(section => {
      const criteria = jobParameters[section] || [];
      criteria.forEach(crit => {
        const voteId = scores[section]?.[crit.name];
        
        // Se tem voto e não é N/A
        if (voteId && voteId !== 'NA') {
          const val = notesMap.get(voteId) || 0;
          const weight = Number(crit.weight) || 1;
          
          total += val * weight;
          max += 100 * weight; // O máximo possível nesse critério
        }
      });
    });

    if (max === 0) return 0;
    return Number(((total / max) * 100).toFixed(1));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão inválida");

      const finalScore = calculateScore();

      // Upsert na tabela evaluations (Regra 2)
      const { error } = await supabase.from('evaluations').upsert({
        application_id: applicationId,
        evaluator_id: user.id,
        scores,
        notes,
        final_score: finalScore,
        created_at: new Date()
      }, { onConflict: 'application_id, evaluator_id' });

      if (error) throw error;

      alert(`Avaliação salva com sucesso! Nota calculada: ${finalScore}`);
      if (onSaved) onSaved();

    } catch (err) {
      alert("Erro ao salvar: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper para renderizar selects
  const renderSection = (title, key, colorClass) => (
    <div className="mb-6 p-4 bg-gray-50 rounded border">
      <h4 className={`font-bold mb-3 uppercase text-xs tracking-wider ${colorClass}`}>{title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(jobParameters[key] || []).map(crit => (
          <div key={crit.name}>
            <label className="block text-sm text-gray-600 mb-1">{crit.name}</label>
            <select 
              className="w-full border rounded p-2 text-sm bg-white"
              value={scores[key]?.[crit.name] || ''}
              onChange={e => setScores({
                ...scores, 
                [key]: { ...scores[key], [crit.name]: e.target.value }
              })}
            >
              <option value="">Selecione...</option>
              <option value="NA">N/A (Não Avaliar)</option>
              <hr/>
              {jobParameters.notas.map(n => (
                <option key={n.id} value={n.id}>{n.nome} ({n.valor})</option>
              ))}
            </select>
          </div>
        ))}
        {(jobParameters[key] || []).length === 0 && <p className="text-gray-400 text-sm">Sem critérios definidos.</p>}
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h3 className="text-lg font-bold mb-6 border-b pb-2">Minha Avaliação Individual</h3>
      
      {renderSection('Triagem', 'triagem', 'text-purple-600')}
      {renderSection('Fit Cultural', 'cultura', 'text-green-600')}
      {renderSection('Técnico', 'tecnico', 'text-blue-600')}

      <div className="mb-6">
        <label className="block font-bold text-sm text-gray-700 mb-2">Observações (Regra 4)</label>
        <textarea 
          className="w-full border rounded p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          rows="4"
          placeholder="Comentários sobre o desempenho do candidato..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>

      <div className="flex justify-end">
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {isSaving ? 'Salvando...' : 'Salvar Avaliação'}
        </button>
      </div>
    </div>
  );
}