import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { Save, UserCheck, AlertCircle } from 'lucide-react';
import { 
  Box, Typography, Paper, Grid, Button, TextField, 
  Tooltip, Divider, Alert
} from '@mui/material';

export default function EvaluationForm({ applicationId, jobParameters, initialData, onSaved }) {
  const [answers, setAnswers] = useState({
    triagem: initialData?.triagem || {},
    cultura: initialData?.cultura || {},
    tecnico: initialData?.tecnico || {}
  });
  
  const [notes, setNotes] = useState(initialData?.anotacoes_gerais || '');
  const [saving, setSaving] = useState(false);

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

  // --- LÓGICA DE CÁLCULO 2.2.1: Soma Ponderada Normalizada dentro do Pilar ---
  const calculatePillarScore = (sectionName, criteriaList) => {
    if (!criteriaList || criteriaList.length === 0) return null;
    
    const ratingParams = jobParameters.notas || [];
    let totalScore = 0;
    let totalWeightAnswered = 0;
    let hasAnswers = false;

    criteriaList.forEach(criterion => {
        const noteId = answers[sectionName]?.[criterion.name];
        if (noteId) {
            const noteObj = ratingParams.find(n => n.id === noteId);
            if (noteObj) {
                hasAnswers = true;
                const weight = Number(criterion.weight) || 0;
                
                // Ex: Nota 10 * Peso 20 = 200 pts
                totalScore += (Number(noteObj.valor) * weight);
                // Acumula peso: 20
                totalWeightAnswered += weight;
            }
        }
    });

    if (!hasAnswers || totalWeightAnswered === 0) return null;

    // Regra de três: Se 20 peso = 200 pts, então 100 peso = X
    // Nota Final do Pilar = Pontos / Peso * 1 (Escala se mantém 0-10 se as notas forem 0-10)
    // Resultado final normalizado para a escala das notas
    return (totalScore / totalWeightAnswered).toFixed(2);
  };

  // --- LÓGICA DE CÁLCULO 2.2.2: Média dos 3 Pilares ---
  const calculateMyTotalScore = () => {
      // Pega a nota de cada pilar (se for null, considera 0 para a média, ou podemos ignorar na divisão)
      // Pelo requisito "média entre os 3 pilares", vamos assumir que são 3 fixos.
      const s1 = parseFloat(calculatePillarScore('triagem', jobParameters.triagem) || 0);
      const s2 = parseFloat(calculatePillarScore('cultura', jobParameters.cultura) || 0);
      // Fallback para nomes variados do técnico
      const s3 = parseFloat(calculatePillarScore('tecnico', jobParameters.tecnico || jobParameters['tÃ©cnico'] || jobParameters['técnico']) || 0);

      const avg = (s1 + s2 + s3) / 3;
      return avg.toFixed(2);
  };

  const handleSelection = (section, criteriaName, noteId) => {
      setAnswers(prev => {
          const newSection = { ...prev[section] };
          if (newSection[criteriaName] === noteId) {
              delete newSection[criteriaName]; // Desmarcar
          } else {
              newSection[criteriaName] = noteId;
          }
          return { ...prev, [section]: newSection };
      });
  };

  // --- LÓGICA 2.2.3: Média de todos os avaliadores ---
  const updateCandidateGlobalScore = async () => {
      const { data: allEvaluations, error: fetchError } = await supabase
          .from('evaluations')
          .select('final_score')
          .eq('application_id', applicationId);

      if (fetchError) throw fetchError;
      if (allEvaluations.length === 0) return;

      const sum = allEvaluations.reduce((acc, curr) => acc + Number(curr.final_score), 0);
      const globalAverage = (sum / allEvaluations.length).toFixed(2);

      await supabase
          .from('applications')
          .update({ score_general: globalAverage })
          .eq('id', applicationId);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não logado");

      const scoreTriagem = calculatePillarScore('triagem', jobParameters.triagem);
      const scoreCultura = calculatePillarScore('cultura', jobParameters.cultura);
      const scoreTecnico = calculatePillarScore('tecnico', jobParameters.tecnico || jobParameters['tÃ©cnico'] || jobParameters['técnico']);
      
      const myFinalScore = calculateMyTotalScore();

      const payload = {
        triagem: answers.triagem,
        cultura: answers.cultura,
        tecnico: answers.tecnico,
        anotacoes_gerais: notes,
        pillar_scores: {
            triagem: scoreTriagem,
            cultura: scoreCultura,
            tecnico: scoreTecnico
        },
        evaluator_name: user.email,
        updated_at: new Date()
      };

      // Salva minha avaliação
      const { error: evalError } = await supabase
        .from('evaluations')
        .upsert({
            application_id: applicationId,
            evaluator_id: user.id,
            scores: payload, 
            notes: notes,
            final_score: myFinalScore
        }, { onConflict: 'application_id, evaluator_id' });

      if (evalError) throw evalError;

      // Recalcula média 360
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

  // Renderização Compacta (Lado Direito)
  const renderSectionCompact = (key, title, criteria) => {
    if (!criteria || criteria.length === 0) return null;
    const ratingScale = jobParameters.notas || [];
    const myScore = calculatePillarScore(key, criteria);

    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderColor: '#e0e0e0', bgcolor: '#fff' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, pb: 1, borderBottom: '1px solid #f0f0f0' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1565c0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {title}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 'bold', bgcolor: myScore ? '#e3f2fd' : '#f5f5f5', color: myScore ? '#1565c0' : '#999', px: 1, py: 0.5, borderRadius: 1 }}>
                Nota: {myScore || '-'}
            </Typography>
        </Box>

        {criteria.map((crit, idx) => (
            <Box key={idx} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8rem' }}>
                        {crit.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        Peso: {crit.weight}%
                    </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {ratingScale.map(option => {
                        const isSelected = answers[key]?.[crit.name] === option.id;
                        return (
                            <Button
                                key={option.id}
                                size="small"
                                onClick={() => handleSelection(key, crit.name, option.id)}
                                variant={isSelected ? "contained" : "outlined"}
                                sx={{
                                    minWidth: 'unset',
                                    fontSize: '0.65rem',
                                    py: 0.2,
                                    px: 1,
                                    textTransform: 'none',
                                    borderColor: isSelected ? 'primary.main' : '#e0e0e0',
                                    color: isSelected ? '#fff' : '#666',
                                    bgcolor: isSelected ? 'primary.main' : 'transparent',
                                    boxShadow: 'none',
                                    '&:hover': { 
                                        bgcolor: isSelected ? 'primary.dark' : '#f5f5f5',
                                        borderColor: isSelected ? 'primary.dark' : '#ccc'
                                    }
                                }}
                            >
                                {option.nome} ({option.valor})
                            </Button>
                        );
                    })}
                </Box>
            </Box>
        ))}
      </Paper>
    );
  };

  if (!jobParameters) return <Typography variant="caption">Carregando...</Typography>;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#fff', borderLeft: '1px solid #e0e0e0' }}>
      {/* Header do Form */}
      <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', bgcolor: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <UserCheck size={18} color="#1976d2" />
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#333' }}>Avaliação Individual</Typography>
        </Box>
        <Box textAlign="right">
            <Typography variant="caption" display="block" color="text.secondary" lineHeight={1}>Minha Média</Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1976d2', lineHeight: 1 }}>
                {calculateMyTotalScore()}
            </Typography>
        </Box>
      </Box>

      {/* Conteúdo Scrollável */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2, bgcolor: '#f8f9fa' }}>
          <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                  {renderSectionCompact("triagem", "Triagem", jobParameters.triagem)}
              </Grid>
              <Grid item xs={12} md={4}>
                  {renderSectionCompact("cultura", "Fit Cultural", jobParameters.cultura)}
              </Grid>
              <Grid item xs={12} md={4}>
                  {renderSectionCompact("tecnico", "Técnico", jobParameters.tecnico || jobParameters['tÃ©cnico'] || jobParameters['técnico'])}
              </Grid>
          </Grid>

          <Paper variant="outlined" sx={{ p: 2, mt: 1 }}>
            <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase', mb: 1, display: 'block' }}>
                Anotações e Justificativas
            </Typography>
            <TextField
                multiline
                rows={3}
                fullWidth
                variant="outlined"
                size="small"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Escreva suas observações..."
                sx={{ bgcolor: '#fff' }}
            />
          </Paper>
      </Box>

      {/* Footer Fixo */}
      <Box sx={{ p: 2, borderTop: '1px solid #e0e0e0', bgcolor: '#fff' }}>
        <Button 
            onClick={handleSave} 
            disabled={saving}
            variant="contained"
            fullWidth
            size="large"
            color="primary"
            startIcon={<Save size={18}/>}
            sx={{ fontWeight: 'bold', boxShadow: 'none' }}
        >
            {saving ? "Salvando..." : "Salvar e Atualizar Média"}
        </Button>
      </Box>
    </Box>
  );
}