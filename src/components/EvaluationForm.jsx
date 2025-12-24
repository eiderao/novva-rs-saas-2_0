import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { Save, UserCheck, AlertCircle } from 'lucide-react';

export default function EvaluationForm({ applicationId, jobParameters, initialData, onSaved }) {
  // Estrutura para armazenar as respostas deste avaliador específico
  const [answers, setAnswers] = useState({
    triagem: initialData?.triagem || {},
    cultura: initialData?.cultura || {},
    tecnico: initialData?.tecnico || {}
  });
  
  const [notes, setNotes] = useState(initialData?.anotacoes_gerais || '');
  const [saving, setSaving] = useState(false);

  // Carrega dados iniciais se existirem (edição)
  useEffect(() => {
    if (initialData) {
        setAnswers({
            triagem: initialData.triagem || {},
            cultura: initialData.cultura || {},
            tecnico: initialData.tecnico || {}
        });
        setNotes(initialData.anotacoes_gerais || '');
    }
  }, [initialData]);

  // --- LÓGICA DE CÁLCULO INDIVIDUAL (COM NORMALIZAÇÃO) ---
  const calculatePillarScore = (sectionName, criteriaList) => {
    if (!criteriaList || criteriaList.length === 0) return null; // Retorna null se não houver critérios
    
    const ratingParams = jobParameters.notas || [];
    let totalScore = 0;
    let totalWeightAnswered = 0;
    let hasAnswers = false;

    criteriaList.forEach(criterion => {
        const noteId = answers[sectionName]?.[criterion.name];
        
        // Só calcula se o usuário tiver selecionado uma nota (Ignora "Não Avaliado")
        if (noteId) {
            const noteObj = ratingParams.find(n => n.id === noteId);
            if (noteObj) {
                hasAnswers = true;
                const weight = Number(criterion.weight) || 0;
                
                // Soma ponderada bruta: Nota * Peso
                totalScore += (Number(noteObj.valor) * weight);
                
                // Acumula o peso total do que foi respondido
                totalWeightAnswered += weight;
            }
        }
    });

    if (!hasAnswers || totalWeightAnswered === 0) return null; // Pilar não avaliado por este usuário

    // NORMALIZAÇÃO: Regra de três para projetar a nota para 100% do pilar
    // Ex: Se respondi itens que somam 50% de peso e tirei nota máxima neles, 
    // minha nota deve ser máxima no pilar, e não metade.
    // Fórmula: (Pontos Obtidos / Peso Respondido)
    // Se a escala de notas é 0-10, o resultado aqui será 0-10.
    return (totalScore / totalWeightAnswered).toFixed(2);
  };

  const handleSelection = (section, criteriaName, noteId) => {
      setAnswers(prev => {
          const newSection = { ...prev[section] };
          
          // Se clicar na mesma nota, desmarca (permite deixar "Não Avaliado")
          if (newSection[criteriaName] === noteId) {
              delete newSection[criteriaName];
          } else {
              newSection[criteriaName] = noteId;
          }

          return { ...prev, [section]: newSection };
      });
  };

  // Função auxiliar para recalcular a média global de TODOS os avaliadores no banco
  const updateCandidateGlobalScore = async () => {
      // 1. Busca TODAS as avaliações deste candidato
      const { data: allEvaluations, error: fetchError } = await supabase
          .from('evaluations')
          .select('scores')
          .eq('application_id', applicationId);

      if (fetchError) throw fetchError;

      // 2. Calcula a média por pilar separadamente
      let sumTriagem = 0, countTriagem = 0;
      let sumCultura = 0, countCultura = 0;
      let sumTecnico = 0, countTecnico = 0;

      allEvaluations.forEach(ev => {
          // Recalcula o score de cada avaliação salva (reutilizando a lógica local seria ideal, mas vamos simplificar aqui)
          // Nota: Aqui assumimos que o 'score_calculated' salvo no JSON é o score final do usuário para aquele pilar.
          // Para ser mais preciso, vamos ler os scores parciais salvos no payload.
          if (ev.scores.pillar_scores) {
              const p = ev.scores.pillar_scores;
              if (p.triagem != null) { sumTriagem += Number(p.triagem); countTriagem++; }
              if (p.cultura != null) { sumCultura += Number(p.cultura); countCultura++; }
              if (p.tecnico != null) { sumTecnico += Number(p.tecnico); countTecnico++; }
          }
      });

      // 3. Consolida a Nota 360° (Soma das médias dos pilares)
      const avgTriagem = countTriagem > 0 ? sumTriagem / countTriagem : 0;
      const avgCultura = countCultura > 0 ? sumCultura / countCultura : 0;
      const avgTecnico = countTecnico > 0 ? sumTecnico / countTecnico : 0;

      const finalGlobalScore = (avgTriagem + avgCultura + avgTecnico).toFixed(2);

      // 4. Salva na tabela principal
      await supabase
          .from('applications')
          .update({ score_general: finalGlobalScore })
          .eq('id', applicationId);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não logado");

      // Calcula as notas DESTE usuário
      const scoreTriagem = calculatePillarScore('triagem', jobParameters.triagem);
      const scoreCultura = calculatePillarScore('cultura', jobParameters.cultura);
      const scoreTecnico = calculatePillarScore('tecnico', jobParameters.tecnico || jobParameters['tÃ©cnico'] || jobParameters['técnico']);

      // Prepara o payload com metadados dos cálculos para facilitar a média global depois
      const payload = {
        triagem: answers.triagem,
        cultura: answers.cultura,
        tecnico: answers.tecnico,
        anotacoes_gerais: notes,
        pillar_scores: { // Salva o resultado calculado para agilizar a média
            triagem: scoreTriagem,
            cultura: scoreCultura,
            tecnico: scoreTecnico
        },
        evaluator_name: user.email, // Útil para log
        updated_at: new Date()
      };

      // 1. Salva a avaliação individual
      const { error: evalError } = await supabase
        .from('evaluations')
        .upsert({
            application_id: applicationId,
            evaluator_id: user.id,
            scores: payload, 
            notes: notes
        }, { onConflict: 'application_id, evaluator_id' });

      if (evalError) throw evalError;

      // 2. Dispara o recálculo da média global (360)
      await updateCandidateGlobalScore();

      alert("Avaliação salva com sucesso!");
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
    const myScore = calculatePillarScore(key, criteria); // Pode ser null

    return (
      <div className="mb-6 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h3 className="font-bold text-gray-800 uppercase text-sm tracking-wide">{title}</h3>
            {myScore !== null ? (
                <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded border border-blue-100">
                    Minha Nota: {myScore}
                </span>
            ) : (
                <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded border">
                    Não avaliado por mim
                </span>
            )}
        </div>

        <div className="space-y-4">
            {criteria.map((crit, idx) => (
                <div key={idx} className="relative group">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-medium text-gray-700 w-3/4">{crit.name}</span>
                        <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            Peso: {crit.weight}%
                        </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                        {ratingScale.map(option => {
                            const isSelected = answers[key]?.[crit.name] === option.id;
                            
                            return (
                                <button
                                    key={option.id}
                                    onClick={() => handleSelection(key, crit.name, option.id)}
                                    className={`
                                        px-3 py-1 text-xs rounded border transition-all
                                        ${isSelected 
                                            ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-md' 
                                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                                        }
                                    `}
                                >
                                    {option.nome} ({option.valor})
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

  if (!jobParameters) return <div className="p-10 text-center">Carregando parâmetros...</div>;

  return (
    <div className="bg-gray-50 p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4 text-sm text-gray-600 bg-yellow-50 p-3 rounded border border-yellow-100">
        <UserCheck size={16} />
        <p>Você está avaliando como: <strong>Usuário Logado</strong>. Sua nota será computada na média geral.</p>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-2">
          {renderSection("triagem", "1. Triagem", jobParameters.triagem)}
          {renderSection("cultura", "2. Fit Cultural", jobParameters.cultura)}
          {renderSection("tecnico", "3. Teste Técnico", jobParameters.tecnico || jobParameters['tÃ©cnico'] || jobParameters['técnico'])}

          <div className="mt-4 bg-white p-4 rounded border">
            <label className="font-bold text-gray-700 text-xs uppercase mb-2 block">Feedback / Anotações</label>
            <textarea
                className="w-full p-3 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                rows="3"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Detalhes sobre a avaliação..."
            />
          </div>
      </div>

      <div className="mt-4 pt-4 border-t">
        <button 
            onClick={handleSave} 
            disabled={saving}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg shadow font-bold flex justify-center items-center gap-2 transition disabled:opacity-50"
        >
            {saving ? "Salvando..." : <><Save size={18}/> Salvar Minha Avaliação</>}
        </button>
      </div>
    </div>
  );
}