import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import EvaluationForm from '../components/EvaluationForm';
import { ArrowLeft, Mail, MapPin, BookOpen, FileText, Calendar, Download, TrendingUp, Users } from 'lucide-react';
import { Box, Container, Grid, Paper, Typography, Button, CircularProgress, Divider, Avatar } from '@mui/material';
import { processEvaluation } from '../utils/evaluationLogic';

export default function ApplicationDetails() {
  const { appId } = useParams();
  const navigate = useNavigate();
  
  const [appData, setAppData] = useState(null);
  const [job, setJob] = useState(null);
  const [currentUserEvaluation, setCurrentUserEvaluation] = useState(null);
  const [globalScore, setGlobalScore] = useState(0);
  const [evaluatorsCount, setEvaluatorsCount] = useState(0);
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

      const { data: allEvals } = await supabase.from('evaluations').select('*').eq('application_id', appId);

      if (allEvals) {
          setEvaluatorsCount(allEvals.length);
          let sumTotal = 0;
          let validEvaluations = 0;

          allEvals.forEach(ev => {
              const scores = processEvaluation(ev, jobParams);
              if (scores.total > 0) {
                  sumTotal += scores.total;
                  validEvaluations++;
              }
          });
          
          setGlobalScore(validEvaluations > 0 ? (sumTotal / validEvaluations) : 0);

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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const renderScoreBadges = (gScore, myScore, count) => {
    const getBgColor = (s) => s >= 8 ? '#e8f5e9' : s >= 5 ? '#fff3e0' : '#ffebee';
    const getTextColor = (s) => s >= 8 ? '#2e7d32' : s >= 5 ? '#ef6c00' : '#c62828';

    return (
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Paper elevation={0} sx={{ flex: 1, bgcolor: getBgColor(gScore), p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 'bold', color: 'text.secondary', fontSize: '0.65rem' }}>
                    Nota Global
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', mb: 0.5 }}>
                    ({count} {count === 1 ? 'avaliação' : 'avaliações'})
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: getTextColor(gScore), lineHeight: 1 }}>
                    {Number(gScore || 0).toFixed(1)}
                </Typography>
            </Paper>
            
            <Paper elevation={0} sx={{ flex: 1, bgcolor: '#f3f4f6', p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 'bold', color: 'text.secondary', fontSize: '0.65rem', mb: 1 }}>
                    Minha Nota
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#374151', lineHeight: 1 }}>
                    {Number(myScore || 0).toFixed(1)}
                </Typography>
            </Paper>
        </Box>
    );
  };

  if (loading) return <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>;
  if (!appData) return <Box p={4} textAlign="center">Candidato não encontrado.</Box>;

  const params = job?.parameters || {};
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
            {/* Detalhes de contato... (Mantido igual) */}
          </Paper>
        </Grid>
        <Grid item xs={12} md={9}>
          <Paper sx={{ p: 0, height: '100%', overflow: 'hidden', bgcolor: 'transparent' }} elevation={0}>
             <EvaluationForm applicationId={appData.id} jobParameters={params} initialData={currentUserEvaluation} onSaved={fetchData} />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}