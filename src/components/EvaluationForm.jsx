import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { Save, UserCheck } from 'lucide-react';
import { Box, Typography, Paper, Grid, Button, TextField } from '@mui/material';
import { processEvaluation } from '../utils/evaluationLogic';

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

  // Calcula visualmente em tempo real
  const currentScores = processEvaluation({ scores: answers }, jobParameters);

  const handleSelection = (section, criteriaName, noteId) => {
      setAnswers(prev => {
          const newSection = { ...prev[section] };
          // Toggle: se clicar no mesmo, desmarca
          if (newSection[criteriaName] === noteId) delete newSection[criteriaName];
          else newSection[criteriaName] = noteId;
          return { ...prev, [section]: newSection };
      });
  };

  const updateCandidateGlobalScore = async () => {
      const { data: allEvaluations } = await supabase
          .from('evaluations')
          .select('final_score')
          .eq('application_id', applicationId);

      if (!allEvaluations?.length) return;

      const sum = allEvaluations.reduce((acc, curr) => acc + Number(curr.final_score), 0);
      const globalAverage = (sum / allEvaluations.length).toFixed(2);

      await supabase.from('applications').update({ score_general: globalAverage }).eq('id', applicationId);
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
        pillar_scores: finalCalc, // Salva os parciais calculados
        evaluator_name: user.email,
        updated_at: new Date()
      };

      const { error: evalError } = await supabase
        .from('evaluations')
        .upsert({
            application_id: applicationId,
            evaluator_id: user.id,
            scores: payload, 
            notes: notes,
            final_score: finalCalc.total
        }, { onConflict: 'application_id, evaluator_id' });

      if (evalError) throw evalError;

      await updateCandidateGlobalScore();

      alert("Avaliação salva com sucesso!");
      if (onSaved) onSaved();

    } catch (error) {
      alert("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const renderSectionCompact = (key, title, criteria) => {
    if (!criteria?.length) return null;
    const ratingScale = jobParameters.notas || [];
    
    // Calcula nota deste pilar específico usando a lógica centralizada
    const tempScores = processEvaluation({ scores: answers }, jobParameters);
    const myScore = tempScores[key];

    return (
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderColor: '#e0e0e0', bgcolor: '#fff' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#1976d2' }}>
                {title}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 'bold', bgcolor: '#e3f2fd', px: 1, py: 0.5, borderRadius: 1 }}>
                Nota: {myScore}
            </Typography>
        </Box>

        {criteria.map((crit, idx) => (
            <Box key={idx} sx={{ mb: 1.5, borderBottom: '1px dashed #eee', pb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 500, width: '80%', lineHeight: 1.2 }}>{crit.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{crit.weight}%</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {ratingScale.map(option => {
                        const isSelected = answers[key]?.[crit.name] === option.id;
                        return (
                            <Button
                                key={option.id}
                                size="small"
                                onClick={() => handleSelection(key, crit.name, option.id)}
                                sx={{
                                    minWidth: '30px', height: '24px', fontSize: '0.65rem', p: '0 8px', textTransform: 'none',
                                    bgcolor: isSelected ? '#1976d2' : '#f5f5f5',
                                    color: isSelected ? '#fff' : '#666',
                                    '&:hover': { bgcolor: isSelected ? '#1565c0' : '#eeeeee' }
                                }}
                            >
                                {option.nome}
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
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#fff', p: 1.5, borderRadius: 1, border: '1px solid #e0e0e0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <UserCheck size={16} color="#666" />
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Minha Avaliação</Typography>
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
            {currentScores.total} <Typography component="span" variant="caption" color="text.secondary">/10</Typography>
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', pr: 1 }}>
          <Grid container spacing={1}>
              <Grid item xs={12} md={4}>{renderSectionCompact("triagem", "Triagem", jobParameters.triagem)}</Grid>
              <Grid item xs={12} md={4}>{renderSectionCompact("cultura", "Fit Cultural", jobParameters.cultura)}</Grid>
              <Grid item xs={12} md={4}>{renderSectionCompact("tecnico", "Técnico", jobParameters.tecnico || jobParameters['técnico'])}</Grid>
          </Grid>
          <TextField
            label="Anotações Gerais" multiline rows={2} fullWidth variant="outlined" size="small"
            value={notes} onChange={e => setNotes(e.target.value)} placeholder="Comentários..."
            sx={{ mt: 1, bgcolor: '#fff' }}
          />
      </Box>

      <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid #eee' }}>
        <Button onClick={handleSave} disabled={saving} variant="contained" fullWidth color="primary" startIcon={<Save size={16}/>}>
            {saving ? "Salvando..." : "Salvar Minha Nota"}
        </Button>
      </Box>
    </Box>
  );
}