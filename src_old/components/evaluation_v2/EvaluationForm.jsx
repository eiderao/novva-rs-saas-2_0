import React, { useState } from 'react';
import { supabase } from '../supabase/client';
import { useAuth } from '../context/AuthContext';

export default function EvaluationForm({ applicationId, jobParameters, initialData, onSaved }) {
  const { user } = useAuth();
  const [scores, setScores] = useState(initialData?.scores || {});
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  // Cálculo de Nota no Frontend (Regra 3: Ignora N/A)
  const calculateScore = () => {
    let total = 0;
    let max = 0;
    const notesMap = new Map((jobParameters.notas || []).map(n => [n.id, Number(n.valor)]));

    ['triagem', 'cultura', 'tecnico'].forEach(section => {
      const criteria = jobParameters[section] || [];
      criteria.forEach(crit => {
        const vote = scores[section]?.[crit.name];
        if (vote && vote !== 'NA') {
          const val = notesMap.get(vote) || 0;
          const weight = Number(crit.weight) || 1;
          total += val * weight;
          max += 100 * weight;
        }
      });
    });

    return max === 0 ? 0 : Number(((total / max) * 100).toFixed(1));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const finalScore = calculateScore();
      
      const { error } = await supabase.from('evaluations').upsert({
        application_id: applicationId,
        evaluator_id: user.id,
        scores,
        notes,
        final_score: finalScore,
        created_at: new Date() // Atualiza timestamp
      }, { onConflict: 'application_id, evaluator_id' });

      if (error) throw error;
      alert(`Salvo! Sua nota: ${finalScore}`);
      if (onSaved) onSaved();

    } catch (err) {
      alert("Erro ao salvar: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white p-6 border rounded-lg space-y-6">
      <h3 className="font-bold text-lg border-b pb-2">Minha Avaliação (V2.0)</h3>
      
      {['triagem', 'cultura', 'tecnico'].map(section => (
        <div key={section} className="p-4 bg-gray-50 rounded">
          <h4 className="font-semibold capitalize mb-3 text-blue-800">{section}</h4>
          <div className="grid gap-4 md:grid-cols-2">
            {jobParameters[section]?.map(crit => (
              <div key={crit.name}>
                <label className="block text-xs font-medium text-gray-500 mb-1">{crit.name}</label>
                <select 
                  className="w-full border rounded p-2 text-sm"
                  value={scores[section]?.[crit.name] || ''}
                  onChange={e => setScores({
                    ...scores, 
                    [section]: { ...scores[section], [crit.name]: e.target.value }
                  })}
                >
                  <option value="">Selecione...</option>
                  <option value="NA">N/A (Não Avaliar)</option>
                  <optgroup label="Notas">
                    {jobParameters.notas.map(n => (
                      <option key={n.id} value={n.id}>{n.nome}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div>
        <label className="block font-medium mb-1">Observações</label>
        <textarea 
          className="w-full border rounded p-2" 
          rows="4"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Comentários sobre o candidato..."
        />
      </div>

      <div className="flex justify-end">
        <button 
          onClick={handleSave} 
          disabled={isSaving}
          className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {isSaving ? 'Salvando...' : 'Salvar Avaliação'}
        </button>
      </div>
    </div>
  );
}