import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { Save, UserCheck, MessageSquare } from 'lucide-react';
import { Box, Typography, Paper, Grid, Button, TextField } from '@mui/material';
import { processEvaluation } from '../utils/evaluationLogic';

export default function EvaluationForm({ applicationId, jobParameters, initialData, allEvaluations, onSaved }) {
  // Estado inicial garantindo que as chaves existam
  const [answers, setAnswers] = useState({ triagem: {}, cultura: {}, tecnico: {} });
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Função auxiliar para normalizar a chave 'tecnico' que pode vir com acento do banco
  const getTecnicoData = (data) => {
    if (!data) return {};
    return data.tecnico || data['técnico'] || data['tÃ©cnico'] || {};
  };

  useEffect(() => {
    if (initialData) {
        // Carrega os dados salvos garantindo a estrutura correta
        setAnswers({
            triagem: initialData.triagem || {},
            cultura: initialData.cultura || {},
            tecnico: getTecnicoData(initialData)
        });
        setNotes(initialData.anotacoes_gerais || '');
    }
  }, [initialData]);

  // Calcula pontuação em tempo real
  const currentScores = processEvaluation({ scores: answers }, jobParameters);

  const handleSelection = (section, criteriaName, noteId) => {
      setAnswers(prev => {
          const newSection = { ...prev[section] };
          // Toggle: se clicar na mesma nota, desmarca (remove a chave)
          if (newSection[criteriaName] === noteId) {
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
      if (!user) throw new Error("Usuário não logado");

      const finalCalc = processEvaluation({ scores: answers }, jobParameters);

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
            scores: payload, 
            notes: notes,
            final_score: finalCalc.total
        }, { onConflict: 'application_id, evaluator_id' });

      if (evalError) throw evalError;
      alert("Salvo com sucesso!");
      if (onSaved) onSaved();
    } catch (error) { 
        alert("Erro ao salvar: " + error.message); 
    } finally { 
        setSaving(false); 
    }
  };

  const renderSectionCompact = (key, title, criteria) => {
    // Se não houver critérios para esta seção, não renderiza nada
    if (!criteria || !criteria.length) return null;

    const ratingScale = jobParameters.notas || [];
    const tempScores = processEvaluation({ scores: answers }, jobParameters);
    
    return (
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderColor: '#e0e0e0', bgcolor: '#fff' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#1976d2' }}>{title}</Typography>
            <Typography variant="caption" sx={{ fontWeight: 'bold', bgcolor: '#e3f2fd', px: 1, py: 0.5, borderRadius: 1 }}>
                Nota: {tempScores[key].toFixed(1)}
            </Typography>
        </Box>
        {criteria.map((crit, idx) => {
            // Valor salvo para este critério específico
            const savedValue = answers[key]?.[crit.name];

            return (
                <Box key={idx} sx={{ mb: 1.5, borderBottom: '1px dashed #eee', pb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 500, width: '80%', lineHeight: 1.2 }}>{crit.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{crit.weight}%</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {ratingScale.map(option => {
                            // CORREÇÃO CRÍTICA: Converte ambos para String para comparação segura (UUID vs String vs Number)
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

  // Normalização da lista de critérios vindos da vaga
  const criteriosTecnico = jobParameters.tecnico || jobParameters['técnico'] || jobParameters['tÃ©cnico'] || [];

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
              <Grid item xs={12} md={4}>{renderSectionCompact("triagem", "Triagem", jobParameters.triagem)}</Grid>
              <Grid item xs={12} md={4}>{renderSectionCompact("cultura", "Fit Cultural", jobParameters.cultura)}</Grid>
              <Grid item xs={12} md={4}>{renderSectionCompact("tecnico", "Técnico", criteriosTecnico)}</Grid>
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

          {/* HISTÓRICO DE TODAS AS ANOTAÇÕES */}
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