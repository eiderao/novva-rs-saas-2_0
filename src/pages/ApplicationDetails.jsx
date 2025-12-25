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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [appId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Busca Aplicação
      const { data: application, error: appError } = await supabase
        .from('applications')
        .select('*, candidates(*)')
        .eq('id', appId)
        .single();
      
      if (appError) throw appError;

      const candidateObj = Array.isArray(application.candidates) ? application.candidates[0] : application.candidates;
      setAppData({ ...application, candidate: candidateObj });

      // 2. Busca Parâmetros
      let jobParams = {};
      if (application.jobId) {
        const { data: jobData } = await supabase.from('jobs').select('*').eq('id', application.jobId).single();
        setJob(jobData);
        jobParams = jobData.parameters || {};
      }

      // 3. Busca Avaliações
      const { data: allEvals, error: evalsError } = await supabase
        .from('evaluations')
        .select('*')
        .eq('application_id', appId);

      if (!evalsError && allEvals) {
          setEvaluatorsCount(allEvals.length);
          
          // Calcula média GLOBAL (Média das notas finais dos avaliadores)
          let sumTotal = 0;
          let validEvaluations = 0;

          allEvals.forEach(ev => {
              // Recalcula para garantir consistência (caso o banco tenha valor antigo)
              const scores = processEvaluation(ev, jobParams);
              // Só soma se a nota for > 0 (evita avaliadores que só abriram e salvaram vazio)
              if (scores.total > 0) {
                  sumTotal += scores.total;
                  validEvaluations++;
              }
          });
          
          const finalGlobal = validEvaluations > 0 ? (sumTotal / validEvaluations) : 0;
          setGlobalScore(finalGlobal);

          if (user) {
              const myEval = allEvals.find(e => e.evaluator_id === user.id);
              if (myEval) {
                  // Prepara dados para o form e para a badge "Minha Nota"
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

  const renderScoreBadges = (gScore, myScore, count) => {
    const getBgColor = (s) => s >= 8 ? '#e8f5e9' : s >= 5 ? '#fff3e0' : '#ffebee';
    const getTextColor = (s) => s >= 8 ? '#2e7d32' : s >= 5 ? '#ef6c00' : '#c62828';

    return (
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Box sx={{ flex: 1, bgcolor: getBgColor(gScore), p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
                <Typography variant="caption" display="block" sx={{ textTransform: 'uppercase', fontWeight: 'bold', color: 'text.secondary', fontSize: '0.65rem' }}>
                    Nota Global ({count})
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 900, color: getTextColor(gScore), lineHeight: 1 }}>
                    {Number(gScore || 0).toFixed(1)}
                </Typography>
            </Box>
            
            <Box sx={{ flex: 1, bgcolor: '#f3f4f6', p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
                <Typography variant="caption" display="block" sx={{ textTransform: 'uppercase', fontWeight: 'bold', color: 'text.secondary', fontSize: '0.65rem' }}>
                    Minha Nota
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 900, color: '#374151', lineHeight: 1 }}>
                    {Number(myScore || 0).toFixed(1)}
                </Typography>
            </Box>
        </Box>
    );
  };

  if (loading) return <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>;
  if (!appData) return <Box p={4} textAlign="center">Candidato não encontrado.</Box>;

  const params = job?.parameters || {};
  const formData = appData.formData || {};
  // Usa a nota calculada na hora (myScores.total) se disponível, ou 0
  const myScore = currentUserEvaluation?.final_score;

  return (
    <Box sx={{ bgcolor: '#f8f9fa', minHeight: '100vh', p: 2 }}>
      <Button onClick={() => navigate(-1)} startIcon={<ArrowLeft size={16}/>} sx={{ mb: 2, color: 'text.secondary' }}>
        Voltar
      </Button>

      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2, height: '100%' }} elevation={0} variant="outlined">
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <Avatar sx={{ width: 64, height: 64, bgcolor: '#1976d2', fontSize: '1.5rem', mb: 1 }}>
                {appData.candidate?.name?.[0]}
              </Avatar>
              <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 'bold', lineHeight: 1.2 }}>
                {appData.candidate?.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {job?.title}
              </Typography>
              
              <Box sx={{ width: '100%' }}>
                {renderScoreBadges(globalScore, myScore, evaluatorsCount)}
              </Box>
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box display="flex" alignItems="center" gap={1}>
                    <Mail size={14} color="#666"/>
                    <Typography variant="caption" sx={{wordBreak: 'break-all'}}>{appData.candidate?.email}</Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                    <MapPin size={14} color="#666"/>
                    <Typography variant="caption">{appData.candidate?.city || 'Não informado'}</Typography>
                </Box>
                {appData.candidate?.resume_url && (
                    <Button variant="outlined" size="small" href={appData.candidate.resume_url} target="_blank" startIcon={<Download size={14}/>} sx={{ mt: 1, fontSize: '0.7rem' }}>
                        Ver Currículo
                    </Button>
                )}
            </Box>

            <Box sx={{ mt: 3 }}>
               <Typography variant="caption" fontWeight="bold" sx={{textTransform: 'uppercase', color: 'text.secondary'}}>Formação</Typography>
               {formData.education ? renderEducation(formData.education) : <Typography variant="caption" display="block">Sem dados</Typography>}
            </Box>

            <Box sx={{ mt: 2 }}>
               <Typography variant="caption" fontWeight="bold" sx={{textTransform: 'uppercase', color: 'text.secondary'}}>Motivação</Typography>
               <Typography variant="caption" paragraph sx={{ bgcolor: '#f9fafb', p: 1, borderRadius: 1, border: '1px solid #eee', mt: 0.5, whiteSpace: 'pre-line' }}>
                  {formData.motivation || 'Não informada'}
               </Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={9}>
          <Paper sx={{ p: 0, height: '100%', overflow: 'hidden', bgcolor: 'transparent' }} elevation={0}>
             <EvaluationForm 
                applicationId={appData.id}
                jobParameters={params}
                initialData={currentUserEvaluation} 
                onSaved={fetchData} 
             />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}