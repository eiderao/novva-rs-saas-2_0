import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { 
    Container, Typography, Box, AppBar, Toolbar, Button, CircularProgress, 
    Alert, Paper, Tabs, Tab, TextField, IconButton, Snackbar,
    List, ListItem, ListItemText, Divider, Grid,
    Table, TableHead, TableRow, TableCell, TableBody, Checkbox,
    FormControl, InputLabel, Select, MenuItem, Chip, Modal
} from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Delete as DeleteIcon, ContentCopy as ContentCopyIcon } from '@mui/icons-material';
import { formatStatus } from '../utils/formatters'; // ARQUIVO DEVE EXISTIR
import { processEvaluation } from '../utils/evaluationLogic'; // ARQUIVO DEVE EXISTIR

// ... (CopyParametersModal e modalStyle mantidos iguais aos anteriores)
// Vou omiti-los aqui para economizar espaço, mas MANTENHA-OS no arquivo final.
const modalStyle = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 500, bgcolor: 'background.paper', boxShadow: 24, p: 4 };
const CopyParametersModal = ({ open, onClose, currentJobId, onCopy }) => { /* ... código do modal ... */ return null; };

// SEÇÃO DE PARÂMETROS COM CORREÇÃO DE SOMA
const ParametersSection = ({ criteria = [], onCriteriaChange }) => {
  const handleItemChange = (index, field, value) => { 
      const newCriteria = [...criteria]; 
      // Garante número
      newCriteria[index] = { ...newCriteria[index], [field]: field === 'weight' ? Number(value) : value }; 
      onCriteriaChange(newCriteria); 
  };
  const addCriterion = () => { if (criteria.length < 10) onCriteriaChange([...criteria, { name: '', weight: 0 }]); };
  const removeCriterion = (index) => { onCriteriaChange(criteria.filter((_, i) => i !== index)); };
  
  // Soma numérica
  const totalWeight = criteria.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);

  return (
    <Box sx={{ mt: 2 }}>
      {criteria.map((item, index) => (
        <Box key={index} sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField label={`Critério ${index + 1}`} value={item.name} onChange={(e) => handleItemChange(index, 'name', e.target.value)} fullWidth variant="standard" />
          <TextField label="Peso (%)" type="number" value={item.weight} onChange={(e) => handleItemChange(index, 'weight', e.target.value)} sx={{ width: '100px' }} variant="standard" />
          <IconButton onClick={() => removeCriterion(index)} color="error"><DeleteIcon /></IconButton>
        </Box>
      ))}
      <Button onClick={addCriterion} disabled={criteria.length >= 10}>Adicionar Critério</Button>
      <Typography variant="caption" sx={{ display:'block', mt: 1, fontWeight: 'bold', color: totalWeight === 100 ? 'green' : 'red' }}>
          Total Pesos: {totalWeight}%
      </Typography>
    </Box>
  );
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

        const { data: jobData } = await supabase.from('jobs').select('*').eq('id', jobId).single();
        setJob(jobData);
        setParameters(jobData.parameters || {});

        const { data: appsData } = await supabase.from('applications').select('*, candidate:candidates(name, email)').eq('jobId', jobId);
        setApplicants(appsData || []);

        const appIds = (appsData || []).map(a => a.id);
        if (appIds.length > 0) {
            const { data: evalsData } = await supabase.from('evaluations').select('*, evaluator:users(email, name)').in('application_id', appIds);
            setAllEvaluations(evalsData || []);
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchAllData();
  }, [jobId]);

  // PROCESSAMENTO DO GRÁFICO E LISTA
  const processedData = useMemo(() => {
    const evaluators = Array.from(new Set(allEvaluations.map(e => e.evaluator_id)))
        .map(id => {
            const ev = allEvaluations.find(e => e.evaluator_id === id);
            return { id, name: ev.evaluator?.name || ev.evaluator_name || 'Desconhecido' };
        });

    const data = applicants.map(app => {
        const appEvals = allEvaluations.filter(e => e.application_id === app.id && (evaluatorFilter === 'all' || e.evaluator_id === evaluatorFilter));
        
        let sumT = 0, sumC = 0, sumTc = 0, count = 0;
        appEvals.forEach(ev => {
            const scores = processEvaluation(ev, parameters);
            sumT += scores.triagem; sumC += scores.cultura; sumTc += scores.tecnico;
            count++;
        });

        const avgT = count > 0 ? sumT / count : 0;
        const avgC = count > 0 ? sumC / count : 0;
        const avgTc = count > 0 ? sumTc / count : 0;
        const general = (avgT + avgC + avgTc) / 3;

        return {
            appId: app.id,
            name: app.candidate?.name || 'Candidato',
            triagem: avgT, cultura: avgC, tecnico: avgTc, total: general,
            count: count,
            hired: app.isHired
        };
    }).sort((a, b) => b.total - a.total);

    return { chartData: data, evaluators };
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
            
            {tabValue === 0 && (
                <Paper sx={{ p: 2 }}>
                    <Typography variant="h6">Inscritos</Typography>
                    <Table>
                        <TableHead><TableRow><TableCell>Nome</TableCell><TableCell>Email</TableCell><TableCell align="center">Avaliações</TableCell><TableCell align="center">Nota Geral</TableCell></TableRow></TableHead>
                        <TableBody>{processedData.chartData.map(d => (
                            <TableRow key={d.appId} hover component={RouterLink} to={`/vaga/${jobId}/candidato/${d.appId}`} style={{textDecoration:'none'}}>
                                <TableCell>{d.name}</TableCell>
                                <TableCell>{applicants.find(a => a.id === d.appId)?.candidate?.email}</TableCell>
                                <TableCell align="center">{d.count}</TableCell>
                                <TableCell align="center"><Chip label={d.total.toFixed(2)} color={d.total >= 8 ? 'success' : 'default'} /></TableCell>
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
                                        <MenuItem value="all">Geral (Média Equipe)</MenuItem>
                                        {processedData.evaluators.map(ev => <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            </Box>
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
                                                secondary={<Typography variant="caption">Geral: {d.total.toFixed(2)}</Typography>}
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

            {tabValue === 2 && (
                <Box p={3}>
                    <Paper variant="outlined" sx={{p:2, mb:2}}><Typography>Triagem</Typography><ParametersSection criteria={parameters?.triagem || []} onCriteriaChange={(c) => setParameters({...parameters, triagem: c})} /></Paper>
                    <Paper variant="outlined" sx={{p:2, mb:2}}><Typography>Cultura</Typography><ParametersSection criteria={parameters?.cultura || []} onCriteriaChange={(c) => setParameters({...parameters, cultura: c})} /></Paper>
                    <Paper variant="outlined" sx={{p:2, mb:2}}><Typography>Técnico</Typography><ParametersSection criteria={parameters?.tecnico || parameters?.['técnico'] || []} onCriteriaChange={(c) => setParameters({...parameters, tecnico: c})} /></Paper>
                    <Button variant="contained" sx={{mt:2}} onClick={handleSaveParameters}>Salvar Parâmetros</Button>
                </Box>
            )}
        </Container>
        <Snackbar open={feedback.open} autoHideDuration={4000} onClose={() => setFeedback({...feedback, open:false})}><Alert severity={feedback.severity}>{feedback.message}</Alert></Snackbar>
    </Box>
  );
};

export default JobDetails;