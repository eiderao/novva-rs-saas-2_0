import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import EvaluationForm from '../components/EvaluationForm';
import { 
    ArrowLeft, Mail, MapPin, BookOpen, FileText, Calendar, Download, TrendingUp, Users 
} from 'lucide-react';
// Imports do Material UI corrigidos e explícitos
import { 
    Box, Container, Grid, Paper, Typography, Button, CircularProgress, Divider, Avatar, Chip
} from '@mui/material';

export default function ApplicationDetails() {
  const { appId } = useParams();
  const navigate = useNavigate();
  
  const [appData, setAppData] = useState(null);
  const [job, setJob] = useState(null);
  const [currentUserEvaluation, setCurrentUserEvaluation] = useState(null);
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

      // Normaliza candidato (caso venha array)
      const candidateObj = Array.isArray(application.candidates) ? application.candidates[0] : application.candidates;
      setAppData({ ...application, candidate: candidateObj });

      // 2. Busca Vaga (para os parâmetros de avaliação)
      if (application.jobId) {
        const { data: jobData } = await supabase.from('jobs').select('*').eq('id', application.jobId).single();
        setJob(jobData);
      }

      // 3. Busca TODAS as avaliações (para contagem e para pegar a MINHA)
      const { data: allEvals, error: evalsError } = await supabase
        .from('evaluations')
        .select('evaluator_id, scores, notes, final_score')
        .eq('application_id', appId);

      if (!evalsError && allEvals) {
          setEvaluatorsCount(allEvals.length);
          
          if (user) {
              // Procura se EU já avaliei
              const myEval = allEvals.find(e => e.evaluator_id === user.id);
              if (myEval) {
                  setCurrentUserEvaluation({
                      ...myEval.scores,
                      anotacoes_gerais: myEval.notes || myEval.scores?.anotacoes_gerais,
                      final_score: myEval.final_score 
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
    
    // CORREÇÃO AQUI: Box fechando corretamente com Box
    return (
      <Box sx={{ bgcolor: '#f9fafb', p: 1.5, borderRadius: 1, border: '1px solid #eee', mt: 1 }}>
        <Typography variant="caption" display="block" fontWeight="bold" sx={{fontSize: '0.75rem'}}>
            {nivelMap[edu.level] || edu.level} {edu.status && `• ${edu.status}`}
        </Typography>
        <Typography variant="caption" display="block" color="text.secondary">
            {edu.course} {edu.institution ? `| ${edu.institution}` : ''}
        </Typography>
        {(edu.date || edu.period) && (
           <Typography variant="caption" display="block" color="text.secondary" sx={{mt: 0.5}}>
             {edu.date || edu.period}
           </Typography>
        )}
      </Box>
    );
  };

  // Badge Visual de Notas
  const renderScoreBadges = (globalScore, myScore, count) => {
    const getBgColor = (s) => s >= 8 ? '#e8f5e9' : s >= 5 ? '#fff3e0' : '#ffebee';
    const getTextColor = (s) => s >= 8 ? '#2e7d32' : s >= 5 ? '#ef6c00' : '#c62828';

    return (
        <Box sx={{ display: 'flex', gap: 2, mt: 3, width: '100%' }}>
            {/* Nota Global */}
            <Paper elevation={0} sx={{ flex: 1, bgcolor: getBgColor(globalScore), p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
                <Box display="flex" alignItems="center" justifyContent="center" gap={1} mb={0.5}>
                    <TrendingUp size={16} color={getTextColor(globalScore)} />
                    <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 'bold', color: 'text.secondary', fontSize: '0.7rem' }}>
                        Nota Global ({count})
                    </Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 800, color: getTextColor(globalScore) }}>
                    {Number(globalScore || 0).toFixed(1)}
                </Typography>
            </Paper>
            
            {/* Minha Nota */}
            <Paper elevation={0} sx={{ flex: 1, bgcolor: '#f8f9fa', p: 2, borderRadius: 2, border: '1px solid', borderColor: '#e0e0e0', textAlign: 'center' }}>
                <Box display="flex" alignItems="center" justifyContent="center" gap={1} mb={0.5}>
                    <Users size={16} color="#666" />
                    <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 'bold', color: 'text.secondary', fontSize: '0.7rem' }}>
                        Minha Avaliação
                    </Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#374151' }}>
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
    <Box sx={{ bgcolor: '#f3f4f6', minHeight: '100vh', p: 3 }}>
      <Button onClick={() => navigate(-1)} startIcon={<ArrowLeft size={16}/>} sx={{ mb: 2, color: 'text.secondary' }}>
        Voltar
      </Button>

      <Grid container spacing={3}>
        {/* LADO ESQUERDO: PERFIL DO CANDIDATO (30%) */}
        <Grid item xs={12} md={4} lg={3}>
          <Paper sx={{ p: 3, height: '100%' }} elevation={1}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <Avatar sx={{ width: 80, height: 80, bgcolor: '#1976d2', fontSize: '2rem', mb: 2, fontWeight: 'bold' }}>
                {appData.candidate?.name?.[0]}
              </Avatar>
              <Typography variant="h6" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>
                {appData.candidate?.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {job?.title}
              </Typography>
              
              {renderScoreBadges(appData.score_general, myScore, evaluatorsCount)}
            </Box>
            
            <Divider sx={{ my: 3 }} />
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box display="flex" alignItems="center" gap={1.5}>
                    <Mail size={16} color="#666"/>
                    <Typography variant="body2" sx={{wordBreak: 'break-all'}}>{appData.candidate?.email}</Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1.5}>
                    <MapPin size={16} color="#666"/>
                    <Typography variant="body2">{appData.candidate?.city || 'Não informado'}</Typography>
                </Box>
                {appData.candidate?.resume_url && (
                    <Button variant="outlined" size="small" href={appData.candidate.resume_url} target="_blank" startIcon={<Download size={16}/>} fullWidth sx={{ mt: 1 }}>
                        Ver Currículo
                    </Button>
                )}
            </Box>

            <Box sx={{ mt: 4 }}>
               <Typography variant="caption" fontWeight="bold" sx={{textTransform: 'uppercase', color: 'text.secondary', letterSpacing: 1}}>
                   <BookOpen size={12} style={{marginRight: 4, display:'inline'}}/> Formação
               </Typography>
               {formData.education ? renderEducation(formData.education) : <Typography variant="body2" sx={{mt:1}}>Sem dados</Typography>}
            </Box>

            <Box sx={{ mt: 3 }}>
               <Typography variant="caption" fontWeight="bold" sx={{textTransform: 'uppercase', color: 'text.secondary', letterSpacing: 1}}>
                   <FileText size={12} style={{marginRight: 4, display:'inline'}}/> Motivação
               </Typography>
               <Typography variant="body2" sx={{ bgcolor: '#f9fafb', p: 1.5, borderRadius: 1, border: '1px solid #eee', mt: 1, whiteSpace: 'pre-line', fontSize: '0.85rem' }}>
                  {formData.motivation || 'Não informada'}
               </Typography>
            </Box>
            
            <Box sx={{ mt: 3 }}>
                <Typography variant="caption" fontWeight="bold" sx={{textTransform: 'uppercase', color: 'text.secondary', letterSpacing: 1}}>
                   <Calendar size={12} style={{marginRight: 4, display:'inline'}}/> Data de Envio
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {new Date(appData.created_at).toLocaleDateString('pt-BR')}
                </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* LADO DIREITO: FORMULÁRIO DE AVALIAÇÃO (70%) */}
        <Grid item xs={12} md={8} lg={9}>
          <Paper sx={{ p: 0, height: '100%', overflow: 'hidden' }} elevation={1}>
             {/* Passa os dados para o componente de formulário */}
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