import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { 
    Container, Typography, Box, AppBar, Toolbar, Button, CircularProgress, 
    Paper, Tabs, Tab, TextField, IconButton, Snackbar,
    List, ListItem, ListItemText, Divider, Grid,
    Table, TableHead, TableRow, TableCell, TableBody, Checkbox,
    FormControl, InputLabel, Select, MenuItem, Chip, Modal, Alert, Tooltip as MuiTooltip
} from '@mui/material';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, LabelList 
} from 'recharts';
import { Delete as DeleteIcon, Add as AddIcon, Info as InfoIcon } from '@mui/icons-material';
import { processEvaluation } from '../utils/evaluationLogic';

// --- COMPONENTES AUXILIARES ---
const modalStyle = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 500, bgcolor: 'background.paper', boxShadow: 24, p: 4, borderRadius: 2 };

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

const ParametersSection = ({ title, criteria = [], onCriteriaChange }) => {
  const handleChange = (i, f, v) => { 
      const n = [...criteria];
      n[i] = { ...n[i], [f]: f==='weight'?Number(v):v }; 
      onCriteriaChange(n); 
  };
  
  const total = criteria.reduce((acc, c) => acc + (Number(c.weight)||0), 0);

  return (
    <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="subtitle1" fontWeight="bold">{title}</Typography>
            <Typography variant="caption" color={total === 100 ? 'success.main' : 'error.main'} fontWeight="bold">
                Total Pesos: {total}% {total !== 100 && '(Deve ser 100%)'}
            </Typography>
        </Box>
        
        {criteria.map((c, i) => (
            <Box key={i} display="flex" gap={2} mb={1} alignItems="center">
                <TextField 
                    value={c.name} 
                    onChange={e=>handleChange(i,'name',e.target.value)} 
                    fullWidth 
                    size="small" 
                    label="Critério" 
                    placeholder="Ex: Comunicação Clara"
                />
                <TextField 
                    type="number" 
                    value={c.weight} 
                    onChange={e=>handleChange(i,'weight',e.target.value)} 
                    sx={{width: 120}} 
                    size="small" 
                    label="Peso %" 
                />
                <IconButton onClick={()=>onCriteriaChange(criteria.filter((_,idx)=>idx!==i))} color="error" size="small">
                    <DeleteIcon/>
                </IconButton>
            </Box>
        ))}
        <Button startIcon={<AddIcon/>} onClick={()=>onCriteriaChange([...criteria, {name:'', weight:0}])} variant="outlined" size="small" sx={{mt: 1}}>
            Adicionar Critério
        </Button>
    </Paper>
  );
};

// --- COMPONENTE RESTAURADO: RÉGUA DE NOTAS ---
const GradeScaleSection = ({ notas = [], onNotasChange }) => {
    const handleChange = (i, f, v) => {
        const n = [...notas];
        n[i] = { ...n[i], [f]: f === 'valor' ? Number(v) : v };
        onNotasChange(n);
    };

    const handleAdd = () => {
        onNotasChange([...notas, { id: crypto.randomUUID(), nome: '', valor: 0 }]);
    };

    return (
        <Paper variant="outlined" sx={{ p: 3, mb: 3, borderColor: 'orange' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box>
                    <Typography variant="subtitle1" fontWeight="bold" color="warning.dark">Régua de Notas (Escala)</Typography>
                    <Typography variant="caption" color="text.secondary">Defina os níveis de avaliação. Ex: 0, 5, 10.</Typography>
                </Box>
                <MuiTooltip title="Esses valores são usados para calcular a média final. Recomendamos: Abaixo=0, Atende=5, Supera=10.">
                    <IconButton size="small"><InfoIcon fontSize="small" /></IconButton>
                </MuiTooltip>
            </Box>

            {notas.map((n, i) => (
                <Box key={n.id || i} display="flex" gap={2} mb={1} alignItems="center">
                    <TextField 
                        value={n.nome} 
                        onChange={e => handleChange(i, 'nome', e.target.value)} 
                        fullWidth 
                        size="small" 
                        label="Nome do Nível (ex: Atende)" 
                    />
                    <TextField 
                        type="number" 
                        value={n.valor} 
                        onChange={e => handleChange(i, 'valor', e.target.value)} 
                        sx={{ width: 120 }} 
                        size="small" 
                        label="Valor (0-10)" 
                    />
                    <IconButton onClick={() => onNotasChange(notas.filter((_, idx) => idx !== i))} color="error" size="small">
                        <DeleteIcon />
                    </IconButton>
                </Box>
            ))}
            <Button startIcon={<AddIcon />} onClick={handleAdd} variant="outlined" color="warning" size="small" sx={{ mt: 1 }}>
                Adicionar Nível
            </Button>
        </Paper>
    );
};

export default function JobDetails() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [parameters, setParameters] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [applicants, setApplicants] = useState([]);
  const [allEvaluations, setAllEvaluations] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [evaluatorFilter, setEvaluatorFilter] = useState('all');
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const { data: jobData } = await supabase.from('jobs').select('*').eq('id', jobId).single();
        setJob(jobData);
        
        // Garante a estrutura completa, incluindo as NOTAS
        const defaultParams = { 
            triagem: [], 
            cultura: [], 
            tecnico: [], 
            notas: [
                {id: '1', nome: 'Abaixo', valor: 0},
                {id: '2', nome: 'Atende', valor: 5},
                {id: '3', nome: 'Supera', valor: 10}
            ] 
        };
        setParameters(jobData.parameters || defaultParams);

        const { data: appsData } = await supabase.from('applications').select('*, candidate:candidates(name, email)').eq('jobId', jobId);
        setApplicants(appsData || []);

        const appIds = (appsData || []).map(a => a.id);
        if (appIds.length > 0) {
            const { data: evalsData } = await supabase.from('evaluations').select('*').in('application_id', appIds);
            setAllEvaluations(evalsData || []);

            const userIds = [...new Set((evalsData || []).map(e => e.evaluator_id))];
            if (userIds.length > 0) {
                const { data: usersData } = await supabase.from('users').select('id, name, email').in('id', userIds);
                const map = {};
                usersData?.forEach(u => map[u.id] = u.name || u.email);
                setUsersMap(map);
            }
        }
      } catch (err) { console.error(err);
      } finally { setLoading(false); }
    };
    fetchAllData();
  }, [jobId]);

  const processedData = useMemo(() => {
    if (!parameters) return { chartData: [], evaluators: [] };

    const evaluators = Object.keys(usersMap).map(id => ({ id, name: usersMap[id] || 'Desconhecido' }));

    const chartData = applicants.map(app => {
        const appEvals = allEvaluations.filter(e => 
            String(e.application_id) === String(app.id) && 
            (evaluatorFilter === 'all' || e.evaluator_id === evaluatorFilter)
        );

        let sumTotal = 0, count = 0;
        let sumT = 0, sumC = 0, sumTc = 0;

        appEvals.forEach(ev => {
            const scores = processEvaluation(ev, parameters);
            if (scores.total > 0 || scores.triagem > 0 || scores.cultura > 0 || scores.tecnico > 0) {
                sumT += scores.triagem; 
                sumC += scores.cultura; 
                sumTc += scores.tecnico; 
                sumTotal += scores.total; 
                count++;
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
            triagem: Number(avgT.toFixed(1)),
            cultura: Number(avgC.toFixed(1)),
            tecnico: Number(avgTc.toFixed(1)),
            total: Number(general.toFixed(1)),
            count: count,
            hired: app.isHired
        };
    }).sort((a, b) => b.total - a.total);

    return { chartData, evaluators };
  }, [applicants, allEvaluations, evaluatorFilter, parameters, usersMap]);

  const handleHireToggle = async (appId, currentStatus) => {
      const newStatus = !currentStatus;
      setApplicants(prev => prev.map(a => a.id === appId ? {...a, isHired: newStatus} : a));
      await supabase.from('applications').update({ isHired: newStatus }).eq('id', appId);
  };

  const handleSaveParameters = async () => {
      const { error } = await supabase.from('jobs').update({ parameters }).eq('id', jobId);
      if (error) {
          setFeedback({ open: true, message: 'Erro ao salvar: ' + error.message, severity: 'error' });
      } else {
          setFeedback({ open: true, message: 'Configurações salvas com sucesso!', severity: 'success' });
      }
  };

  if (loading) return <Box p={5} display="flex" justifyContent="center"><CircularProgress /></Box>;

  return (
    <Box>
        <AppBar position="static" color="default" elevation={1}><Toolbar><Typography variant="h6" sx={{flexGrow:1}}>{job?.title}</Typography><Button color="inherit" component={RouterLink} to="/">Voltar</Button></Toolbar></AppBar>
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            <Paper sx={{ mb: 3 }}><Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} centered><Tab label="Candidatos" /><Tab label="Classificação" /><Tab label="Configurações da Vaga" /></Tabs></Paper>
            
            {/* ABA 1: LISTA DE CANDIDATOS */}
            {tabValue === 0 && (
                <Paper sx={{ p: 0 }}>
                    <Table>
                        <TableHead sx={{ bgcolor: '#f5f5f5' }}><TableRow><TableCell><strong>Nome</strong></TableCell><TableCell><strong>Email</strong></TableCell><TableCell align="center"><strong>Avaliações</strong></TableCell><TableCell align="center"><strong>Nota Geral</strong></TableCell></TableRow></TableHead>
                        <TableBody>{processedData.chartData.map(d => (
                            <TableRow key={d.appId} hover component={RouterLink} to={`/applications/${d.appId}`} style={{textDecoration:'none', cursor:'pointer'}}>
                                <TableCell>{d.name}</TableCell>
                                <TableCell>{d.email}</TableCell>
                                <TableCell align="center"><Chip label={d.count} size="small" /></TableCell>
                                <TableCell align="center"><Chip label={d.total.toFixed(1)} color={d.total >= 8 ? 'success' : d.total >= 5 ? 'warning' : 'default'} variant={d.count > 0 ? 'filled' : 'outlined'}/></TableCell>
                            </TableRow>
                        ))}</TableBody>
                    </Table>
                </Paper>
            )}

            {/* ABA 2: GRÁFICOS E RANKING */}
            {tabValue === 1 && (
                <Grid container spacing={3}>
                    <Grid item xs={12} md={8}>
                        <Paper sx={{ p: 3, height: '600px', display: 'flex', flexDirection: 'column' }} elevation={3}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, pb: 2, borderBottom: '1px solid #f0f0f0' }}>
                                <Typography variant="h6" color="text.primary" fontWeight="bold">Comparativo de Desempenho</Typography>
                                <FormControl size="small" sx={{ minWidth: 220 }}>
                                    <InputLabel>Filtrar por Avaliador</InputLabel>
                                    <Select value={evaluatorFilter} label="Filtrar por Avaliador" onChange={(e) => setEvaluatorFilter(e.target.value)}>
                                        <MenuItem value="all">Visão Geral (Média da Equipe)</MenuItem>
                                        {processedData.evaluators.map(ev => <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            </Box>
                            
                            {processedData.chartData.some(d => d.total > 0) ? (
                                <Box sx={{ flex: 1, width: '100%', minHeight: 0 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart 
                                            data={processedData.chartData} 
                                            layout="vertical" 
                                            margin={{ top: 10, right: 30, left: 10, bottom: 5 }} 
                                            barGap={4}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} stroke="#eee" />
                                            <XAxis type="number" domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} stroke="#999" />
                                            <YAxis 
                                                dataKey="name" 
                                                type="category" 
                                                width={150} 
                                                style={{fontSize: '0.8rem', fontWeight: 500, fill: '#444'}} 
                                            />
                                            <Tooltip cursor={{fill: '#f5f5f5'}} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} formatter={(val, name) => [val, name]} />
                                            <Legend verticalAlign="top" height={40} iconType="circle" />
                                            
                                            <Bar dataKey="triagem" name="Triagem" fill="#90caf9" barSize={20} radius={[0, 4, 4, 0]}><LabelList dataKey="triagem" position="right" style={{fontSize:'0.7rem', fill:'#666'}} formatter={(v)=>v>0?v:''}/></Bar>
                                            <Bar dataKey="cultura" name="Fit Cultural" fill="#a5d6a7" barSize={20} radius={[0, 4, 4, 0]}><LabelList dataKey="cultura" position="right" style={{fontSize:'0.7rem', fill:'#666'}} formatter={(v)=>v>0?v:''}/></Bar>
                                            <Bar dataKey="tecnico" name="Técnico" fill="#ffcc80" barSize={20} radius={[0, 4, 4, 0]}><LabelList dataKey="tecnico" position="right" style={{fontSize:'0.7rem', fill:'#666'}} formatter={(v)=>v>0?v:''}/></Bar>
                                            <Bar dataKey="total" name="Média Geral" fill="#4caf50" barSize={20} radius={[0, 4, 4, 0]}><LabelList dataKey="total" position="right" style={{fontSize:'0.8rem', fontWeight:'bold', fill:'#2e7d32'}} /></Bar>
                                            
                                            <ReferenceLine x={5} stroke="red" strokeDasharray="3 3" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </Box>
                            ) : (
                                <Box sx={{ flex: 1, display: 'flex', flexDirection:'column', alignItems: 'center', justifyContent: 'center', color: 'text.secondary', bgcolor:'#fafafa', borderRadius:2 }}>
                                    <Typography variant="body1">Ainda não há dados suficientes.</Typography>
                                    <Typography variant="caption">Realize avaliações para visualizar o gráfico.</Typography>
                                </Box>
                            )}
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Paper sx={{ height: '600px', display: 'flex', flexDirection: 'column' }} elevation={3}>
                            <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}><Typography variant="subtitle1" fontWeight="bold">Ranking Final</Typography></Box>
                            <List sx={{ overflowY: 'auto', flex: 1 }}>
                                {processedData.chartData.map((d, index) => (
                                    <React.Fragment key={d.appId}>
                                        <ListItem secondaryAction={<Checkbox checked={d.hired || false} onChange={() => handleHireToggle(d.appId, d.hired)} color="success" />}>
                                            <ListItemText 
                                                primary={<Typography variant="body2" fontWeight="bold">#{index + 1} {d.name}</Typography>} 
                                                secondary={<Typography variant="caption" color="text.secondary">Média: <strong style={{color:'#2e7d32', fontSize:'0.9rem'}}>{d.total.toFixed(1)}</strong></Typography>} 
                                            />
                                        </ListItem>
                                        <Divider component="li" />
                                    </React.Fragment>
                                ))}
                            </List>
                        </Paper>
                    </Grid>
                </Grid>
            )}

            {/* ABA 3: CONFIGURAÇÕES DA VAGA (RESTAURADO) */}
            {tabValue === 2 && (
                <Box p={3} sx={{ bgcolor: 'white', borderRadius: 1, boxShadow: 1 }}>
                    {/* Botão de Copiar */}
                    <Box mb={2} display="flex" justifyContent="flex-end">
                        <Button startIcon={<ContentCopyIcon/>} onClick={()=>setIsCopyModalOpen(true)} variant="outlined" size="small">Copiar de outra Vaga</Button>
                    </Box>

                    <Grid container spacing={4}>
                        <Grid item xs={12} md={7}>
                            <ParametersSection title="1. Triagem (Requisitos Básicos)" criteria={parameters?.triagem || []} onCriteriaChange={(c) => setParameters({...parameters, triagem: c})} />
                            <ParametersSection title="2. Fit Cultural (Comportamental)" criteria={parameters?.cultura || []} onCriteriaChange={(c) => setParameters({...parameters, cultura: c})} />
                            <ParametersSection title="3. Teste Técnico (Hard Skills)" criteria={parameters?.tecnico || parameters?.['técnico'] || []} onCriteriaChange={(c) => setParameters({...parameters, tecnico: c})} />
                        </Grid>
                        <Grid item xs={12} md={5}>
                            {/* AQUI ESTÁ A SEÇÃO QUE FALTAVA: RÉGUA DE NOTAS */}
                            <GradeScaleSection 
                                notas={parameters?.notas || []} 
                                onNotasChange={(n) => setParameters({...parameters, notas: n})} 
                            />
                            
                            <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f9fafb' }}>
                                <Typography variant="caption" color="text.secondary" paragraph>
                                    <strong>Dica:</strong> Se as notas estiverem aparecendo erradas (ex: 50/10), ajuste os valores na Régua acima para 0, 5 e 10.
                                </Typography>
                            </Paper>
                        </Grid>
                    </Grid>

                    <Box display="flex" justifyContent="flex-end" mt={3} pt={3} borderTop={1} borderColor="divider">
                        <Button variant="contained" color="primary" onClick={handleSaveParameters} size="large" startIcon={<Save size={18}/>}>
                            Salvar Configurações
                        </Button>
                    </Box>
                </Box>
            )}
        </Container>
        <CopyParametersModal open={isCopyModalOpen} onClose={() => setIsCopyModalOpen(false)} currentJobId={jobId} onCopy={(p) => { setParameters(p); setFeedback({open:true, message:'Critérios Copiados!', severity:'info'}); }} />
        <Snackbar open={feedback.open} autoHideDuration={4000} onClose={() => setFeedback({...feedback, open:false})}><Alert severity={feedback.severity} variant="filled">{feedback.message}</Alert></Snackbar>
    </Box>
  );
}