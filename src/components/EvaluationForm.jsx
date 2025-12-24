import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { Save } from 'lucide-react';

export default function EvaluationForm({ applicationId, jobParameters, initialData, onSaved }) {
  // Estrutura inicial corrigida
  const [evaluation, setEvaluation] = useState({
    triagem: initialData?.triagem || {},
    cultura: initialData?.cultura || {},
    // CORREÇÃO AQUI: Usamos bracket notation ['técnico'] para evitar erro de sintaxe
    tecnico: initialData?.['técnico'] || initialData?.tecnico || {} 
  });
  
  const [notes, setNotes] = useState(initialData?.anotacoes_gerais || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
        setEvaluation({
            triagem: initialData.triagem || {},
            cultura: initialData.cultura || {},
            tecnico: initialData['técnico'] || initialData.tecnico || {}
        });
        setNotes(initialData.anotacoes_gerais || '');
    }
  }, [initialData]);

  // --- CÁLCULO DA NOTA PONDERADA (0 a 10 por pilar) ---
  const calculatePillarScore = (sectionName, criteriaList) => {
    if (!criteriaList || criteriaList.length === 0) return 0;
    
    // Mapeamento das notas (Ex: ID 1 -> Valor 10)
    const ratingParams = jobParameters.notas || [];
    let pillarScore = 0;

    // Itera sobre os critérios definidos na vaga
    criteriaList.forEach(criterion => {
        // Busca qual nota foi selecionada para este critério específico
        const selectedNoteId = evaluation[sectionName]?.[criterion.name];
        
        if (selectedNoteId) {
            const noteObj = ratingParams.find(n => n.id === selectedNoteId);
            if (noteObj) {
                // FÓRMULA: (Valor da Nota * Peso) / 100
                const points = (Number(noteObj.valor) * Number(criterion.weight)) / 100;
                pillarScore += points;
            }
        }
    });

    return pillarScore;
  };

  const calculateTotalScore = () => {
      if (!jobParameters) return 0;
      
      const s1 = calculatePillarScore('triagem', jobParameters.triagem);
      const s2 = calculatePillarScore('cultura', jobParameters.cultura);
      // Normaliza a busca pelo parâmetro técnico
      const tecnicoParams = jobParameters['técnico'] || jobParameters.tecnico;
      const s3 = calculatePillarScore('tecnico', tecnicoParams);

      // Soma simples dos 3 pilares (Máximo 30)
      return (s1 + s2 + s3).toFixed(1);
  };

  const handleChange = (section, criteriaName, noteId) => {
      setEvaluation(prev => ({
          ...prev,
          [section]: {
              ...prev[section],
              [criteriaName]: noteId
          }
      }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não logado");

      const finalScore = calculateTotalScore();

      // Payload limpo e corrigido
      const payload = {
        triagem: evaluation.triagem,
        cultura: evaluation.cultura,
        tecnico: evaluation.tecnico, // Salva como 'tecnico' (sem acento) para padronizar
        anotacoes_gerais: notes,
        score_calculated: finalScore,
        updated_at: new Date()
      };

      // 1. Atualiza a tabela applications
      const { error: appError } = await supabase
        .from('applications')
        .update({ 
            evaluation: payload,
            score_general: finalScore 
        })
        .eq('id', applicationId);

      if (appError) throw appError;

      // 2. Atualiza tabela evaluations (se existir)
      const { error: evalError } = await supabase
        .from('evaluations')
        .upsert({
            application_id: applicationId,
            evaluator_id: user.id,
            scores: payload,
            final_score: finalScore
        }, { onConflict: 'application_id, evaluator_id' });

      if (evalError) console.warn("Aviso tabela evaluations:", evalError);

      alert(`Avaliação salva! Nota Final: ${finalScore} / 30`);
      if (onSaved) onSaved();

    } catch (error) {
      console.error(error);
      alert("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const renderSection = (key, title, criteria) => {
    if (!criteria || criteria.length === 0) return null;
    
    const ratingScale = jobParameters.notas || [];
    const currentScore = calculatePillarScore(key, criteria).toFixed(1);

    return (
      <div className="mb-6 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h3 className="font-bold text-gray-800 uppercase text-sm tracking-wide">{title}</h3>
            <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded border border-blue-100">
                Nota: {currentScore} / 10
            </span>
        </div>

        <div className="space-y-4">
            {criteria.map((crit, idx) => (
                <div key={idx} className="relative">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-medium text-gray-700 w-2/3">{crit.name}</span>
                        <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            Peso: {crit.weight}%
                        </span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                        {ratingScale.map(option => {
                            const isSelected = evaluation[key]?.[crit.name] === option.id;
                            const points = ((Number(option.valor) * Number(crit.weight)) / 100).toFixed(1);

                            return (
                                <button
                                    key={option.id}
                                    onClick={() => handleChange(key, crit.name, option.id)}
                                    className={`
                                        py-2 px-1 text-xs rounded border transition-all text-center
                                        ${isSelected 
                                            ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-md' 
                                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                        }
                                    `}
                                >
                                    <div className="font-bold">{option.nome}</div>
                                    <div className={`text-[10px] ${isSelected ? 'text-blue-200' : 'text-gray-400'}`}>
                                        +{points} pts
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
      </div>
    );
  };

  if (!jobParameters) return <div className="p-10 text-center">Carregando critérios...</div>;

  return (
    <div className="bg-gray-50 p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-lg border shadow-sm sticky top-0 z-10">
        <div>
            <h2 className="text-lg font-bold text-gray-800">Avaliação</h2>
            <p className="text-xs text-gray-500">Soma dos 3 pilares</p>
        </div>
        <div className="text-right">
            <span className="text-xs text-gray-500 uppercase block font-bold">Total</span>
            <span className="text-3xl font-black text-blue-600">{calculateTotalScore()} <span className="text-sm text-gray-400 font-normal">/30</span></span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-2">
          {renderSection("triagem", "1. Triagem", jobParameters.triagem)}
          {renderSection("cultura", "2. Fit Cultural", jobParameters.cultura)}
          {/* Tenta buscar 'técnico' com ou sem acento nos parâmetros */}
          {renderSection("tecnico", "3. Teste Técnico", jobParameters['técnico'] || jobParameters.tecnico)}

          <div className="mt-4 bg-white p-4 rounded border">
            <label className="font-bold text-gray-700 text-xs uppercase mb-2 block">Anotações Gerais</label>
            <textarea
                className="w-full p-3 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                rows="3"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Observações finais..."
            />
          </div>
      </div>

      <div className="mt-4 pt-4 border-t">
        <button 
            onClick={handleSave} 
            disabled={saving}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg shadow font-bold flex justify-center items-center gap-2 transition disabled:opacity-50"
        >
            {saving ? "Salvando..." : <><Save size={18}/> Salvar Avaliação</>}
        </button>
      </div>
    </div>
  );
}