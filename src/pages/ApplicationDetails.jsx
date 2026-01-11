import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import EvaluationForm from '../components/EvaluationForm';
import { ArrowLeft, Mail, MapPin, BookOpen, FileText, Download, Linkedin, Github, Phone, Languages } from 'lucide-react';
import { Box, Grid, Paper, Typography, Button, CircularProgress, Divider, Avatar } from '@mui/material';
import { processEvaluation } from '../utils/evaluationLogic';
import { formatPhone, formatUrl } from '../utils/formatters';

export default function ApplicationDetails() {
  const { appId } = useParams();
  const navigate = useNavigate();
  
  const [appData, setAppData] = useState(null);
  const [job, setJob] = useState(null);
  const [currentUserEvaluation, setCurrentUserEvaluation] = useState(null);
  const [othersEvaluations, setOthersEvaluations] = useState([]);
  const [globalScore, setGlobalScore] = useState(0);
  const [evaluatorsCount, setEvaluatorsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [appId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getSession();
      
      const { data: application } = await supabase.from('applications').select('*, candidates(*)').eq('id', appId).single();
      const candidateObj = Array.isArray(application.candidates) ? application.candidates[0] : application.candidates;
      
      let safeFormData = application.formData;
      if (typeof safeFormData === 'string') { try { safeFormData = JSON.parse(safeFormData); } catch(e) {} }
      setAppData({ ...application, formData: safeFormData, candidate: candidateObj });

      let jobParams = {};
      if (application.jobId) {
        const { data: jobData } = await supabase.from('jobs').select('*').eq('id', application.jobId).single();
        setJob(jobData);
        jobParams = jobData.parameters || {};
      }

      const { data: allEvals } = await supabase.from('evaluations').select('*').eq('application_id', appId);
      if (allEvals) {
          const userIds = [...new Set(allEvals.map(e => e.evaluator_id))];
          let usersMap = {};
          if (userIds.length > 0) {
              const { data: users } = await supabase.from('user_profiles').select('id, name, email').in('id', userIds);
              users?.forEach(u => usersMap[u.id] = u.name || u.email);
          }
          const evalsWithNames = allEvals.map(e => ({ ...e, evaluator_name: usersMap[e.evaluator_id] || 'Avaliador' }));
          
          if (user) {
              // Separa a avaliação do usuário atual das demais
              setCurrentUserEvaluation(evalsWithNames.find(e => e.evaluator_id === user.id) || null);
              setOthersEvaluations(evalsWithNames.filter(e => e.evaluator_id !== user.id));
          } else {
              setOthersEvaluations(evalsWithNames);
          }
          setEvaluatorsCount(evalsWithNames.length);
          
          let sumTotal = 0, validCount = 0;
          evalsWithNames.forEach(ev => {
              const scores = processEvaluation(ev, jobParams);
              if (scores.total > 0) { sumTotal += scores.total; validCount++; }
          });
          setGlobalScore(validCount > 0 ? (sumTotal / validCount) : 0);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const renderInfo = (data) => {
    if (!data) return null;
    const course = data.course_name || data.course || data.education?.course;
    const institution = data.institution || data.education?.institution;
    const year = data.conclusion_date || data.completionYear || data.education?.date;
    
    // CORREÇÃO: Prioriza o status explícito do banco. 
    // Só usa a lógica de "hasGraduated" se o status específico não existir.
    let status = data.education_status || data.education?.status;
    if (!status && data.hasGraduated) {
        status = data.hasGraduated === 'sim' ? 'Completo' : 'Cursando';
    }
    
    // Capitaliza a primeira letra do status para ficar bonito na tela
    if (status) status = status.charAt(0).toUpperCase() + status.slice(1);

    return (
        <>
            <Box sx={{ mt: 3 }}>
                <Typography variant="caption" fontWeight="bold" sx={{textTransform: 'uppercase', color: 'text.secondary', display:'flex', alignItems:'center', gap:1}}><BookOpen size={14}/> Formação</Typography>
                <Box sx={{ bgcolor: '#f9fafb', p: 1.5, borderRadius: 1, border: '1px solid #eee', mt: 0.5 }}>
                    <Typography variant="caption" display="block" fontWeight="bold">{course || 'Não informado'}</Typography>
                    <Typography variant="caption" display="block" color="text.secondary">{institution}</Typography>
                    <Box display="flex" gap={2} mt={0.5}>
                        {year && <Typography variant="caption" color="text.secondary">Conclusão: {year}</Typography>}
                        {status && <Typography variant="caption" color="primary" fontWeight="bold">{status}</Typography>}
                    </Box>
                </Box>
            </Box>
            {(data.englishLevel || data.spanishLevel) && (
                <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" fontWeight="bold" sx={{textTransform: 'uppercase', color: 'text.secondary', display:'flex', alignItems:'center', gap:1}}><Languages size={14}/> Idiomas</Typography>
                    <Box sx={{ bgcolor: '#f9fafb', p: 1.5, borderRadius: 1, border: '1px solid #eee', mt: 0.5 }}>
                        {data.englishLevel && <Typography variant="caption" display="block">🇺🇸 Inglês: <strong>{data.englishLevel}</strong></Typography>}
                        {data.spanishLevel && <Typography variant="caption" display="block">🇪🇸 Espanhol: <strong>{data.spanishLevel}</strong></Typography>}
                    </Box>
                </Box>
            )}
        </>
    );
  };

  const renderScoreBadges = (gScore, myEval, count) => {
    let myFinalScore = 0;
    if(myEval) {
       // Calcula nota usando os dados crus do banco
       const calc = processEvaluation(myEval, job?.parameters);
       myFinalScore = calc.total;
    }
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 3, width: '100%' }}>
            <Paper elevation={0} sx={{ bgcolor: gScore >= 5 ? '#e8f5e9' : '#fff3e0', p: 2, borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="subtitle2" sx={{ fontSize: '0.75rem' }}>Nota Global ({count})</Typography>
                <Typography variant="h3" sx={{ fontWeight: 800 }}>{Number(gScore).toFixed(1)}</Typography>
            </Paper>
            <Paper elevation={0} sx={{ bgcolor: '#f3f4f6', p: 2, borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="subtitle2" sx={{ fontSize: '0.75rem', mb: 1 }}>Minha Nota</Typography>
                <Typography variant="h3" sx={{ fontWeight: 800, color: '#374151' }}>{Number(myFinalScore).toFixed(1)}</Typography>
            </Paper>
        </Box>
    );
  };

  if (loading) return <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>;
  if (!appData) return <Box p={4} textAlign="center">Candidato não encontrado.</Box>;

  const params = job?.parameters || {};
  const formData = appData.formData || {};
  const candidate = appData.candidate || {};
  
  const displayPhone = candidate.phone || formData.phone;
  const displayCity = candidate.city || formData.city;
  const displayState = candidate.state || formData.state;
  
  return (
    <Box sx={{ bgcolor: '#f8f9fa', minHeight: '100vh', p: 2 }}>
      <Button onClick={() => navigate(-1)} startIcon={<ArrowLeft size={16}/>} sx={{ mb: 2, color: 'text.secondary' }}>Voltar</Button>
      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 3, height: '100%' }} elevation={0} variant="outlined">
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <Avatar sx={{ width: 80, height: 80, bgcolor: '#1976d2', fontSize: '2rem', mb: 2, fontWeight: 'bold' }}>{candidate.name?.[0]}</Avatar>
              <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{candidate.name}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2 }}>{job?.title}</Typography>
              {renderScoreBadges(globalScore, currentUserEvaluation, evaluatorsCount)}
            </Box>
            <Divider sx={{ my: 3 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box display="flex" alignItems="center" gap={1.5}><Mail size={16} className="text-gray-400"/><Typography variant="body2" sx={{wordBreak: 'break-all'}}>{candidate.email || formData.email}</Typography></Box>
                <Box display="flex" alignItems="center" gap={1.5}><Phone size={16} className="text-gray-400"/><Typography variant="body2">{formatPhone(displayPhone)}</Typography></Box>
                <Box display="flex" alignItems="center" gap={1.5}><MapPin size={16} className="text-gray-400"/><Typography variant="body2">{displayCity} - {displayState}</Typography></Box>
            </Box>
            <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {candidate.resume_url && (<Button variant="contained" fullWidth href={candidate.resume_url} target="_blank" startIcon={<Download size={18}/>}>Ver Currículo</Button>)}
                {formData.linkedin_profile && (<Button variant="outlined" fullWidth href={formatUrl(formData.linkedin_profile)} target="_blank" startIcon={<Linkedin size={16}/>}>LinkedIn</Button>)}
            </Box>
            <Divider sx={{ my: 3 }} />
            {renderInfo(formData)}
            <Box sx={{ mt: 3 }}>
               <Typography variant="caption" fontWeight="bold" sx={{textTransform: 'uppercase', color: 'text.secondary', display:'flex', alignItems:'center', gap:1}}><FileText size={14}/> Motivação</Typography>
               <Typography variant="body2" paragraph sx={{ bgcolor: '#f9fafb', p: 1.5, borderRadius: 1, border: '1px solid #eee', mt: 1, whiteSpace: 'pre-line', fontSize: '0.85rem' }}>{formData.motivation || 'Não informada'}</Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={9}>
          <Paper sx={{ p: 0, height: '100%', overflow: 'hidden', bgcolor: 'transparent' }} elevation={0}>
             <EvaluationForm 
                applicationId={appData.id} 
                jobParameters={params} 
                initialData={currentUserEvaluation} 
                allEvaluations={othersEvaluations} 
                onSaved={fetchData} 
             />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}