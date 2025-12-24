import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { Save } from 'lucide-react';

export default function EvaluationForm({ applicationId, jobParameters, initialData, onSaved }) {
  const [answers, setAnswers] = useState(initialData?.scores || {});
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
        setAnswers(initialData.scores || {});
        setNotes(initialData.notes || '');
    }
  }, [initialData]);

  // --- NOVA LÓGICA DE CÁLCULO POR PILAR ---
  
  // 1. Calcula a nota de UM pilar específico (ex: só Triagem)
  // Retorna um valor de 0 a Nota Máxima da Escala (ex: 10)
  const calculatePillarScore = (questions) => {
    if (!questions || questions.length === 0) return 0;
    
    const ratingScale = jobParameters.notas || [];
    let pillarScore = 0;

    questions.forEach(q => {
        const selectedOptionId = answers[q.id];
        if (selectedOptionId) {
            const option = ratingScale.find(r => r.id === selectedOptionId);
            if (option) {
                // Peso da pergunta (ex: 20%)
                const weightPercent = q.weight !== undefined ? Number(q.weight) : 0;
                
                // Cálculo: Nota da Opção * (Peso / 100)
                // Ex: 5 (Atende) * (25 / 100) = 1.25 pontos
                const points = Number(option.valor) * (weightPercent / 100);
                
                pillarScore += points;
            }
        }
    });

    return pillarScore;
  };

  // 2. Calcula o TOTAL GERAL (Soma dos 3 pilares)
  // Máximo esperado: 30 (se a escala for até 10)
  const calculateTotalScore = () => {
      if (!jobParameters) return 0;
      
      const scoreTriagem = calculatePillarScore(jobParameters.triagem);
      const scoreCultura = calculatePillarScore(jobParameters.cultura);
      const scoreTecnico = calculatePillarScore(jobParameters.tecnico);

      const total = scoreTriagem + scoreCultura + scoreTecnico;
      
      // Arredonda para 2 casas decimais para ficar bonito (ex: 22.50)
      return Math.round(total * 100) / 100;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não logado");

      const finalScore = calculateTotalScore();

      const payload = {
        application_id: applicationId,
        evaluator_id: user.id,
        scores: answers,
        notes: notes,
        final_score: finalScore,
        updated_at: new Date()
      };

      const { error: evalError } = await supabase
        .from('evaluations')
        .upsert(payload, { onConflict: 'application_id, evaluator_id' });

      if (evalError) throw evalError;

      const { error: appError } = await supabase
        .from('applications')
        .update({ score_general: finalScore })
        .eq('id', applicationId);

      if (appError) throw appError;

      alert(`Avaliação salva! Nota Final Calculada: ${finalScore} / 30`);
      if (onSaved) onSaved();

    } catch (error) {
      console.error(error);
      alert("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Renderiza a seção com o subtotal calculado ao lado do título
  const renderSection = (title, questions) => {
    if (!questions || questions.length === 0) return null;
    
    const ratingScale = jobParameters.notas || [];
    // Calcula a nota parcial deste pilar em tempo real
    const partialScore = calculatePillarScore(questions).toFixed(2);

    return (
      <div className="mb-6 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h3 className="font-bold text-gray-800 uppercase text-sm tracking-wide">
                {title}
            </h3>
            <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2 py-1 rounded">
                Parcial: {partialScore} pts
            </span>
        </div>

        <div className="space-y-4">
            {questions.map(q => {
                const weightPercent = q.weight !== undefined ? Number(q.weight) : 0;

                return (
                    <div key={q.id} className="relative">
                        <div className="flex justify-between items-start mb-1">
                            <p className="text-sm font-medium text-gray-700 w-3/4">{q.text}</p>
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                Peso: {weightPercent}%
                            </span>
                        </div>
                        
                        <div className="flex gap-2 flex-wrap">
                            {ratingScale.map(option => {
                                const isSelected = answers[q.id] === option.id;
                                let colorClass = isSelected 
                                    ? "bg-blue-600 text-white border-blue-600 shadow-md"
                                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50";
                                
                                // Simula o cálculo visual para o usuário
                                const valCalc = (Number(option.valor) * (weightPercent / 100)).toFixed(2);

                                return (
                                    <button
                                        key={option.id}
                                        onClick={() => setAnswers({ ...answers, [q.id]: option.id })}
                                        className={`px-3 py-1.5 text-xs rounded transition-all border ${colorClass}`}
                                    >
                                        {option.nome} 
                                        {/* Mostra quanto vai somar na nota final */}
                                        <span className={`text-[10px] ml-1 ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                                            (+{valCalc})
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    );
  };

  if (!jobParameters) return <div className="p-4 text-center text-gray-500">Carregando parâmetros...</div>;

  return (
    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6 bg-white p-4 rounded border shadow-sm">
        <div>
            <h2 className="text-lg font-bold text-gray-800">Avaliação Técnica</h2>
            <p className="text-xs text-gray-500">Some pontos nos 3 pilares</p>
        </div>
        <div className="text-right">
            <span className="text-xs text-gray-500 uppercase block font-bold">Nota Geral (0-30)</span>
            <span className="text-3xl font-black text-blue-600">{calculateTotalScore().toFixed(2)}</span>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 pr-2 space-y-2">
          {renderSection("1. Triagem (Max 10)", jobParameters.triagem)}
          {renderSection("2. Fit Cultural (Max 10)", jobParameters.cultura)}
          {renderSection("3. Teste Técnico (Max 10)", jobParameters.tecnico)}

          <div className="mt-4 bg-white p-4 rounded border">
            <label className="font-bold text-gray-700 text-xs uppercase mb-2 block">Anotações / Feedback</label>
            <textarea
                className="w-full p-3 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                rows="3"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Observações finais sobre o candidato..."
            />
          </div>
      </div>

      <div className="mt-4 pt-4 border-t flex justify-end">
        <button 
            onClick={handleSave} 
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded shadow-lg font-bold flex items-center gap-2 transition disabled:opacity-50 transform hover:scale-105"
        >
            {saving ? "Salvando..." : <><Save size={18}/> Finalizar Avaliação</>}
        </button>
      </div>
    </div>
  );
}