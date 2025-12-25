import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { 
    Container, Typography, Box, AppBar, Toolbar, Button, CircularProgress, 
    Paper, Tabs, Tab, TextField, IconButton, Snackbar,
    List, ListItem, ListItemText, Divider, Grid,
    Table, TableHead, TableRow, TableCell, TableBody, Checkbox,
    FormControl, InputLabel, Select, MenuItem, Chip, Modal, Alert
} from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, LabelList } from 'recharts';
import { Delete as DeleteIcon, ContentCopy as ContentCopyIcon } from '@mui/icons-material';
import { processEvaluation } from '../utils/evaluationLogic';

// --- MODAL DE CÓPIA ---
const modalStyle = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 500, bgcolor: 'background.paper', boxShadow: 24, p: 4 };
const CopyParametersModal = ({ open, onClose, currentJobId, onCopy }) => {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  useEffect(() => { if (open) { const f = async () => { const { data } = await supabase.from('jobs').select('id, title').neq('id', currentJobId).eq('status', 'active'); setJobs(data || []); }; f(); } }, [open, currentJobId]);
  const handleConfirm = async () => { if (!selectedJobId) return; const { data } = await supabase.from('jobs').select('parameters').eq('id', selectedJobId).single(); if (data?.parameters) onCopy(data.parameters); onClose(); };
  return ( <Modal open={open} onClose={onClose}><Box sx={modalStyle}><Typography variant="h6">Copiar de Vaga</Typography><FormControl fullWidth margin="normal"><InputLabel>Vaga</InputLabel><Select value={selectedJobId} onChange={e=>setSelectedJobId(e.target.value)} label="Vaga">{jobs.map(j=><MenuItem key={j.id} value={j.id}>{j.title}</MenuItem>)}</Select></FormControl><Button onClick={handleConfirm} variant="contained" fullWidth sx={{mt:2}} disabled={!selectedJobId}>Copiar</Button></Box></Modal> );
};

// --- SEÇÃO DE PARÂMETROS ---
const ParametersSection = ({ criteria = [], onCriteriaChange }) => {
  const handleChange = (i, f, v) => { const n = [...criteria]; n[i] = { ...n[i], [f]: f==='weight'?Number(v):v }; onCriteriaChange(n); };
  const total = criteria.reduce((acc, c) => acc + (Number(c.weight)||0), 0);
  return (
    <Box sx={{mt:2}}>{criteria.map((c, i) => <Box key={i} display="flex" gap={2} mb={1}><TextField value={c.name} onChange={e=>handleChange(i,'name',e.target.value)} fullWidth size="small" label="Critério" /><TextField type="number" value={c.weight} onChange={e=>handleChange(i,'weight',e.target.value)} sx={{width:100}} size="small" label="Peso %" /><IconButton onClick={()=>onCriteriaChange(criteria.filter((_,idx)=>idx!==i))} color="error"><DeleteIcon/></IconButton></Box>)}<Button onClick={()=>onCriteriaChange([...criteria, {name:'', weight:0}])} variant="outlined" size="small">Adicionar</Button><Typography color={total===100?'green':'red'} variant="caption" display="block" sx={{mt:1, fontWeight:'bold'}}>Total: {total}%</Typography></Box>
  );
};

// --- PÁGINA PRINCIPAL ---
export default function JobDetails() {
  const { jobId } = useParams();
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
        const { data: jobData } = await supabase.from('jobs').select('*').eq('id', jobId).single();
        setJob(jobData);
        const params = jobData.parameters || { triagem: [], cultura: [], tecnico: [], notas: [] };
        setParameters(params);

        const { data: appsData } = await supabase.from('applications').select('*, candidate:candidates(name, email)').eq('jobId', jobId);
        setApplicants(appsData || []);

        const appIds = (appsData || []).map(a => a.id);
        if (appIds.length > 0) {
            // Busca segura sem Join
            const { data: evalsData } = await supabase.from('evaluations').select('*').in('application_id', appIds);
            setAllEvaluations(evalsData || []);
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchAllData();
  }, [jobId]);

  const processedData = useMemo(() => {
    if (!parameters) return { chartData: [], evaluators: [] };

    // Lista de avaliadores
    const evaluators = Array.from(new Set(allEvaluations.map(e => e.evaluator_id))).map(id => {
        return { id, name: 'Avaliador' }; // Simplificado para garantir funcionamento
    });

    const chartData = applicants.map(app => {
        const appEvals = allEvaluations.filter(e => 
            String(e.application_id) === String(app.id) && 
            (evaluatorFilter === 'all' || e.evaluator_id === evaluatorFilter)
        );

        let sumT = 0, sumC = 0, sumTc = 0, count = 0, sumTotal = 0;
        appEvals.forEach(ev => {
            const scores = processEvaluation(ev, parameters);
            if (scores.total > 0) {
                sumT += scores.triagem; sumC += scores.cultura; sumTc += scores.tecnico; sumTotal += scores.total; count++;
            }
        });

        const avgT = count > 0 ? sumT / count : 0;
        const avgC = count > 0 ? sumC / count : 0;
        const avgTc = count > 0 ? sumTc / count : 0;
        const general = count > 0 ? sumTotal / count : 0;

        return {
            appId: app.id,
            name: app.candidate?.name || 'Sem Nome',
            email: app.candidate?.email,
            // Valores REAIS para labels
            triagem: Number(avgT.toFixed(1)),
            cultura: Number(avgC.toFixed(1)),
            tecnico: Number(avgTc.toFixed(1)),
            total: Number(general.toFixed(1)),
            // Valores para o Gráfico (Divididos por 3 para que a pilha totalize a média)
            graphT: avgT / 3,
            graphC: avgC / 3,
            graphTc: avgTc / 3,
            count: count,
            hired: app.isHired
        };
    }).sort((a, b) => b.total - a.total);

    return { chartData, evaluators };
  }, [applicants, allEvaluations, evaluatorFilter, parameters]);

  const handleHireToggle = async (appId, currentStatus) => {
      const newStatus = !currentStatus;
      setApplicants(prev => prev.map(a => a.id === appId ? {...a, isHired: newStatus} : a));
      await supabase.from('applications').update({ isHired: newStatus }).eq('id', appId);
  };
  const handleSaveParameters = async () => {
      await supabase.from('jobs').update({ parameters }).eq('id', jobId);
      setFeedback({ open: true, message: 'Salvo!', severity: 'success' });
  };

  if (loading) return <Box p={5} display="flex" justifyContent="center"><CircularProgress /></Box>;

  return (
    <Box>
        <AppBar position="static"><Toolbar><Typography variant="h6" sx={{flexGrow:1}}>{job?.title}</Typography><Button color="inherit" component={RouterLink} to="/">Voltar</Button></Toolbar></AppBar>
        <Container maxWidth="xl" sx={{ mt: 4 }}>
            <Paper sx={{ mb: 2 }}><Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} centered><Tab label="Candidatos" /><Tab label="Classificação" /><Tab label="Configurações" /></Tabs></Paper>
            
            {tabValue === 0 && (
                <Paper sx={{ p: 2 }}>
                    <Table>
                        <TableHead><TableRow><TableCell>Nome</TableCell><TableCell>Email</TableCell><TableCell align="center">Avaliações</TableCell><TableCell align="center">Nota Geral</TableCell></TableRow></TableHead>
                        <TableBody>{processedData.chartData.map(d => (
                            <TableRow key={d.appId} hover component={RouterLink} to={`/applications/${d.appId}`} style={{textDecoration:'none', cursor:'pointer'}}>
                                <TableCell>{d.name}</TableCell>
                                <TableCell>{d.email}</TableCell>
                                <TableCell align="center">{d.count}</TableCell>
                                <TableCell align="center"><Chip label={d.total.toFixed(1)} color={d.total >= 8 ? 'success' : d.total >= 5 ? 'warning' : 'default'} /></TableCell>
                            </TableRow>
                        ))}</TableBody>
                    </Table>
                </Paper>
            )}

            {tabValue === 1 && (
                <Grid container spacing={3} sx={{ mt: 1 }}>
                    <Grid item xs={12} md={8}>
                        <Paper sx={{ p: 3 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                <Typography variant="h6">Comparativo (Média 0-10)</Typography>
                                <FormControl size="small" sx={{ width: 200 }}>
                                    <InputLabel>Visão</InputLabel>
                                    <Select value={evaluatorFilter} label="Visão" onChange={(e) => setEvaluatorFilter(e.target.value)}>
                                        <MenuItem value="all">Geral (Média)</MenuItem>
                                        {processedData.evaluators.map(ev => <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            </Box>
                            {processedData.chartData.some(d => d.total > 0) ? (
                                <Box sx={{ height: 400 }}>
                                    <ResponsiveContainer>
                                        {/* GRÁFICO EMPILHADO */}
                                        <BarChart data={processedData.chartData} layout="vertical" margin={{ left: 50, right: 30 }}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis type="number" domain={[0, 10]} />
                                            <YAxis dataKey="name" type="category" width={100} style={{fontSize: '0.8rem'}} />
                                            <Tooltip formatter={(val, name, props) => {
                                                // Tooltip mostra valor REAL
                                                if (name === "Triagem") return [props.payload.triagem, name];
                                                if (name === "Cultura") return [props.payload.cultura, name];
                                                if (name === "Técnico") return [props.payload.tecnico, name];
                                                return [val, name];
                                            }} />
                                            <Legend />
                                            {/* StackId "a" empilha todas as barras */}
                                            {/* Usamos graphT/graphC/graphTc para a altura (escala) */}
                                            {/* Usamos triagem/cultura/tecnico para o Rótulo (número) */}
                                            <Bar dataKey="graphT" name="Triagem" stackId="a" fill="#90caf9">
                                                <LabelList dataKey="triagem" position="center" style={{fill:'#000', fontSize:'0.7rem', fontWeight:'bold'}} formatter={(v) => v > 0 ? v : ''} />
                                            </Bar>
                                            <Bar dataKey="graphC" name="Cultura" stackId="a" fill="#a5d6a7">
                                                <LabelList dataKey="cultura" position="center" style={{fill:'#000', fontSize:'0.7rem', fontWeight:'bold'}} formatter={(v) => v > 0 ? v : ''} />
                                            </Bar>
                                            <Bar dataKey="graphTc" name="Técnico" stackId="a" fill="#ffcc80">
                                                <LabelList dataKey="tecnico" position="center" style={{fill:'#000', fontSize:'0.7rem', fontWeight:'bold'}} formatter={(v) => v > 0 ? v : ''} />
                                                {/* Mostra a MÉDIA FINAL na ponta da barra */}
                                                <LabelList dataKey="total" position="right" style={{fill:'#000', fontWeight:'bold'}} />
                                            </Bar>
                                            <ReferenceLine x={5} stroke="red" strokeDasharray="3 3" label="Média 5" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </Box>
                            ) : <Box height={300} display="flex" alignItems="center" justifyContent="center" color="text.secondary">Sem dados de avaliação.</Box>}
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Paper sx={{ height: '100%', overflow: 'hidden' }}>
                            <Box sx={{ p: 2, bgcolor: '#f5f5f5' }}><Typography variant="subtitle1">Ranking</Typography></Box>
                            <List sx={{ overflowY: 'auto', maxHeight: '80vh' }}>
                                {processedData.chartData.map((d) => (
                                    <React.Fragment key={d.appId}>
                                        <ListItem secondaryAction={<Checkbox checked={d.hired || false} onChange={() => handleHireToggle(d.appId, d.hired)} color="success" />}>
                                            <ListItemText primary={<Typography variant="body2" fontWeight="bold">{d.name}</Typography>} secondary={<Typography variant="caption">Geral: {d.total.toFixed(1)}</Typography>} />
                                        </ListItem>
                                        <Divider />
                                    </React.Fragment>
                                ))}
                            </List>
                        </Paper>
                    </Grid>
                </Grid>
            )}

            {tabValue === 2 && (
                <Box p={3}>
                    <Paper variant="outlined" sx={{p:2, mb:2}}><Typography>Triagem</Typography><ParametersSection criteria={parameters?.triagem || []} onCriteriaChange={(c) => setParameters({...parameters, triagem: c})} /></Paper>
                    <Paper variant="outlined" sx={{p:2, mb:2}}><Typography>Cultura</Typography><ParametersSection criteria={parameters?.cultura || []} onCriteriaChange={(c) => setParameters({...parameters, cultura: c})} /></Paper>
                    <Paper variant="outlined" sx={{p:2, mb:2}}><Typography>Técnico</Typography><ParametersSection criteria={parameters?.tecnico || parameters?.['técnico'] || []} onCriteriaChange={(c) => setParameters({...parameters, tecnico: c})} /></Paper>
                    <Button variant="contained" sx={{mt:2}} onClick={handleSaveParameters}>Salvar Parâmetros</Button>
                </Box>
            )}
        </Container>
        <CopyParametersModal open={isCopyModalOpen} onClose={() => setIsCopyModalOpen(false)} currentJobId={jobId} onCopy={(p) => { setParameters(p); setFeedback({open:true, message:'Copiado!', severity:'info'}); }} />
        <Snackbar open={feedback.open} autoHideDuration={4000} onClose={() => setFeedback({...feedback, open:false})}><Alert severity={feedback.severity}>{feedback.message}</Alert></Snackbar>
    </Box>
  );
}