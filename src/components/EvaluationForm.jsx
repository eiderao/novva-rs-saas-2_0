import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { Save, UserCheck, MessageSquare } from 'lucide-react';
import { Box, Typography, Paper, Grid, Button, TextField } from '@mui/material';
import { processEvaluation } from '../utils/evaluationLogic';

export default function EvaluationForm({ applicationId, jobParameters, initialData, allEvaluations, onSaved }) {
  const [answers, setAnswers] = useState({ triagem: {}, cultura: {}, tecnico: {} });
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
        // CORREÇÃO CRÍTICA:
        // Verifica se os scores estão em uma propriedade 'scores' (V2) ou na raiz do objeto (V1/Flat).
        // O JSON que você mostrou no banco é plano, então 'initialData.scores' é undefined.
        // O fallback '|| initialData' pega os dados da raiz corretamente.
        const sourceData = initialData.scores || initialData;

        // Normalização da chave 'tecnico' (com ou sem acento/encoding)
        const tecnicoData = sourceData.tecnico || sourceData['técnico'] || sourceData['tÃ©cnico'] || {};

        setAnswers({
            triagem: sourceData.triagem || {},
            cultura: sourceData.cultura || {},
            tecnico: tecnicoData
        });

        // Carrega notas: tenta 'notes' (novo), depois 'anotacoes_gerais' na raiz, depois dentro de scores
        const loadedNotes = initialData.notes || initialData.anotacoes_gerais || sourceData.anotacoes_gerais || '';
        setNotes(loadedNotes);
    }
  }, [initialData]);

  // Calcula a nota em tempo real
  const currentScores = processEvaluation({ scores: answers }, jobParameters);

  const handleSelection = (section, criteriaName, noteId) => {
      setAnswers(prev => {
          const newSection = { ...(prev[section] || {}) };
          
          // Lógica de Toggle com conversão para String para garantir comparação (UUID vs String)
          if (String(newSection[criteriaName]) === String(noteId)) {
              delete newSection[criteriaName];
          } else {
              newSection[criteriaName] = noteId;
          }
          
          return { ...prev, [section]: newSection };
      });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada. Faça login novamente.");

      const finalCalc = processEvaluation({ scores: answers }, jobParameters);

      // Prepara o payload.
      // Nota: Salvamos 'scores' contendo as respostas para manter compatibilidade futura com 'initialData.scores'
      const payload = {
        triagem: answers.triagem,
        cultura: answers.cultura,
        tecnico: answers.tecnico,
        anotacoes_gerais: notes,
        pillar_scores: finalCalc,
        evaluator_name: user.email,
        updated_at: new Date()
      };

      const { error: evalError } = await supabase.from('evaluations').upsert({
            application_id: applicationId,
            evaluator_id: user.id,
            scores: payload, // Salva o objeto completo dentro da coluna JSONB 'scores'
            notes: notes,    // Salva também na coluna dedicada 'notes' se existir, ou redundante
            final_score: finalCalc.total
        }, { onConflict: 'application_id, evaluator_id' });

      if (evalError) throw evalError;
      alert("Avaliação salva com sucesso!");
      if (onSaved) onSaved();
    } catch (error) { 
        alert("Erro ao salvar: " + error.message); 
    } finally { 
        setSaving(false); 
    }
  };

  const renderSectionCompact = (key, title, criteria) => {
    if (!criteria || criteria.length === 0) return null;

    const ratingScale = jobParameters?.notas || [];
    const sectionScore = currentScores[key] || 0;
    
    return (
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderColor: '#e0e0e0', bgcolor: '#fff' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#1976d2' }}>
                {title}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 'bold', bgcolor: '#e3f2fd', px: 1, py: 0.5, borderRadius: 1 }}>
                Nota: {sectionScore.toFixed(1)}
            </Typography>
        </Box>
        {criteria.map((crit, idx) => {
            // Busca o valor salvo no estado.
            // A chave 'key' aqui é 'triagem', 'cultura' ou 'tecnico' (já normalizado no estado)
            const savedValue = answers[key]?.[crit.name];

            return (
                <Box key={idx} sx={{ mb: 1.5, borderBottom: '1px dashed #eee', pb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 500, width: '80%', lineHeight: 1.2 }}>
                            {crit.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {crit.weight}%
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {ratingScale.map(option => {
                            // Comparação segura convertendo tudo para String (trata UUIDs vs IDs numéricos)
                            const isSelected = String(savedValue) === String(option.id);

                            return (
                                <Button 
                                    key={option.id} 
                                    size="small" 
                                    onClick={() => handleSelection(key, crit.name, option.id)}
                                    sx={{ 
                                        minWidth: '30px', 
                                        height: '24px', 
                                        fontSize: '0.65rem', 
                                        p: '0 8px', 
                                        textTransform: 'none', 
                                        bgcolor: isSelected ? '#1976d2' : '#f5f5f5', 
                                        color: isSelected ? '#fff' : '#666', 
                                        '&:hover': { 
                                            bgcolor: isSelected ? '#1565c0' : '#eeeeee' 
                                        } 
                                    }}
                                >
                                    {option.nome}
                                </Button>
                            );
                        })}
                    </Box>
                </Box>
            );
        })}
      </Paper>
    );
  };

  if (!jobParameters) return <Typography variant="caption">Carregando parâmetros...</Typography>;

  // Normaliza os critérios vindos da VAGA (jobParameters)
  // Isso garante que se a vaga foi salva como 'técnico', a gente renderiza usando a chave 'tecnico' do componente
  const paramsTecnico = jobParameters.tecnico || jobParameters['técnico'] || jobParameters['tÃ©cnico'] || [];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#fff', p: 1.5, borderRadius: 1, border: '1px solid #e0e0e0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <UserCheck size={16} color="#666" />
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Minha Avaliação</Typography>
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
            {currentScores.total.toFixed(1)} <Typography component="span" variant="caption" color="text.secondary">/10</Typography>
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', pr: 1 }}>
          <Grid container spacing={1}>
              <Grid item xs={12} md={4}>
                  {renderSectionCompact("triagem", "Triagem", jobParameters.triagem)}
              </Grid>
              <Grid item xs={12} md={4}>
                  {renderSectionCompact("cultura", "Fit Cultural", jobParameters.cultura)}
              </Grid>
              <Grid item xs={12} md={4}>
                  {/* Usa a chave 'tecnico' (sem acento) para renderizar, passando os critérios normalizados */}
                  {renderSectionCompact("tecnico", "Técnico", paramsTecnico)}
              </Grid>
          </Grid>
          
          <Paper variant="outlined" sx={{ p: 2, mt: 1 }}>
            <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase', mb: 1, display: 'block' }}>Minhas Anotações</Typography>
            <TextField 
                multiline 
                rows={2} 
                fullWidth 
                variant="outlined" 
                size="small" 
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                placeholder="Comentários gerais sobre o candidato..." 
                sx={{ bgcolor: '#fff' }} 
                InputProps={{ style: { fontSize: '0.8rem' } }} 
            />
          </Paper>

          {/* Histórico de Observações */}
          <Box sx={{ mt: 3, borderTop: '1px solid #eee', pt: 2 }}>
              <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MessageSquare size={14} /> Histórico de Observações ({allEvaluations?.length || 0})
              </Typography>
              {allEvaluations && allEvaluations.length > 0 ? allEvaluations.map((ev, i) => (
                  <Box key={i} sx={{ mb: 1, p: 1.5, bgcolor: '#f9fafb', borderRadius: 1, border: '1px solid #eee' }}>
                      <Box display="flex" justifyContent="space-between" mb={0.5}>
                          <Typography variant="caption" fontWeight="bold" color="primary">{ev.evaluator_name || 'Usuário'}</Typography>
                          <Typography variant="caption" color="text.secondary">Nota: {Number(ev.final_score).toFixed(1)}</Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#444' }}>{ev.notes || ev.scores?.anotacoes_gerais || 'Sem comentários.'}</Typography>
                  </Box>
              )) : <Typography variant="caption" color="text.secondary">Nenhuma avaliação registrada ainda.</Typography>}
          </Box>
      </Box>

      <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid #eee' }}>
        <Button 
            onClick={handleSave} 
            disabled={saving} 
            variant="contained" 
            fullWidth 
            color="primary" 
            startIcon={<Save size={16}/>} 
            sx={{ textTransform: 'none', fontWeight: 'bold' }}
        >
            {saving ? "Salvando..." : "Salvar Minha Nota"}
        </Button>
      </Box>
    </Box>
  );
}