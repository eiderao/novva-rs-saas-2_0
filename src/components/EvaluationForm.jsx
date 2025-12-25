import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { Save, UserCheck } from 'lucide-react';
import { 
  Box, Typography, Paper, Grid, Button, TextField, 
  Tooltip, Divider 
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

  // --- CÁLCULO DO PILAR (0 a 10) ---
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
                totalScore += (Number(noteObj.valor) * weight);
                totalWeightAnswered += weight;
            }
        }
    });

    if (!hasAnswers || totalWeightAnswered === 0) return null;

    // Normaliza para 100% do peso se o usuário não respondeu tudo
    // Resultado: 0 a 10
    return (totalScore / totalWeightAnswered).toFixed(2);
  };

  // --- CÁLCULO TOTAL DO AVALIADOR (Média dos 3 Pilares) ---
  const calculateMyTotalScore = () => {
      const s1 = parseFloat(calculatePillarScore('triagem', jobParameters.triagem) || 0);
      const s2 = parseFloat(calculatePillarScore('cultura', jobParameters.cultura) || 0);
      const s3 = parseFloat(calculatePillarScore('tecnico', jobParameters.tecnico || jobParameters['tÃ©cnico'] || jobParameters['técnico']) || 0);

      // Regra 2.2.2: Média entre os 3 pilares
      // Se um pilar for 0 (não avaliado), ele puxa a média para baixo (conceito de penalidade por omissão de pilar inteiro), 
      // ou dividimos apenas pelos pilares avaliados? 
      // Pelo seu requisito "Média entre os 3 pilares", assumo divisão por 3 fixa.
      const avg = (s1 + s2 + s3) / 3;
      return avg.toFixed(2);
  };

  const handleSelection = (section, criteriaName, noteId) => {
      setAnswers(prev => {
          const newSection = { ...prev[section] };
          if (newSection[criteriaName] === noteId) {
              delete newSection[criteriaName];
          } else {
              newSection[criteriaName] = noteId;
          }
          return { ...prev, [section]: newSection };
      });
  };

  // Atualiza a média global do candidato (Regra 2.2.3: Média de todos os avaliadores)
  const updateCandidateGlobalScore = async () => {
      // 1. Busca todas as avaliações
      const { data: allEvaluations, error: fetchError } = await supabase
          .from('evaluations')
          .select('final_score')
          .eq('application_id', applicationId);

      if (fetchError) throw fetchError;

      if (allEvaluations.length === 0) return;

      // 2. Calcula média aritmética das notas finais dos avaliadores
      const sum = allEvaluations.reduce((acc, curr) => acc + Number(curr.final_score), 0);
      const globalAverage = (sum / allEvaluations.length).toFixed(2);

      // 3. Salva na application
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

      // Salva na tabela de avaliações individuais
      const { error: evalError } = await supabase
        .from('evaluations')
        .upsert({
            application_id: applicationId,
            evaluator_id: user.id,
            scores: payload, 
            notes: notes,
            final_score: myFinalScore // Salva a nota DESTE avaliador (0-10)
        }, { onConflict: 'application_id, evaluator_id' });

      if (evalError) throw evalError;

      // Atualiza a média global
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

  // Renderização compacta dos critérios (Lado direito da tela)
  const renderSectionCompact = (key, title, criteria) => {
    if (!criteria || criteria.length === 0) return null;
    const ratingScale = jobParameters.notas || [];
    const myScore = calculatePillarScore(key, criteria);

    return (
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderColor: '#e0e0e0' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#1976d2' }}>
                {title}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 'bold', bgcolor: myScore ? '#e3f2fd' : '#f5f5f5', px: 1, py: 0.5, borderRadius: 1 }}>
                Nota: {myScore || '-'}
            </Typography>
        </Box>

        {criteria.map((crit, idx) => (
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
                        const isSelected = answers[key]?.[crit.name] === option.id;
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
            {calculateMyTotalScore()} <Typography component="span" variant="caption" color="text.secondary">/10</Typography>
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
                  {renderSectionCompact("tecnico", "Técnico", jobParameters.tecnico || jobParameters['tÃ©cnico'] || jobParameters['técnico'])}
              </Grid>
          </Grid>

          <TextField
            label="Anotações Gerais"
            multiline
            rows={2}
            fullWidth
            variant="outlined"
            size="small"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Comentários sobre o candidato..."
            sx={{ mt: 1, bgcolor: '#fff' }}
            InputProps={{ style: { fontSize: '0.8rem' } }}
            InputLabelProps={{ style: { fontSize: '0.8rem' } }}
          />
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