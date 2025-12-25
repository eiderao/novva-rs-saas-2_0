import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import EvaluationForm from '../components/EvaluationForm';
import { ArrowLeft, Mail, MapPin, BookOpen, FileText, Calendar, Download, TrendingUp, Users } from 'lucide-react';
import { Box, Container, Grid, Paper, Typography, Button, CircularProgress, Divider, Avatar } from '@mui/material';
import { processEvaluation } from '../utils/evaluationLogic';
import { formatPhone, formatUrl } from '../utils/formatters';

export default function ApplicationDetails() {
  const { appId } = useParams();
  const navigate = useNavigate();
  
  const [appData, setAppData] = useState(null);
  const [job, setJob] = useState(null);
  const [currentUserEvaluation, setCurrentUserEvaluation] = useState(null);
  const [globalScore, setGlobalScore] = useState(0);
  const [evaluatorsCount, setEvaluatorsCount] = useState(0);
  const [allEvaluations, setAllEvaluations] = useState([]); // Guarda todos para o histórico
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [appId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: application } = await supabase.from('applications').select('*, candidates(*)').eq('id', appId).single();
      const candidateObj = Array.isArray(application.candidates) ? application.candidates[0] : application.candidates;
      setAppData({ ...application, candidate: candidateObj });

      let jobParams = {};
      if (application.jobId) {
        const { data: jobData } = await supabase.from('jobs').select('*').eq('id', application.jobId).single();
        setJob(jobData);
        jobParams = jobData.parameters || {};
      }

      const { data: allEvals } = await supabase
        .from('evaluations')
        .select('*, evaluator:users(email, name)') // Traz nomes para o histórico
        .eq('application_id', appId);

      if (allEvals) {
          setAllEvaluations(allEvals);
          setEvaluatorsCount(allEvals.length);
          
          let sumTotal = 0;
          let validCount = 0;
          allEvals.forEach(ev => {
              const scores = processEvaluation(ev, jobParams);
              if (scores.total > 0) {
                  sumTotal += scores.total;
                  validCount++;
              }
          });
          setGlobalScore(validCount > 0 ? (sumTotal / validCount) : 0);

          if (user) {
              const myEval = allEvals.find(e => e.evaluator_id === user.id);
              if (myEval) {
                  const myScores = processEvaluation(myEval, jobParams);
                  setCurrentUserEvaluation({
                      ...myEval.scores,
                      anotacoes_gerais: myEval.notes || myEval.scores?.anotacoes_gerais,
                      final_score: myScores.total
                  });
              } else {
                  setCurrentUserEvaluation(null);
              }
          }
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const renderEducation = (edu) => {
    if (!edu || typeof edu !== 'object') return <Typography variant="caption" color="text.secondary">Não informado</Typography>;
    const nivelMap = { medio: 'Ensino Médio', tecnico: 'Técnico', superior: 'Superior', pos: 'Pós', mestrado: 'Mestrado' };
    return (
      <Box sx={{ bgcolor: '#f9fafb', p: 1, borderRadius: 1, border: '1px solid #eee', mt: 0.5 }}>
        <Typography variant="caption" display="block" fontWeight="bold">
            {nivelMap[edu.level] || edu.level} {edu.status && `• ${edu.status}`}
        </Typography>
        <Typography variant="caption" display="block" color="text.secondary">
            {edu.course} {edu.institution ? `| ${edu.institution}` : ''}
        </Typography>
      </Box>
    );
  };

  // CORREÇÃO: Alinhamento vertical e Texto em uma linha
  const renderScoreBadges = (gScore, myScore, count) => {
    const getBgColor = (s) => s >= 8 ? '#e8f5e9' : s >= 5 ? '#fff3e0' : '#ffebee';
    const getTextColor = (s) => s >= 8 ? '#2e7d32' : s >= 5 ? '#ef6c00' : '#c62828';

    return (
        <Box sx={{ display: 'flex', gap: 1, mt: 2, height: '80px' }}>
            <Paper elevation={0} sx={{ flex: 1, bgcolor: getBgColor(gScore), p: 1, borderRadius: 2, border: '1px solid', borderColor: 'divider', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 'bold', color: 'text.secondary', fontSize: '0.65rem', lineHeight: 1.1 }}>
                    Nota Global <br/> ({count} {count === 1 ? 'avaliação' : 'avaliações'})
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: getTextColor(gScore), mt: 0.5 }}>
                    {Number(gScore || 0).toFixed(1)}
                </Typography>
            </Paper>
            
            <Paper elevation={0} sx={{ flex: 1, bgcolor: '#f3f4f6', p: 1, borderRadius: 2, border: '1px solid', borderColor: 'divider', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 'bold', color: 'text.secondary', fontSize: '0.65rem' }}>
                    Minha Nota
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#374151', mt: 0.5 }}>
                    {Number(myScore || 0).toFixed(1)}
                </Typography>
            </Paper>
        </Box>
    );
  };

  if (loading) return <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>;
  if (!appData) return <Box p={4} textAlign="center">Candidato não encontrado.</Box>;

  const params = job?.parameters || {};
  const formData = appData.formData || {};
  const myScore = currentUserEvaluation?.final_score;

  return (
    <Box sx={{ bgcolor: '#f8f9fa', minHeight: '100vh', p: 2 }}>
      <Button onClick={() => navigate(-1)} startIcon={<ArrowLeft size={16}/>} sx={{ mb: 2, color: 'text.secondary' }}>Voltar</Button>
      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2, height: '100%' }} elevation={0} variant="outlined">
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <Avatar sx={{ width: 64, height: 64, bgcolor: '#1976d2', fontSize: '1.5rem', mb: 1 }}>{appData.candidate?.name?.[0]}</Avatar>
              <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 'bold', lineHeight: 1.2 }}>{appData.candidate?.name}</Typography>
              <Typography variant="caption" color="text.secondary">{job?.title}</Typography>
              <Box sx={{ width: '100%' }}>{renderScoreBadges(globalScore, myScore, evaluatorsCount)}</Box>
            </Box>
            <Divider sx={{ my: 2 }} />
            {/* Detalhes de contato e formação mantidos */}
            <Box sx={{ mt: 3 }}><Typography variant="caption" fontWeight="bold" sx={{textTransform: 'uppercase', color: 'text.secondary'}}>Formação</Typography>{formData.education ? renderEducation(formData.education) : <Typography variant="caption" display="block">Sem dados</Typography>}</Box>
            <Box sx={{ mt: 2 }}><Typography variant="caption" fontWeight="bold" sx={{textTransform: 'uppercase', color: 'text.secondary'}}>Motivação</Typography><Typography variant="caption" paragraph sx={{ bgcolor: '#f9fafb', p: 1, borderRadius: 1, border: '1px solid #eee', mt: 0.5, whiteSpace: 'pre-line' }}>{formData.motivation || 'Não informada'}</Typography></Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={9}>
          <Paper sx={{ p: 0, height: '100%', overflow: 'hidden', bgcolor: 'transparent' }} elevation={0}>
             {/* Passa todas as avaliações para o form mostrar o histórico */}
             <EvaluationForm 
                applicationId={appData.id}
                jobParameters={params}
                initialData={currentUserEvaluation} 
                allEvaluations={allEvaluations} 
                onSaved={fetchData} 
             />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}