import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import EvaluationForm from '../components/EvaluationForm';
import { ArrowLeft, Mail, MapPin, BookOpen, FileText, Download, Linkedin, Github, Phone, Calendar } from 'lucide-react';
import { Box, Grid, Paper, Typography, Button, CircularProgress, Divider, Avatar } from '@mui/material';
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
  const [allEvaluations, setAllEvaluations] = useState([]);
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
      
      // Parse Seguro do formData
      let safeFormData = application.formData;
      if (typeof safeFormData === 'string') {
          try { safeFormData = JSON.parse(safeFormData); } catch(e) { console.log('Erro parse formData', e); }
      }
      
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
              const { data: users } = await supabase.from('users').select('id, name, email').in('id', userIds);
              users?.forEach(u => usersMap[u.id] = u.name || u.email);
          }
          const evalsWithNames = allEvals.map(e => ({ ...e, evaluator_name: usersMap[e.evaluator_id] || 'Avaliador' }));
          setAllEvaluations(evalsWithNames);
          setEvaluatorsCount(evalsWithNames.length);
          
          let sumTotal = 0, validCount = 0;
          evalsWithNames.forEach(ev => {
              const scores = processEvaluation(ev, jobParams);
              if (scores.total > 0) { sumTotal += scores.total; validCount++; }
          });
          setGlobalScore(validCount > 0 ? (sumTotal / validCount) : 0);

          if (user) {
              const myEval = allEvals.find(e => e.evaluator_id === user.id);
              if (myEval) {
                  const myScores = processEvaluation(myEval, jobParams);
                  setCurrentUserEvaluation({ ...myEval.scores, anotacoes_gerais: myEval.notes || myEval.scores?.anotacoes_gerais, final_score: myScores.total });
              } else { setCurrentUserEvaluation(null); }
          }
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const renderInfo = (data) => {
    if (!data) return null;
    
    // Suporte para estrutura plana (novo JSON) ou aninhada (antigo)
    const course = data.course || data.education?.course;
    const institution = data.institution || data.education?.institution;
    const year = data.completionYear || data.education?.date;
    const birth = data.birthDate;
    const eng = data.englishLevel;

    return (
        <>
            {/* Bloco Formação */}
            <Box sx={{ mt: 3 }}>
                <Typography variant="caption" fontWeight="bold" sx={{textTransform: 'uppercase', color: 'text.secondary', display:'flex', alignItems:'center', gap:1}}>
                    <BookOpen size={14}/> Formação
                </Typography>
                <Box sx={{ bgcolor: '#f9fafb', p: 1.5, borderRadius: 1, border: '1px solid #eee', mt: 0.5 }}>
                    <Typography variant="caption" display="block" fontWeight="bold">{course || 'Curso não informado'}</Typography>
                    <Typography variant="caption" display="block" color="text.secondary">{institution || 'Instituição não informada'}</Typography>
                    {year && <Typography variant="caption" display="block" color="text.secondary">Conclusão: {year}</Typography>}
                </Box>
            </Box>

            {/* Bloco Extras (Inglês, Nasc) */}
            {(birth || eng) && (
                <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" fontWeight="bold" sx={{textTransform: 'uppercase', color: 'text.secondary', display:'flex', alignItems:'center', gap:1}}>
                        <Calendar size={14}/> Detalhes
                    </Typography>
                    <Box sx={{ bgcolor: '#f9fafb', p: 1.5, borderRadius: 1, border: '1px solid #eee', mt: 0.5 }}>
                        {birth && <Typography variant="caption" display="block">Nascimento: {birth}</Typography>}
                        {eng && <Typography variant="caption" display="block">Inglês: {eng}</Typography>}
                    </Box>
                </Box>
            )}
        </>
    );
  };

  const renderScoreBadges = (gScore, myScore, count) => {
    const getBgColor = (s) => s >= 8 ? '#e8f5e9' : s >= 5 ? '#fff3e0' : '#ffebee';
    const getTextColor = (s) => s >= 8 ? '#2e7d32' : s >= 5 ? '#ef6c00' : '#c62828';
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 3, width: '100%' }}>
            <Paper elevation={0} sx={{ bgcolor: getBgColor(gScore), p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
                <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', fontWeight: 'bold', color: 'text.secondary', fontSize: '0.75rem' }}>Nota Global</Typography>
                <Typography variant="caption" sx={{ display:'block', fontSize: '0.7rem', color: 'text.secondary', mb: 0.5 }}>({count} {count === 1 ? 'avaliação' : 'avaliações'})</Typography>
                <Typography variant="h3" sx={{ fontWeight: 800, color: getTextColor(gScore), lineHeight: 1 }}>{Number(gScore || 0).toFixed(1)}</Typography>
            </Paper>
            <Paper elevation={0} sx={{ bgcolor: '#f3f4f6', p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
                <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', fontWeight: 'bold', color: 'text.secondary', fontSize: '0.75rem', mb: 1 }}>Minha Nota</Typography>
                <Typography variant="h3" sx={{ fontWeight: 800, color: '#374151', lineHeight: 1 }}>{Number(myScore || 0).toFixed(1)}</Typography>
            </Paper>
        </Box>
    );
  };

  if (loading) return <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>;
  if (!appData) return <Box p={4} textAlign="center">Candidato não encontrado.</Box>;

  const params = job?.parameters || {};
  const formData = appData.formData || {};
  const candidate = appData.candidate || {};
  
  // Mescla dados do formData com a tabela candidate
  const displayPhone = candidate.phone || formData.phone;
  const displayCity = candidate.city || formData.city;
  const displayState = candidate.state || formData.state;
  const linkedIn = candidate.linkedin_profile || formData.linkedinProfile || formData.linkedin_profile;
  const gitHub = candidate.github_profile || formData.githubProfile;

  return (
    <Box sx={{ bgcolor: '#f8f9fa', minHeight: '100vh', p: 2 }}>
      <Button onClick={() => navigate(-1)} startIcon={<ArrowLeft size={16}/>} sx={{ mb: 2, color: 'text.secondary' }}>Voltar</Button>
      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 3, height: '100%' }} elevation={0} variant="outlined">
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <Avatar sx={{ width: 80, height: 80, bgcolor: '#1976d2', fontSize: '2rem', mb: 2, fontWeight: 'bold' }}>{candidate.name?.[0]}</Avatar>
              <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 'bold', lineHeight: 1.2 }}>{candidate.name}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2 }}>{job?.title}</Typography>
              {renderScoreBadges(globalScore, currentUserEvaluation?.final_score, evaluatorsCount)}
            </Box>
            <Divider sx={{ my: 3 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box display="flex" alignItems="center" gap={1.5}><Mail size={16} className="text-gray-400"/><Typography variant="body2" sx={{wordBreak: 'break-all'}}>{candidate.email || formData.email}</Typography></Box>
                <Box display="flex" alignItems="center" gap={1.5}><Phone size={16} className="text-gray-400"/><Typography variant="body2">{formatPhone(displayPhone)}</Typography></Box>
                <Box display="flex" alignItems="center" gap={1.5}><MapPin size={16} className="text-gray-400"/><Typography variant="body2">{displayCity} - {displayState}</Typography></Box>
            </Box>
            <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {candidate.resume_url && (<Button variant="contained" color="primary" fullWidth href={candidate.resume_url} target="_blank" startIcon={<Download size={18}/>} sx={{ mb: 1, textTransform: 'none', fontWeight: 'bold' }}>Ver Currículo</Button>)}
                {linkedIn && (<Button variant="outlined" fullWidth href={formatUrl(linkedIn)} target="_blank" startIcon={<Linkedin size={16}/>} sx={{ textTransform: 'none', color: '#0077b5', borderColor: '#0077b5' }}>LinkedIn</Button>)}
                {gitHub && (<Button variant="outlined" fullWidth href={formatUrl(gitHub)} target="_blank" startIcon={<Github size={16}/>} sx={{ textTransform: 'none', color: '#333', borderColor: '#333' }}>GitHub</Button>)}
            </Box>
            <Divider sx={{ my: 3 }} />
            
            {renderInfo(formData)}

            <Box sx={{ mt: 3 }}>
               <Typography variant="caption" fontWeight="bold" sx={{textTransform: 'uppercase', color: 'text.secondary', display:'flex', alignItems:'center', gap:1}}><FileText size={14}/> Motivação</Typography>
               <Typography variant="body2" paragraph sx={{ bgcolor: '#f9fafb', p: 1.5, borderRadius: 1, border: '1px solid #eee', mt: 1, whiteSpace: 'pre-line', fontSize: '0.85rem' }}>{formData.motivation || 'Não informada'}</Typography>
            </Box>
            <Box sx={{ mt: 2 }}><Typography variant="caption" color="text.secondary">Candidatou-se em: {new Date(appData.created_at).toLocaleDateString('pt-BR')}</Typography></Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={9}>
          <Paper sx={{ p: 0, height: '100%', overflow: 'hidden', bgcolor: 'transparent' }} elevation={0}>
             <EvaluationForm applicationId={appData.id} jobParameters={params} initialData={currentUserEvaluation} allEvaluations={allEvaluations} onSaved={fetchData} />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}