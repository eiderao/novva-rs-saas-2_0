import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { 
    Container, Typography, Box, AppBar, Toolbar, Button, CircularProgress, 
    Paper, Tabs, Tab, TextField, IconButton, Snackbar,
    List, ListItem, ListItemText, Divider, Grid,
    Table, TableHead, TableRow, TableCell, TableBody, Checkbox,
    FormControl, InputLabel, Select, MenuItem, Chip, Modal, Alert, Tooltip as MuiTooltip
} from '@mui/material';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, LabelList,
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis 
} from 'recharts';
import { 
    ContentCopy as ContentCopyIcon,
    Save as SaveIcon,
    Add as AddIcon,
    Star as StarIcon,
    CheckCircle as CheckCircleIcon,
    EmojiEvents as TrophyIcon,
    Delete as DeleteIcon
} from '@mui/icons-material';
import { processEvaluation, generateDefaultBenchmarkScores } from '../utils/evaluationLogic';
import EvaluationForm from '../components/EvaluationForm'; 

// --- ÍCONE SVG ---
const ArrowIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
);

const modalStyle = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 600, bgcolor: 'background.paper', boxShadow: 24, p: 4, borderRadius: 2 };
const formModalStyle = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '90%', maxWidth: 800, height: '85vh', bgcolor: 'background.paper', boxShadow: 24, p: 0, borderRadius: 2, overflow: 'hidden' };

// --- COMPONENTE DE CRITÉRIOS ---
const ParametersSection = ({ criteria = [], onCriteriaChange }) => {
  const handleChange = (i, f, v) => { const n = [...criteria]; n[i] = { ...n[i], [f]: f==='weight'?Number(v):v }; onCriteriaChange(n); };
  const total = criteria.reduce((acc, c) => acc + (Number(c.weight)||0), 0);
  return (
    <Box sx={{mt:2, bgcolor: '#f8f9fa', p: 2, borderRadius: 2}}>
        {criteria.map((c, i) => (
            <Box key={i} display="flex" gap={2} mb={1} alignItems="center">
                <TextField value={c.name} onChange={e=>handleChange(i,'name',e.target.value)} fullWidth size="small" label={`Critério #${i+1}`} variant="outlined" sx={{ bgcolor: 'white' }} />
                <TextField type="number" value={c.weight} onChange={e=>handleChange(i,'weight',e.target.value)} sx={{width:120, bgcolor: 'white'}} size="small" label="Peso %" />
                <IconButton onClick={()=>onCriteriaChange(criteria.filter((_,idx)=>idx!==i))} color="error" size="small"><DeleteIcon/></IconButton>
            </Box>
        ))}
        <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
            <Button onClick={()=>onCriteriaChange([...criteria, {name:'', weight:0}])} variant="outlined" size="small" startIcon={<AddIcon />}>Adicionar Critério</Button>
            <Typography color={total===100?'success.main':'error.main'} variant="body2" fontWeight="bold">Total: {total}%</Typography>
        </Box>
    </Box>
  );
};

// --- RÉGUA DE NOTAS ---
const RatingScaleSection = ({ notes = [], onNotesChange }) => {
    const handleChange = (i, field, value) => {
        const newNotes = [...notes];
        newNotes[i] = { ...newNotes[i], [field]: field === 'valor' ? Number(value) : value };
        onNotesChange(newNotes);
    };
    const handleAdd = () => onNotesChange([...notes, { id: crypto.randomUUID(), nome: 'Novo Nível', valor: 0 }]);
    const handleRemove = (i) => onNotesChange(notes.filter((_, idx) => idx !== i));
    return (
        <Box sx={{ mt: 2, bgcolor: '#fff3e0', p: 2, borderRadius: 2 }}>
            {notes.map((n, i) => (
                <Box key={n.id || i} display="flex" gap={2} mb={1} alignItems="center">
                    <TextField value={n.nome} onChange={(e) => handleChange(i, 'nome', e.target.value)} fullWidth size="small" label="Rótulo" sx={{bgcolor: 'white'}} />
                    <TextField type="number" value={n.valor} onChange={(e) => handleChange(i, 'valor', e.target.value)} sx={{ width: 120, bgcolor: 'white' }} size="small" label="Valor" />
                    <IconButton onClick={() => handleRemove(i)} color="error"><DeleteIcon /></IconButton>
                </Box>
            ))}
            <Button onClick={handleAdd} variant="outlined" color="warning" size="small" startIcon={<AddIcon />}>Adicionar Nível</Button>
        </Box>
    );
};

// --- MODAL DE CÓPIA ---
const CopyParametersModal = ({ open, onClose, currentJobId, onCopy }) => {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  useEffect(() => { 
      if (open) { 
          const f = async () => { 
            const { data } = await supabase.from('jobs').select('id, title').neq('id', currentJobId).eq('status', 'active'); 
            setJobs(data || []); 
          }; 
          f(); 
      } 
  }, [open, currentJobId]);
  const handleConfirm = async () => { 
      if (!selectedJobId) return; 
      const { data } = await supabase.from('jobs').select('parameters').eq('id', selectedJobId).single(); 
      if (data?.parameters) onCopy(data.parameters); 
      onClose(); 
  };
  return ( 
      <Modal open={open} onClose={onClose}>
          <Box sx={modalStyle}>
              <Typography variant="h6">Copiar de Vaga</Typography>
              <FormControl fullWidth margin="normal">
                  <InputLabel>Vaga</InputLabel>
                  <Select value={selectedJobId} onChange={e=>setSelectedJobId(e.target.value)} label="Vaga">
                      {jobs.map(j=><MenuItem key={j.id} value={j.id}>{j.title}</MenuItem>)}
                  </Select>
              </FormControl>
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                  <Button onClick={onClose}>Cancelar</Button>
                  <Button onClick={handleConfirm} variant="contained" disabled={!selectedJobId}>Copiar</Button>
              </Box>
          </Box>
      </Modal> 
  );
};

export default function JobDetails() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [parameters, setParameters] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tabValue, setTabValue] = useState(0); 
  const [applicants, setApplicants] = useState([]);
  const [allEvaluations, setAllEvaluations] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Filtros
  const [evaluatorFilter, setEvaluatorFilter] = useState('all');
  const [metricFilter, setMetricFilter] = useState('Geral'); 

  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [isIdealModalOpen, setIsIdealModalOpen] = useState(false);
  const [editingAppId, setEditingAppId] = useState(null); 
  const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'success' });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchData = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);
        
        const isSuperAdmin = user?.email === 'eider@novvaempresa.com.br';
        setIsAdmin(isSuperAdmin);

        // A. Dados da Vaga
        const { data: jobData } = await supabase.from('jobs').select('*').eq('id', jobId).single();
        setJob(jobData);
        
        const safeParams = jobData.parameters || { 
            triagem: [], cultura: [], tecnico: [], 
            notas: [{id:'1',nome:'Abaixo',valor:0}, {id:'2',nome:'Atende',valor:5}, {id:'3',nome:'Supera',valor:10}] 
        };
        setParameters(safeParams);

        // B. Candidatos
        const { data: appsData } = await supabase.from('applications').select('*, candidate:candidates(name, email)').eq('jobId', jobId);
        
        let evaluations = [];

        // --- AUTO-HEALING ---
        const idealEmail = `benchmark_${jobId}@novva.app`;
        let idealApp = appsData?.find(a => a.candidate?.email === idealEmail);

        if (!idealApp && user) {
            const { data: cand } = await supabase.from('candidates').upsert(
                { name: 'Candidato Ideal (Referência)', email: idealEmail, city: 'N/A', state: 'N/A' }, 
                { onConflict: 'email' }
            ).select().single();
            
            const { data: app } = await supabase.from('applications').insert({
                jobId: jobId, candidateId: cand.id, status: 'benchmark', isHired: false
            }).select('*, candidate:candidates(*)').single();

            const defaultScores = generateDefaultBenchmarkScores(safeParams);
            const { data: newEval } = await supabase.from('evaluations').insert({
                application_id: app.id, evaluator_id: user.id, scores: defaultScores, final_score: 5, notes: 'Gabarito Padrão'
            }).select().single();

            if (app) {
                idealApp = app;
                appsData.push(app); 
            }
            if (newEval) {
                evaluations.push(newEval); 
            }
        }
        
        setApplicants(appsData || []);

        // C. Avaliações
        const appIds = (appsData || []).map(a => a.id);
        if (appIds.length > 0) {
            const { data: evalsData } = await supabase.from('evaluations').select('*').in('application_id', appIds);
            
            const mergedEvaluations = [...(evalsData || [])];
            evaluations.forEach(ne => {
                 if(!mergedEvaluations.find(e => e.id === ne.id)) mergedEvaluations.push(ne);
            });

            setAllEvaluations(mergedEvaluations);

            const userIds = [...new Set(mergedEvaluations.map(e => e.evaluator_id))];
            if (userIds.length > 0) {
                const { data: usersData } = await supabase.from('users').select('id, name, email').in('id', userIds);
                const map = {};
                usersData?.forEach(u => map[u.id] = u.name || u.email);
                setUsersMap(map);
            }
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };

  useEffect(() => {
    fetchData();
  }, [jobId, refreshTrigger]);

  // PROCESSAMENTO DE DADOS
  const processedData = useMemo(() => {
    if (!parameters) return { chartData: [], evaluators: [] };

    const evaluators = Object.keys(usersMap).map(id => ({ id, name: usersMap[id] || 'Desconhecido' }));

    let chartData = applicants.map(app => {
        const isIdeal = app.status === 'benchmark' || app.candidate?.email?.includes('benchmark_');

        const appEvals = allEvaluations.filter(e => 
            String(e.application_id) === String(app.id) && 
            (evaluatorFilter === 'all' || e.evaluator_id === evaluatorFilter)
        );

        let sumT = 0, sumC = 0, sumTc = 0, count = 0, sumTotal = 0;
        let lastEvalData = null; 

        if (appEvals.length > 0) {
            if (isIdeal) {
                 lastEvalData = appEvals[appEvals.length - 1]; 
                 const scores = processEvaluation(lastEvalData, parameters);
                 sumT = scores.triagem; sumC = scores.cultura; sumTc = scores.tecnico; sumTotal = scores.total; count = 1;
            } else {
                appEvals.forEach(ev => {
                    const scores = processEvaluation(ev, parameters);
                    if (scores.total >= 0) {
                        sumT += scores.triagem; sumC += scores.cultura; sumTc += scores.tecnico; sumTotal += scores.total; count++;
                        lastEvalData = ev; 
                    }
                });
            }
        }

        const avgT = count > 0 ? sumT / count : 0;
        const avgC = count > 0 ? sumC / count : 0;
        const avgTc = count > 0 ? sumTc / count : 0;
        const general = count > 0 ? sumTotal / count : 0;

        return {
            appId: app.id,
            name: isIdeal ? 'Candidato Ideal' : (app.candidate?.name || 'Sem Nome'),
            email: app.candidate?.email,
            triagem: Number(avgT.toFixed(1)),
            cultura: Number(avgC.toFixed(1)),
            tecnico: Number(avgTc.toFixed(1)),
            total: Number(general.toFixed(1)),
            count: count,
            hired: app.isHired,
            isIdeal: isIdeal,
            lastEval: lastEvalData 
        };
    });

    if (evaluatorFilter !== 'all') {
        chartData = chartData.filter(c => c.count > 0 || c.isIdeal);
    }

    chartData.sort((a, b) => {
        if (a.isIdeal) return -1;
        if (b.isIdeal) return 1;

        let key = 'total';
        if (metricFilter === 'Triagem') key = 'triagem';
        if (metricFilter === 'Fit Cultural') key = 'cultura';
        if (metricFilter === 'Teste Técnico') key = 'tecnico';
        return b[key] - a[key];
    });

    const idealCandidate = chartData.find(c => c.isIdeal) || { triagem:0, cultura:0, tecnico:0, total:0 };

    return { chartData, evaluators, idealCandidate };
  }, [applicants, allEvaluations, evaluatorFilter, parameters, usersMap, metricFilter]);

  // AÇÕES
  const handleHireToggle = async (appId, currentStatus) => {
      const newStatus = !currentStatus;
      setApplicants(prev => prev.map(a => a.id === appId ? {...a, isHired: newStatus} : a));
      const { error } = await supabase.from('applications').update({ isHired: newStatus }).eq('id', appId);
      if (!error) {
          setFeedback({ open: true, message: newStatus ? 'Contratado!' : 'Descontratado.', severity: 'success' });
      } else {
          setApplicants(prev => prev.map(a => a.id === appId ? {...a, isHired: currentStatus} : a));
          alert("Erro ao atualizar status.");
      }
  };

  const handleSaveParameters = async () => {
      setSaving(true);
      await supabase.from('jobs').update({ parameters }).eq('id', jobId);
      setSaving(false);
      setFeedback({ open: true, message: 'Configurações salvas!', severity: 'success' });
  };

  const handleOpenEvaluation = (appId, isIdeal) => {
      if (isIdeal && !isAdmin) {
          alert("Apenas administradores podem alterar o Candidato Ideal.");
          return;
      }
      setEditingAppId(appId);
      setIsIdealModalOpen(true);
  };

  const onEvaluationSaved = () => {
      setIsIdealModalOpen(false);
      setRefreshTrigger(prev => prev + 1);
      setFeedback({ open: true, message: 'Avaliação salva com sucesso!', severity: 'success' });
  };

  const getScoreColor = (val) => {
      if (val >= 8) return 'success';
      if (val >= 5) return 'warning';
      return 'default';
  };
  const getScoreColorHex = (val) => {
      if (val >= 8) return '#2e7d32'; 
      if (val >= 5) return '#ed6c02';
      return '#94a3b8';
  };

  // Define qual barra mostrar quando um filtro específico é selecionado
  const activeDataKey = useMemo(() => {
      if (metricFilter === 'Triagem') return 'triagem';
      if (metricFilter === 'Fit Cultural') return 'cultura';
      if (metricFilter === 'Teste Técnico') return 'tecnico';
      return 'total';
  }, [metricFilter]);

  if (loading) return <Box p={10} display="flex" justifyContent="center"><CircularProgress /></Box>;

  return (
    <Box sx={{ bgcolor: '#f4f6f8', minHeight: '100vh', pb: 8 }}>
        <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: '1px solid #e0e0e0', bgcolor: 'white' }}>
            <Toolbar>
                <IconButton edge="start" onClick={() => navigate('/')} sx={{ mr: 2 }}><ArrowIcon /></IconButton>
                <Typography variant="h6" sx={{flexGrow:1, fontWeight:'bold'}}>{job?.title}</Typography>
                <Button component={RouterLink} to="/">Voltar</Button>
            </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ mt: 4 }}>
            <Paper sx={{ mb: 3, borderRadius: 2 }}>
                <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} centered>
                    <Tab label={`Candidatos (${applicants.length})`} />
                    <Tab label="Ranking" icon={<TrophyIcon />} iconPosition="start" />
                    <Tab label="Configuração da Vaga" />
                </Tabs>
            </Paper>
            
            {/* ABA 0: LISTA SIMPLES */}
            {tabValue === 0 && (
                <Paper sx={{ p: 0, borderRadius: 2, overflow: 'hidden' }}>
                    <Table>
                        <TableHead sx={{ bgcolor: '#f9fafb' }}>
                            <TableRow>
                                <TableCell><strong>Nome</strong></TableCell>
                                <TableCell><strong>Email</strong></TableCell>
                                <TableCell align="center"><strong>Status</strong></TableCell>
                                <TableCell align="center"><strong>Avaliações</strong></TableCell>
                                <TableCell align="center"><strong>Nota Geral</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {processedData.chartData.map(d => {
                                const isClickable = d.isIdeal ? isAdmin : true; 
                                const rowBg = d.isIdeal ? '#fff7ed' : 'inherit';

                                return (
                                    <TableRow 
                                        key={d.appId} 
                                        hover 
                                        sx={{ bgcolor: rowBg, cursor: isClickable ? 'pointer' : 'default' }}
                                        onClick={() => {
                                            if (d.isIdeal) {
                                                if(isAdmin) handleOpenEvaluation(d.appId, true);
                                            } else {
                                                navigate(`/applications/${d.appId}`);
                                            }
                                        }}
                                    >
                                        <TableCell sx={{ fontWeight: d.isIdeal ? 'bold' : 'normal', color: d.isIdeal ? 'orange' : 'inherit' }}>
                                            {d.isIdeal && <StarIcon sx={{fontSize: 16, mr: 1, verticalAlign: 'text-top'}}/>}
                                            {d.name}
                                        </TableCell>
                                        <TableCell>{d.email}</TableCell>
                                        <TableCell align="center">
                                            {d.isIdeal ? <Chip label="Referência" size="small" color="warning" variant="outlined"/> : 
                                             d.hired ? <Chip label="Contratado" color="success" size="small" icon={<CheckCircleIcon/>}/> : 
                                             <Chip label="Em análise" size="small"/>}
                                        </TableCell>
                                        <TableCell align="center"><Chip label={d.count} size="small" variant="outlined" /></TableCell>
                                        <TableCell align="center">
                                            <Chip label={d.total.toFixed(1)} color={getScoreColor(d.total)} variant={d.count > 0 ? 'filled' : 'outlined'} />
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </Paper>
            )}

            {/* ABA 1: RANKING */}
            {tabValue === 1 && (
                <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                        <Paper sx={{ height: '100%', maxHeight: '800px', display: 'flex', flexDirection: 'column', borderRadius: 2 }} elevation={2}>
                            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <Typography variant="subtitle2" color="text.secondary" mb={1} fontWeight="bold">FILTROS</Typography>
                                
                                <FormControl fullWidth size="small" sx={{ mb: 2, bgcolor: 'white' }}>
                                    <InputLabel>Avaliador</InputLabel>
                                    <Select value={evaluatorFilter} label="Avaliador" onChange={(e) => setEvaluatorFilter(e.target.value)}>
                                        <MenuItem value="all">Média (Todos)</MenuItem>
                                        {processedData.evaluators.map(ev => <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>)}
                                    </Select>
                                </FormControl>

                                {/* FILTRO DE PILARES (NOVA MODIFICAÇÃO) */}
                                <FormControl fullWidth size="small" sx={{ bgcolor: 'white' }}>
                                    <InputLabel>Pilar / Critério</InputLabel>
                                    <Select value={metricFilter} label="Pilar / Critério" onChange={(e) => setMetricFilter(e.target.value)}>
                                        <MenuItem value="Geral">Todos (Geral + Pilares)</MenuItem>
                                        <MenuItem value="Triagem">Triagem</MenuItem>
                                        <MenuItem value="Fit Cultural">Fit Cultural</MenuItem>
                                        <MenuItem value="Teste Técnico">Teste Técnico</MenuItem>
                                    </Select>
                                </FormControl>
                            </Box>

                            <List sx={{ overflowY: 'auto', flex: 1 }}>
                                {processedData.chartData.map((d, index) => {
                                    let displayVal = d.total;
                                    if(metricFilter === 'Triagem') displayVal = d.triagem;
                                    if(metricFilter === 'Fit Cultural') displayVal = d.cultura;
                                    if(metricFilter === 'Teste Técnico') displayVal = d.tecnico;
                                    
                                    if (d.isIdeal) {
                                        return (
                                            <ListItem key="ideal" sx={{ bgcolor: '#fff7ed', borderBottom: '1px dashed orange' }}>
                                                <StarIcon sx={{ color: 'orange', mr: 1, fontSize: 20 }} />
                                                <ListItemText 
                                                    primary={<Typography variant="caption" fontWeight="bold" color="orange" sx={{fontSize: '0.8rem'}}>Candidato Ideal (Ref)</Typography>} 
                                                />
                                                <Chip label={displayVal.toFixed(1)} size="small" sx={{ bgcolor: 'orange', color: 'white', fontWeight: 'bold', height: 20, fontSize: '0.7rem' }} />
                                            </ListItem>
                                        )
                                    }
                                    return (
                                        <React.Fragment key={d.appId}>
                                            <ListItem 
                                                secondaryAction={
                                                    <Box textAlign="right" display="flex" alignItems="center" gap={1}>
                                                        <Typography variant="body2" fontWeight="bold" sx={{color: getScoreColorHex(displayVal), fontSize: '0.9rem'}}>
                                                            {displayVal.toFixed(1)}
                                                        </Typography>
                                                        <Checkbox checked={d.hired || false} onChange={() => handleHireToggle(d.appId, d.hired)} color="success" size="small" disabled={d.isIdeal} />
                                                    </Box>
                                                }
                                            >
                                                <ListItemText 
                                                    primary={<Typography variant="body2" fontWeight="bold" sx={{fontSize: '0.85rem'}}>#{index} {d.name}</Typography>}
                                                    secondary={<Typography variant="caption" sx={{fontSize: '0.7rem', display: 'block', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{d.email}</Typography>}
                                                />
                                            </ListItem>
                                            <Divider component="li" />
                                        </React.Fragment>
                                    )
                                })}
                            </List>
                        </Paper>
                    </Grid>

                    <Grid item xs={12} md={8}>
                        <Grid container spacing={3}>
                            <Grid item xs={12}>
                                <Paper sx={{ p: 3, height: '550px', borderRadius: 2 }} elevation={2}>
                                    <Typography variant="h6" mb={2} fontWeight="bold" color="#334155">Comparativo de Perfil</Typography>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={[
                                            { subject: 'Triagem', ideal: processedData.idealCandidate.triagem, ...processedData.chartData.slice(1,4).reduce((acc,c,i)=>({...acc, [`c${i}`]: c.triagem}), {}) },
                                            { subject: 'Cultura', ideal: processedData.idealCandidate.cultura, ...processedData.chartData.slice(1,4).reduce((acc,c,i)=>({...acc, [`c${i}`]: c.cultura}), {}) },
                                            { subject: 'Técnico', ideal: processedData.idealCandidate.tecnico, ...processedData.chartData.slice(1,4).reduce((acc,c,i)=>({...acc, [`c${i}`]: c.tecnico}), {}) }
                                        ]}>
                                            <PolarGrid />
                                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#333', fontWeight: 'bold', fontSize: 14 }} />
                                            <PolarRadiusAxis angle={30} domain={[0, 'auto']} /> 
                                            <Radar name="Ideal" dataKey="ideal" stroke="#000000" strokeWidth={3} strokeDasharray="5 5" fill="none" />
                                            {processedData.chartData.slice(1, 4).map((c, i) => (
                                                <Radar key={i} name={c.name} dataKey={`c${i}`} stroke={['#8884d8','#82ca9d','#ffc658'][i]} fill={['#8884d8','#82ca9d','#ffc658'][i]} fillOpacity={0.2} label={{ position: 'top', fill: '#333', fontSize: 12, fontWeight: 'bold' }} />
                                            ))}
                                            <Legend />
                                            <Tooltip />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </Paper>
                            </Grid>
                            <Grid item xs={12}>
                                <Paper sx={{ p: 3, minHeight: '600px', borderRadius: 2 }} elevation={2}>
                                    <Typography variant="h6" mb={3} fontWeight="bold" color="#334155">Comparativo por {metricFilter}</Typography>
                                    {processedData.chartData.length > 0 ? (
                                        <Box sx={{ height: Math.max(500, processedData.chartData.length * (metricFilter==='Geral'?100:60)) }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={processedData.chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }} barSize={metricFilter === 'Geral' ? 12 : 24} barGap={2}>
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                                    <XAxis type="number" domain={[0, 'auto']} hide />
                                                    <YAxis dataKey="name" type="category" width={150} tick={{fontSize: 11, fontWeight: 500}} />
                                                    <Tooltip cursor={{fill: '#f5f5f5'}} />
                                                    <Legend verticalAlign="top" height={36} />
                                                    
                                                    {/* LÓGICA DE EXIBIÇÃO CONDICIONAL (NOVA MODIFICAÇÃO) */}
                                                    {metricFilter === 'Geral' ? (
                                                        <>
                                                            <Bar dataKey="total" name="Geral" fill="#1e293b" radius={[0,4,4,0]}><LabelList dataKey="total" position="right" fontSize={10} /></Bar>
                                                            <Bar dataKey="triagem" name="Triagem" fill="#93c5fd" radius={[0,4,4,0]} />
                                                            <Bar dataKey="cultura" name="Fit Cult." fill="#86efac" radius={[0,4,4,0]} />
                                                            <Bar dataKey="tecnico" name="Técnico" fill="#fca5a5" radius={[0,4,4,0]} />
                                                        </>
                                                    ) : (
                                                        <Bar dataKey={activeDataKey} name={metricFilter} fill="#8884d8" radius={[0, 4, 4, 0]}>
                                                            <LabelList position="right" formatter={(v) => v.toFixed(1)} />
                                                        </Bar>
                                                    )}
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </Box>
                                    ) : (
                                        <Typography align="center" color="text.secondary" py={10}>Sem dados.</Typography>
                                    )}
                                </Paper>
                            </Grid>
                        </Grid>
                    </Grid>
                </Grid>
            )}

            {tabValue === 2 && (
                <Box p={3} sx={{ bgcolor: 'white', borderRadius: 2 }}>
                    <Box display="flex" justifyContent="space-between" mb={2}>
                        <Typography variant="h6">Configuração da Vaga</Typography>
                        <Button startIcon={<ContentCopyIcon />} onClick={() => setIsCopyModalOpen(true)}>Importar</Button>
                    </Box>
                    <ParametersSection criteria={parameters?.triagem} onCriteriaChange={c => setParameters({...parameters, triagem: c})} />
                    <ParametersSection criteria={parameters?.cultura} onCriteriaChange={c => setParameters({...parameters, cultura: c})} />
                    <ParametersSection criteria={parameters?.tecnico} onCriteriaChange={c => setParameters({...parameters, tecnico: c})} />
                    <Box mt={4} p={2} bgcolor="#fff3e0" borderRadius={2}><Typography variant="subtitle1" fontWeight="bold" color="orange">Régua de Notas</Typography><RatingScaleSection notes={parameters?.notas} onNotesChange={n => setParameters({...parameters, notas: n})} /></Box>
                    <Box mt={3} display="flex" justifyContent="flex-end"><Button variant="contained" onClick={handleSaveParameters} disabled={saving} startIcon={<SaveIcon />}>Salvar Configurações</Button></Box>
                </Box>
            )}
        </Container>

        <CopyParametersModal open={isCopyModalOpen} onClose={() => setIsCopyModalOpen(false)} currentJobId={jobId} onCopy={(p) => { setParameters(p); setFeedback({open:true, message:'Copiado!', severity:'info'}); }} />
        
        <Modal open={isIdealModalOpen} onClose={() => setIsIdealModalOpen(false)}>
            <Box sx={formModalStyle}>
                <Box p={2} borderBottom="1px solid #eee" display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">Editar Avaliação do Candidato Ideal</Typography>
                    <Button onClick={() => setIsIdealModalOpen(false)}>Fechar</Button>
                </Box>
                <Box p={2} sx={{ height: 'calc(100% - 60px)', overflowY: 'auto' }}>
                     {editingAppId && (
                         <EvaluationForm 
                            applicationId={editingAppId}
                            jobParameters={parameters} 
                            initialData={applicants.find(a=>a.id===editingAppId)?.lastEval}
                            onSaved={onEvaluationSaved}
                         />
                     )}
                </Box>
            </Box>
        </Modal>

        <Snackbar open={feedback.open} autoHideDuration={4000} onClose={() => setFeedback({...feedback, open:false})}><Alert severity={feedback.severity} variant="filled">{feedback.message}</Alert></Snackbar>
    </Box>
  );
}