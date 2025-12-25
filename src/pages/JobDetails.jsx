import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { format, parseISO } from 'date-fns';
import { 
    Container, Typography, Box, AppBar, Toolbar, Button, CircularProgress, 
    Alert, Paper, Tabs, Tab, TextField, IconButton, Snackbar, InputAdornment,
    List, ListItem, ListItemText, Divider, Grid,
    Table, TableHead, TableRow, TableCell, TableBody, Checkbox,
    FormControl, InputLabel, Select, MenuItem, Avatar, Chip, Modal
} from '@mui/material';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { Delete as DeleteIcon, ContentCopy as ContentCopyIcon, FileCopy as FileCopyIcon } from '@mui/icons-material';
import { formatStatus } from '../utils/formatters';

const modalStyle = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 500, bgcolor: 'background.paper', boxShadow: 24, p: 4 };

// (MODAL DE CÓPIA MANTIDO)
const CopyParametersModal = ({ open, onClose, currentJobId, onCopy }) => {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [loading, setLoading] = useState(true);
  const [isCopying, setIsCopying] = useState(false);

  useEffect(() => {
    if (open) {
      const fetchJobsList = async () => {
        setLoading(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const response = await fetch('/api/jobs', { headers: { 'Authorization': `Bearer ${session.access_token}` } });
          const data = await response.json();
          const copyableJobs = (data.jobs || []).filter(j => j.id.toString() !== currentJobId && j.status === 'active');
          setJobs(copyableJobs);
        } catch (err) { console.error(err); } finally { setLoading(false); }
      };
      fetchJobsList();
    }
  }, [open, currentJobId]);

  const handleConfirmCopy = async () => {
    if (!selectedJobId) return;
    setIsCopying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/jobs?id=${selectedJobId}`, { headers: { 'Authorization': `Bearer ${session.access_token}` } });
      const data = await response.json();
      if (data.job && data.job.parameters) onCopy(data.job.parameters);
      onClose();
    } catch (err) { console.error(err); } finally { setIsCopying(false); }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={modalStyle}>
        <Typography variant="h6" gutterBottom>Copiar Parâmetros</Typography>
        {loading ? <CircularProgress /> : (
          <FormControl fullWidth margin="normal">
            <InputLabel>Selecionar Vaga</InputLabel>
            <Select value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)} label="Selecionar Vaga">
              {jobs.map(job => <MenuItem key={job.id} value={job.id}>{job.title}</MenuItem>)}
            </Select>
          </FormControl>
        )}
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="contained" onClick={handleConfirmCopy} disabled={isCopying || !selectedJobId}>Copiar</Button>
        </Box>
      </Box>
    </Modal>
  );
};

// (SEÇÃO DE PARÂMETROS MANTIDA)
const ParametersSection = ({ criteria = [], onCriteriaChange }) => {
  const handleItemChange = (index, field, value) => { const newCriteria = [...criteria]; newCriteria[index] = { ...newCriteria[index], [field]: field === 'weight' ? Number(value) : value }; onCriteriaChange(newCriteria); };
  const addCriterion = () => { if (criteria.length < 10) onCriteriaChange([...criteria, { name: '', weight: 0 }]); };
  const removeCriterion = (index) => { onCriteriaChange(criteria.filter((_, i) => i !== index)); };
  const totalWeight = criteria.reduce((sum, item) => sum + (item.weight || 0), 0);
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
      <Typography variant="caption" sx={{ display:'block', mt: 1, color: totalWeight === 100 ? 'green' : 'red' }}>Total Pesos: {totalWeight}%</Typography>
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

  // PROCESSAMENTO DO GRÁFICO
  const processedClassificationData = useMemo(() => {
    const evaluatorsList = Array.from(new Set(allEvaluations.map(e => e.evaluator_id)))
        .map(id => {
            const ev = allEvaluations.find(e => e.evaluator_id === id);
            return { id, name: ev.evaluator?.name || ev.evaluator_name || 'Desconhecido' };
        });

    const chartData = applicants.map(app => {
        const appEvaluations = allEvaluations.filter(e => 
            e.application_id === app.id && 
            (evaluatorFilter === 'all' || e.evaluator_id === evaluatorFilter)
        );

        if (appEvaluations.length === 0) {
            return { name: app.candidate.name, triagem: 0, cultura: 0, tecnico: 0, total: 0, count: 0, appId: app.id };
        }

        let sumTriagem = 0, sumCultura = 0, sumTecnico = 0, count = 0;
        appEvaluations.forEach(ev => {
            const p = ev.scores.pillar_scores || {};
            sumTriagem += Number(p.triagem || 0);
            sumCultura += Number(p.cultura || 0);
            sumTecnico += Number(p.tecnico || 0);
            count++;
        });

        const avgTriagem = count > 0 ? sumTriagem / count : 0;
        const avgCultura = count > 0 ? sumCultura / count : 0;
        const avgTecnico = count > 0 ? sumTecnico / count : 0;
        const generalAvg = (avgTriagem + avgCultura + avgTecnico) / 3;

        return {
            appId: app.id,
            name: app.candidate.name,
            triagem: avgTriagem, 
            cultura: avgCultura,
            tecnico: avgTecnico,
            total: generalAvg,
            count: count,
            hired: app.isHired,
            created_at: app.created_at
        };
    }).sort((a, b) => b.total - a.total);

    return { chartData, evaluatorsList };
  }, [applicants, allEvaluations, evaluatorFilter]);

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

  const renderClassificationTab = () => {
      const { chartData, evaluatorsList } = processedClassificationData;
      return (
        <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={8}>
                <Paper sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h6">Comparativo (Média 0-10)</Typography>
                        <FormControl size="small" sx={{ width: 200 }}>
                            <InputLabel>Visão</InputLabel>
                            <Select value={evaluatorFilter} label="Visão" onChange={(e) => setEvaluatorFilter(e.target.value)}>
                                <MenuItem value="all">Geral (Média Equipe)</MenuItem>
                                {evaluatorsList.map(ev => <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Box>
                    <Box sx={{ height: 400 }}>
                        <ResponsiveContainer>
                            <BarChart data={chartData} layout="vertical" margin={{ left: 50 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" domain={[0, 10]} />
                                <YAxis dataKey="name" type="category" width={100} style={{fontSize: '0.8rem'}} />
                                <Tooltip formatter={(val) => val.toFixed(2)} />
                                <Legend />
                                {/* Aqui exibimos as barras lado a lado ou empilhadas se preferir. 
                                    Como são médias de 0-10, faz sentido lado a lado ou empilhado se normalizado. 
                                    Vou colocar empilhado mas usando os valores divididos por 3 para que o total visual seja a média final 0-10 */}
                                <Bar dataKey="triagem" stackId="a" name="Triagem" fill="#90caf9" />
                                <Bar dataKey="cultura" stackId="a" name="Cultura" fill="#a5d6a7" />
                                <Bar dataKey="tecnico" stackId="a" name="Técnico" fill="#ffcc80" />
                                <ReferenceLine x={5} stroke="red" strokeDasharray="3 3" label="Média 5" />
                            </BarChart>
                        </ResponsiveContainer>
                    </Box>
                </Paper>
                <Paper sx={{ mt: 3, p: 3 }}>
                    <Typography variant="h6">Histórico de Avaliações</Typography>
                    <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                        {allEvaluations.map((ev, idx) => {
                            const app = applicants.find(a => a.id === ev.application_id);
                            return (
                                <ListItem key={idx} divider>
                                    <ListItemText 
                                        primary={`Candidato: ${app?.candidate?.name} - Nota: ${Number(ev.final_score).toFixed(2)}`}
                                        secondary={`Avaliador: ${ev.evaluator_name || '...'} | ${ev.notes || ''}`}
                                    />
                                </ListItem>
                            );
                        })}
                    </List>
                </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
                <Paper sx={{ height: '100%', overflow: 'hidden' }}>
                    <Box sx={{ p: 2, bgcolor: '#f5f5f5' }}><Typography variant="subtitle1">Ranking</Typography></Box>
                    <List sx={{ overflowY: 'auto', maxHeight: '80vh' }}>
                        {chartData.map((data) => (
                            <React.Fragment key={data.appId}>
                                <ListItem secondaryAction={<Checkbox checked={data.hired || false} onChange={() => handleHireToggle(data.appId, data.hired)} color="success" />}>
                                    <ListItemText 
                                        primary={<Typography variant="body2" component={RouterLink} to={`/vaga/${jobId}/candidato/${data.appId}`} sx={{textDecoration:'none', color:'inherit', fontWeight:'bold'}}>{data.name}</Typography>}
                                        secondary={
                                            <>
                                                <Typography variant="caption" display="block">Geral: {data.total.toFixed(2)}</Typography>
                                                <Box sx={{display:'flex', gap:0.5}}><Chip label={`T:${data.triagem.toFixed(1)}`} size="small" sx={{height:20, fontSize:'0.6rem'}}/><Chip label={`C:${data.cultura.toFixed(1)}`} size="small" sx={{height:20, fontSize:'0.6rem'}}/><Chip label={`Tc:${data.tecnico.toFixed(1)}`} size="small" sx={{height:20, fontSize:'0.6rem'}}/></Box>
                                            </>
                                        }
                                    />
                                </ListItem>
                                <Divider />
                            </React.Fragment>
                        ))}
                    </List>
                </Paper>
            </Grid>
        </Grid>
      );
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
                        <TableBody>{applicants.map(app => {
                            const count = allEvaluations.filter(e => e.application_id === app.id).length;
                            return (
                                <TableRow key={app.id} hover component={RouterLink} to={`/vaga/${jobId}/candidato/${app.id}`} style={{textDecoration:'none'}}>
                                    <TableCell>{app.candidate.name}</TableCell>
                                    <TableCell>{app.candidate.email}</TableCell>
                                    <TableCell align="center">{count}</TableCell>
                                    <TableCell align="center"><Chip label={app.score_general ? Number(app.score_general).toFixed(2) : '-'} color={app.score_general >= 8 ? 'success' : 'default'} /></TableCell>
                                </TableRow>
                            );
                        })}</TableBody>
                    </Table>
                </Paper>
            )}

            {tabValue === 1 && renderClassificationTab()}

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