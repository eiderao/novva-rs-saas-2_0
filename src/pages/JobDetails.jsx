import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { format, parseISO } from 'date-fns';
import { 
    Container, Typography, Box, AppBar, Toolbar, Button, CircularProgress, 
    Alert, Paper, Tabs, Tab, TextField, IconButton, Snackbar,
    List, ListItem, ListItemText, Divider, Grid,
    Table, TableHead, TableRow, TableCell, TableBody, Checkbox,
    FormControl, InputLabel, Select, MenuItem, Chip, Modal
} from '@mui/material';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { Delete as DeleteIcon, ContentCopy as ContentCopyIcon, FileCopy as FileCopyIcon } from '@mui/icons-material';
import { formatStatus } from '../utils/formatters';
import { processEvaluation } from '../utils/evaluationLogic';

// --- (MODAL E PARAMS MANTIDOS - OMITIDOS PARA FOCAR NA CORREÇÃO) ---
// Certifique-se de manter o modalStyle, CopyParametersModal e ParametersSection aqui.
const modalStyle = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 500, bgcolor: 'background.paper', boxShadow: 24, p: 4 };
const CopyParametersModal = ({ open, onClose, currentJobId, onCopy }) => {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (open) { const f = async () => { setLoading(true); const { data } = await supabase.from('jobs').select('id, title').neq('id', currentJobId).eq('status', 'active'); setJobs(data || []); setLoading(false); }; f(); } }, [open, currentJobId]);
  const handleConfirmCopy = async () => { if (!selectedJobId) return; const { data } = await supabase.from('jobs').select('parameters').eq('id', selectedJobId).single(); if (data?.parameters) onCopy(data.parameters); onClose(); };
  return ( <Modal open={open} onClose={onClose}><Box sx={modalStyle}><Typography variant="h6">Copiar de Vaga</Typography>{loading?<CircularProgress/>:<FormControl fullWidth margin="normal"><InputLabel>Vaga</InputLabel><Select value={selectedJobId} onChange={e=>setSelectedJobId(e.target.value)} label="Vaga">{jobs.map(j=><MenuItem key={j.id} value={j.id}>{j.title}</MenuItem>)}</Select></FormControl>}<Button onClick={handleConfirmCopy} variant="contained" sx={{mt:2}} disabled={!selectedJobId}>Copiar</Button></Box></Modal> );
};
const ParametersSection = ({ criteria = [], onCriteriaChange }) => {
  const handleChange = (i, f, v) => { const n = [...criteria]; n[i] = { ...n[i], [f]: f==='weight'?Number(v):v }; onCriteriaChange(n); };
  const total = criteria.reduce((acc, c) => acc + (Number(c.weight)||0), 0);
  return (<Box sx={{mt:2}}>{criteria.map((c, i) => <Box key={i} display="flex" gap={2} mb={1}><TextField value={c.name} onChange={e=>handleChange(i,'name',e.target.value)} fullWidth size="small" /><TextField type="number" value={c.weight} onChange={e=>handleChange(i,'weight',e.target.value)} sx={{width:100}} size="small" /><IconButton onClick={()=>onCriteriaChange(criteria.filter((_,idx)=>idx!==i))} color="error"><DeleteIcon/></IconButton></Box>)}<Button onClick={()=>onCriteriaChange([...criteria, {name:'', weight:0}])}>Add</Button><Typography color={total===100?'green':'red'} variant="caption" display="block">Total: {total}%</Typography></Box>);
};

const JobDetails = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [parameters, setParameters] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [applicants, setApplicants] = useState([]);
  const [allEvaluations, setAllEvaluations] = useState([]);
  const [evaluatorFilter, setEvaluatorFilter] = useState('all');
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Não autenticado");

        // 1. Busca Vaga
        const { data: jobData } = await supabase.from('jobs').select('*').eq('id', jobId).single();
        setJob(jobData);
        // Garante que parameters não é nulo
        setParameters(jobData.parameters || { triagem: [], cultura: [], tecnico: [], notas: [] });

        // 2. Busca Candidatos
        const { data: appsData } = await supabase.from('applications').select('*, candidate:candidates(name, email)').eq('jobId', jobId);
        setApplicants(appsData || []);

        // 3. Busca Avaliações
        const appIds = (appsData || []).map(a => a.id);
        if (appIds.length > 0) {
            const { data: evalsData } = await supabase.from('evaluations').select('*, evaluator:users(email, name)').in('application_id', appIds);
            setAllEvaluations(evalsData || []);
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchAllData();
  }, [jobId]);

  // --- PROCESSAMENTO DE DADOS (CORRIGIDO PARA RECALCULAR TUDO) ---
  const processedData = useMemo(() => {
    if (!parameters) return { chartData: [], evaluators: [] };

    const evaluatorsList = Array.from(new Set(allEvaluations.map(e => e.evaluator_id)))
        .map(id => {
            const ev = allEvaluations.find(e => e.evaluator_id === id);
            return { id, name: ev.evaluator?.name || ev.evaluator_name || 'Desconhecido' };
        });

    const chartData = applicants.map(app => {
        // 1. Filtra as avaliações deste candidato
        const appEvals = allEvaluations.filter(e => 
            e.application_id === app.id && 
            (evaluatorFilter === 'all' || e.evaluator_id === evaluatorFilter)
        );

        if (appEvals.length === 0) {
            return { 
                appId: app.id, name: app.candidate?.name || 'Sem Nome', 
                triagem: 0, cultura: 0, tecnico: 0, total: 0, 
                count: 0, hired: app.isHired 
            };
        }

        // 2. Recalcula as médias baseadas nas avaliações filtradas
        let sumT = 0, sumC = 0, sumTc = 0, count = 0;
        
        appEvals.forEach(ev => {
            // AQUI ESTÁ O SEGREDO: Usamos a calculadora universal em cada item
            // Ela vai ler os 'scores' (brutos) e aplicar os 'parameters' (pesos)
            const calculated = processEvaluation(ev, parameters);
            
            sumT += calculated.triagem;
            sumC += calculated.cultura;
            sumTc += calculated.tecnico;
            count++;
        });

        // Médias (evita divisão por zero)
        const avgT = count > 0 ? sumT / count : 0;
        const avgC = count > 0 ? sumC / count : 0;
        const avgTc = count > 0 ? sumTc / count : 0;
        
        // Média Geral
        const general = (avgT + avgC + avgTc) / 3;

        return {
            appId: app.id,
            name: app.candidate?.name || 'Sem Nome',
            triagem: avgT, 
            cultura: avgC,
            tecnico: avgTc,
            total: general,
            count: count,
            hired: app.isHired
        };
    }).sort((a, b) => b.total - a.total); // Ordena decrescente pela nota

    return { chartData, evaluators: evaluatorsList };
  }, [applicants, allEvaluations, evaluatorFilter, parameters]);

  const handleHireToggle = async (appId, currentStatus) => {
      const newStatus = !currentStatus;
      setApplicants(prev => prev.map(a => a.id === appId ? {...a, isHired: newStatus} : a));
      await supabase.from('applications').update({ isHired: newStatus, hiredAt: newStatus ? new Date() : null }).eq('id', appId);
  };

  const handleSaveParameters = async () => {
      try {
          const { data: { session } } = await supabase.auth.getSession();
          await fetch('/api/updateJobParameters', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
              body: JSON.stringify({ jobId, parameters })
          });
          setFeedback({ open: true, message: 'Parâmetros salvos!', severity: 'success' });
      } catch (e) { setFeedback({ open: true, message: 'Erro ao salvar', severity: 'error' }); }
  };

  if (loading) return <Box p={5} display="flex" justifyContent="center"><CircularProgress /></Box>;

  return (
    <Box>
        <AppBar position="static"><Toolbar><Typography variant="h6" sx={{flexGrow:1}}>{job?.title}</Typography><Button color="inherit" component={RouterLink} to="/">Voltar</Button></Toolbar></AppBar>
        <Container maxWidth="xl" sx={{ mt: 4 }}>
            <Paper sx={{ mb: 2 }}><Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} centered><Tab label="Candidatos" /><Tab label="Classificação" /><Tab label="Configurações" /></Tabs></Paper>
            
            {/* ABA CANDIDATOS */}
            {tabValue === 0 && (
                <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>Lista de Inscritos</Typography>
                    <Table>
                        <TableHead><TableRow><TableCell>Nome</TableCell><TableCell>Email</TableCell><TableCell align="center">Avaliações</TableCell><TableCell align="center">Nota Geral</TableCell></TableRow></TableHead>
                        <TableBody>{processedData.chartData.map(d => (
                            <TableRow key={d.appId} hover component={RouterLink} to={`/applications/${d.appId}`} style={{textDecoration:'none', cursor:'pointer'}}>
                                <TableCell>{d.name}</TableCell>
                                <TableCell>{applicants.find(a => a.id === d.appId)?.candidate?.email}</TableCell>
                                <TableCell align="center">{d.count}</TableCell>
                                <TableCell align="center"><Chip label={d.total.toFixed(2)} color={d.total >= 8 ? 'success' : d.total >= 5 ? 'warning' : 'default'} /></TableCell>
                            </TableRow>
                        ))}</TableBody>
                    </Table>
                    {processedData.chartData.length === 0 && <Box p={3} textAlign="center">Nenhum candidato encontrado.</Box>}
                </Paper>
            )}

            {/* ABA CLASSIFICAÇÃO */}
            {tabValue === 1 && (
                <Grid container spacing={3} sx={{ mt: 1 }}>
                    <Grid item xs={12} md={8}>
                        <Paper sx={{ p: 3 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                <Typography variant="h6">Comparativo (Média 0-10)</Typography>
                                <FormControl size="small" sx={{ width: 200 }}>
                                    <InputLabel>Visão</InputLabel>
                                    <Select value={evaluatorFilter} label="Visão" onChange={(e) => setEvaluatorFilter(e.target.value)}>
                                        <MenuItem value="all">Geral (Média Equipe)</MenuItem>
                                        {processedData.evaluators.map(ev => <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            </Box>
                            {processedData.chartData.length > 0 ? (
                                <Box sx={{ height: 400 }}>
                                    <ResponsiveContainer>
                                        <BarChart data={processedData.chartData} layout="vertical" margin={{ left: 50 }}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis type="number" domain={[0, 10]} />
                                            <YAxis dataKey="name" type="category" width={100} style={{fontSize: '0.8rem'}} />
                                            <Tooltip formatter={(val) => Number(val).toFixed(2)} />
                                            <Legend />
                                            <Bar dataKey="triagem" name="Triagem" fill="#90caf9" />
                                            <Bar dataKey="cultura" name="Cultura" fill="#a5d6a7" />
                                            <Bar dataKey="tecnico" name="Técnico" fill="#ffcc80" />
                                            <ReferenceLine x={5} stroke="red" strokeDasharray="3 3" label="Média 5" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </Box>
                            ) : (
                                <Box height={400} display="flex" alignItems="center" justifyContent="center">
                                    <Typography color="text.secondary">Sem dados para exibir.</Typography>
                                </Box>
                            )}
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Paper sx={{ height: '100%', overflow: 'hidden' }}>
                            <Box sx={{ p: 2, bgcolor: '#f5f5f5' }}><Typography variant="subtitle1">Ranking</Typography></Box>
                            <List sx={{ overflowY: 'auto', maxHeight: '80vh' }}>
                                {processedData.chartData.map((d) => (
                                    <React.Fragment key={d.appId}>
                                        <ListItem secondaryAction={<Checkbox checked={d.hired || false} onChange={() => handleHireToggle(d.appId, d.hired)} color="success" />}>
                                            <ListItemText 
                                                primary={<Typography variant="body2" fontWeight="bold">{d.name}</Typography>}
                                                secondary={<Typography variant="caption">Geral: {d.total.toFixed(2)} (T:{d.triagem.toFixed(1)} C:{d.cultura.toFixed(1)} Tc:{d.tecnico.toFixed(1)})</Typography>}
                                            />
                                        </ListItem>
                                        <Divider />
                                    </React.Fragment>
                                ))}
                            </List>
                        </Paper>
                    </Grid>
                </Grid>
            )}

            {/* ABA CONFIGURAÇÕES */}
            {tabValue === 2 && (
                <Box p={3}>
                    <Box display="flex" justifyContent="space-between" mb={2}>
                        <Typography variant="h6">Parâmetros</Typography>
                        <Button variant="outlined" startIcon={<ContentCopyIcon/>} onClick={() => setIsCopyModalOpen(true)}>Copiar</Button>
                    </Box>
                    <Paper variant="outlined" sx={{p:2, mb:2}}><Typography>Triagem</Typography><ParametersSection criteria={parameters?.triagem || []} onCriteriaChange={(c) => setParameters({...parameters, triagem: c})} /></Paper>
                    <Paper variant="outlined" sx={{p:2, mb:2}}><Typography>Cultura</Typography><ParametersSection criteria={parameters?.cultura || []} onCriteriaChange={(c) => setParameters({...parameters, cultura: c})} /></Paper>
                    <Paper variant="outlined" sx={{p:2, mb:2}}><Typography>Técnico</Typography><ParametersSection criteria={parameters?.tecnico || parameters?.['tÃ©cnico'] || parameters?.['técnico'] || []} onCriteriaChange={(c) => setParameters({...parameters, tecnico: c})} /></Paper>
                    <Paper variant="outlined" sx={{p:2}}><Typography>Notas</Typography><Grid container spacing={2} sx={{mt:1}}>{parameters?.notas?.map((n, i) => <Grid item xs={6} key={i}><TextField label={n.nome} value={n.valor} onChange={(e) => { const newN = [...parameters.notas]; newN[i].valor = e.target.value; setParameters({...parameters, notas: newN}) }} size="small" /></Grid>)}</Grid></Paper>
                    <Button variant="contained" sx={{mt:2}} onClick={handleSaveParameters}>Salvar Parâmetros</Button>
                </Box>
            )}
        </Container>
        <CopyParametersModal open={isCopyModalOpen} onClose={() => setIsCopyModalOpen(false)} currentJobId={jobId} onCopy={(p) => { setParameters(p); setFeedback({open:true, message:'Copiado!', severity:'info'}); }} />
        <Snackbar open={feedback.open} autoHideDuration={4000} onClose={() => setFeedback({...feedback, open:false})}><Alert severity={feedback.severity}>{feedback.message}</Alert></Snackbar>
    </Box>
  );
};

export default JobDetails;