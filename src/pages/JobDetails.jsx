import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { 
    Container, Typography, Box, AppBar, Toolbar, Button, CircularProgress, 
    Paper, Tabs, Tab, TextField, IconButton, Snackbar,
    List, ListItem, ListItemText, Divider, Grid,
    Table, TableHead, TableRow, TableCell, TableBody, Checkbox,
    FormControl, InputLabel, Select, MenuItem, Chip, Modal, Alert, Switch,
    ToggleButton, ToggleButtonGroup
} from '@mui/material';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, LabelList,
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis 
} from 'recharts';
import { 
    Delete as DeleteIcon, 
    ContentCopy as ContentCopyIcon,
    Save as SaveIcon,
    Add as AddIcon,
    Star as StarIcon,
    CheckCircle as CheckCircleIcon,
    Edit as EditIcon,
    EmojiEvents as TrophyIcon,
    FilterList as FilterIcon
} from '@mui/icons-material';
import { processEvaluation, generateDefaultBenchmarkScores } from '../utils/evaluationLogic';
import EvaluationForm from '../components/EvaluationForm'; 

// --- ÍCONE SVG (Definido fora para evitar erros) ---
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
    <Box sx={{mt:2}}>
        {criteria.map((c, i) => (
            <Box key={i} display="flex" gap={2} mb={1}>
                <TextField value={c.name} onChange={e=>handleChange(i,'name',e.target.value)} fullWidth size="small" label="Critério" />
                <TextField type="number" value={c.weight} onChange={e=>handleChange(i,'weight',e.target.value)} sx={{width:100}} size="small" label="Peso %" />
                <IconButton onClick={()=>onCriteriaChange(criteria.filter((_,idx)=>idx!==i))} color="error"><DeleteIcon/></IconButton>
            </Box>
        ))}
        <Button onClick={()=>onCriteriaChange([...criteria, {name:'', weight:0}])} variant="outlined" size="small" startIcon={<AddIcon />}>Adicionar</Button>
        <Typography color={total===100?'green':'red'} variant="caption" display="block" sx={{mt:1, fontWeight:'bold'}}>Total: {total}%</Typography>
    </Box>
  );
};

// --- COMPONENTE RÉGUA DE NOTAS ---
const RatingScaleSection = ({ notes = [], onNotesChange }) => {
    const handleChange = (i, field, value) => {
        const newNotes = [...notes];
        newNotes[i] = { ...newNotes[i], [field]: field === 'valor' ? Number(value) : value };
        onNotesChange(newNotes);
    };
    const handleAdd = () => {
        const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
        onNotesChange([...notes, { id, nome: 'Nova Nota', valor: 0 }]);
    };
    const handleRemove = (i) => onNotesChange(notes.filter((_, idx) => idx !== i));

    return (
        <Box sx={{ mt: 2, p: 2, border: '1px solid orange', borderRadius: 1, bgcolor: '#fff8e1' }}>
            {notes.map((n, i) => (
                <Box key={n.id || i} display="flex" gap={2} mb={1} alignItems="center">
                    <TextField value={n.nome} onChange={(e) => handleChange(i, 'nome', e.target.value)} fullWidth size="small" label="Rótulo" />
                    <TextField type="number" value={n.valor} onChange={(e) => handleChange(i, 'valor', e.target.value)} sx={{ width: 100 }} size="small" label="Valor" />
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
  const [tabValue, setTabValue] = useState(1); 
  const [applicants, setApplicants] = useState([]);
  const [allEvaluations, setAllEvaluations] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  
  // Filtros
  const [evaluatorFilter, setEvaluatorFilter] = useState('all');
  const [metricFilter, setMetricFilter] = useState('total'); // 'total', 'triagem', 'cultura', 'tecnico'
  
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [isIdealModalOpen, setIsIdealModalOpen] = useState(false);
  const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const { data: jobData } = await supabase.from('jobs').select('*').eq('id', jobId).single();
        setJob(jobData);
        // Garante estrutura
        const safeParams = jobData.parameters || { 
            triagem: [], cultura: [], tecnico: [], 
            notas: [{id:'1',nome:'Abaixo',valor:0}, {id:'2',nome:'Atende',valor:5}, {id:'3',nome:'Supera',valor:10}] 
        };
        setParameters(safeParams);

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
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchAllData();
  }, [jobId]);

  const processedData = useMemo(() => {
    if (!parameters) return { chartData: [], evaluators: [] };

    const evaluators = Object.keys(usersMap).map(id => ({ id, name: usersMap[id] || 'Desconhecido' }));

    // --- CANDIDATO IDEAL (BENCHMARK) ---
    // 1. Gera respostas padrão (Item Central) ou usa as salvas
    const storedBenchmark = parameters.benchmark_scores;
    const activeBenchmarkScores = storedBenchmark || generateDefaultBenchmarkScores(parameters);
    
    // 2. Calcula nota do Ideal (usando os mesmos pesos da vaga)
    const idealResults = processEvaluation({ scores: activeBenchmarkScores }, parameters);
    
    const idealCandidate = {
        appId: 'ideal-benchmark',
        name: 'Candidato Ideal (Meta)',
        email: 'Referência',
        triagem: idealResults.triagem,
        cultura: idealResults.cultura,
        tecnico: idealResults.tecnico,
        total: idealResults.total,
        count: 1,
        hired: false,
        isIdeal: true,
        rawScores: activeBenchmarkScores // Para passar para o form
    };

    // --- CANDIDATOS REAIS ---
    let chartData = applicants.map(app => {
        // FILTRO DE AVALIADOR
        const appEvals = allEvaluations.filter(e => 
            String(e.application_id) === String(app.id) && 
            (evaluatorFilter === 'all' || e.evaluator_id === evaluatorFilter)
        );

        let sumT = 0, sumC = 0, sumTc = 0, count = 0, sumTotal = 0;
        
        if (appEvals.length > 0) {
            appEvals.forEach(ev => {
                const scores = processEvaluation(ev, parameters);
                if (scores.total > 0 || scores.triagem > 0 || scores.cultura > 0 || scores.tecnico > 0) {
                    sumT += scores.triagem; sumC += scores.cultura; sumTc += scores.tecnico; sumTotal += scores.total; count++;
                }
            });
        }

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
            hired: app.isHired,
            isIdeal: false
        };
    });

    // Filtra candidatos sem avaliação se filtro de avaliador estiver ativo
    if (evaluatorFilter !== 'all') {
        chartData = chartData.filter(c => c.count > 0);
    }

    // Adiciona Ideal no topo
    chartData = [idealCandidate, ...chartData];

    // Ordenação (Ranking) baseado no filtro de Pilar
    chartData.sort((a, b) => {
        if (a.isIdeal) return -1;
        if (b.isIdeal) return 1;

        let key = 'total';
        if (metricFilter === 'triagem') key = 'triagem';
        if (metricFilter === 'cultura') key = 'cultura';
        if (metricFilter === 'tecnico') key = 'tecnico';

        return b[key] - a[key];
    });

    return { chartData, evaluators, idealCandidate };
  }, [applicants, allEvaluations, evaluatorFilter, parameters, usersMap, metricFilter]);


  const handleHireToggle = async (appId, currentStatus) => {
      const newStatus = !currentStatus;
      setApplicants(prev => prev.map(a => a.id === appId ? {...a, isHired: newStatus} : a));
      await supabase.from('applications').update({ isHired: newStatus }).eq('id', appId);
  };

  const handleSaveParameters = async () => {
      setSaving(true);
      await supabase.from('jobs').update({ parameters }).eq('id', jobId);
      setSaving(false);
      setFeedback({ open: true, message: 'Configurações salvas!', severity: 'success' });
  };

  const handleSaveIdeal = async ({ scores }) => {
      const newParams = { ...parameters, benchmark_scores: scores };
      setParameters(newParams);
      const { error } = await supabase.from('jobs').update({ parameters: newParams }).eq('id', jobId);
      if (!error) {
          setFeedback({ open: true, message: 'Ideal atualizado!', severity: 'success' });
          setIsIdealModalOpen(false);
      }
  };

  // Regra de Cores: >=8 (Verde), >=5 (Amarelo), <5 (Padrão)
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

  // Chave ativa para o gráfico de barras
  const activeDataKey = metricFilter;

  if (loading) return <Box p={5} display="flex" justifyContent="center"><CircularProgress /></Box>;

  return (
    <Box sx={{ bgcolor: '#f4f6f8', minHeight: '100vh', pb: 8 }}>
        <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: '1px solid #e0e0e0', bgcolor: 'white' }}>
            <Toolbar>
                <IconButton edge="start" onClick={() => navigate('/')} sx={{ mr: 2 }}><ArrowIcon /></IconButton>
                <Typography variant="h6" sx={{flexGrow:1}}>{job?.title}</Typography>
                <Button component={RouterLink} to="/">Voltar</Button>
            </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ mt: 4 }}>
            <Paper sx={{ mb: 3 }}>
                <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} centered>
                    <Tab label={`Candidatos (${applicants.length})`} />
                    <Tab label="Classificação & Ranking" icon={<TrophyIcon />} iconPosition="start" />
                    <Tab label="Configuração da Vaga" />
                </Tabs>
            </Paper>
            
            {/* ABA 0: LISTA SIMPLES */}
            {tabValue === 0 && (
                <Paper sx={{ p: 0 }}>
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
                            {processedData.chartData.filter(d => !d.isIdeal).map(d => (
                                <TableRow key={d.appId} hover component={RouterLink} to={`/applications/${d.appId}`} style={{textDecoration:'none', cursor:'pointer'}}>
                                    <TableCell>{d.name}</TableCell>
                                    <TableCell>{d.email}</TableCell>
                                    <TableCell align="center">{d.hired ? <Chip label="Contratado" color="success" size="small" icon={<CheckCircleIcon/>}/> : <Chip label="Em análise" size="small"/>}</TableCell>
                                    <TableCell align="center"><Chip label={d.count} size="small" /></TableCell>
                                    <TableCell align="center">
                                        <Chip label={d.total.toFixed(1)} color={getScoreColor(d.total)} variant={d.count > 0 ? 'filled' : 'outlined'} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Paper>
            )}

            {/* ABA 1: RANKING */}
            {tabValue === 1 && (
                <Grid container spacing={3}>
                    {/* ESQUERDA: LISTA + FILTROS */}
                    <Grid item xs={12} md={4}>
                        <Paper sx={{ height: '100%', maxHeight: '800px', display: 'flex', flexDirection: 'column' }} elevation={2}>
                            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <Typography variant="subtitle2" color="text.secondary" mb={1} fontWeight="bold">FILTROS</Typography>
                                
                                <FormControl fullWidth size="small" sx={{ mb: 2, bgcolor: 'white' }}>
                                    <InputLabel>Avaliador</InputLabel>
                                    <Select value={evaluatorFilter} label="Avaliador" onChange={(e) => setEvaluatorFilter(e.target.value)}>
                                        <MenuItem value="all">Média (Todos)</MenuItem>
                                        {processedData.evaluators.map(ev => <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>)}
                                    </Select>
                                </FormControl>

                                <ToggleButtonGroup
                                    value={metricFilter}
                                    exclusive
                                    onChange={(e, v) => v && setMetricFilter(v)}
                                    size="small"
                                    fullWidth
                                    color="primary"
                                    sx={{ bgcolor: 'white' }}
                                >
                                    <ToggleButton value="total">Geral</ToggleButton>
                                    <ToggleButton value="triagem">Triagem</ToggleButton>
                                    <ToggleButton value="cultura">Cult</ToggleButton>
                                    <ToggleButton value="tecnico">Téc</ToggleButton>
                                </ToggleButtonGroup>
                            </Box>

                            <List sx={{ overflowY: 'auto', flex: 1 }}>
                                {processedData.chartData.map((d, index) => {
                                    const displayValue = d[activeDataKey]?.toFixed(1) || '0.0';
                                    
                                    if (d.isIdeal) {
                                        return (
                                            <ListItem key="ideal" button onClick={() => setIsIdealModalOpen(true)} sx={{ bgcolor: '#fff7ed', borderBottom: '1px dashed orange' }}>
                                                <StarIcon sx={{ color: 'orange', mr: 1 }} />
                                                <ListItemText 
                                                    primary={<Typography variant="body2" fontWeight="bold" color="orange">Candidato Ideal (Ref)</Typography>} 
                                                    secondary="Clique para editar gabarito"
                                                />
                                                <Chip label={displayValue} size="small" sx={{ bgcolor: 'orange', color: 'white', fontWeight: 'bold' }} />
                                            </ListItem>
                                        )
                                    }
                                    return (
                                        <React.Fragment key={d.appId}>
                                            <ListItem 
                                                secondaryAction={
                                                    <Box textAlign="right" display="flex" flexDirection="column" alignItems="flex-end" gap={0.5}>
                                                        <Typography variant="h6" fontWeight="bold" sx={{color: getScoreColorHex(d[activeDataKey])}}>
                                                            {displayValue}
                                                        </Typography>
                                                        <Switch size="small" checked={d.hired || false} onChange={() => handleHireToggle(d.appId, d.hired)} color="success"/>
                                                    </Box>
                                                }
                                            >
                                                <ListItemText 
                                                    primary={<Typography fontWeight="bold">#{index} {d.name}</Typography>}
                                                    secondary={d.email}
                                                />
                                            </ListItem>
                                            <Divider component="li" />
                                        </React.Fragment>
                                    )
                                })}
                            </List>
                        </Paper>
                    </Grid>

                    {/* DIREITA: GRÁFICOS */}
                    <Grid item xs={12} md={8}>
                        <Grid container spacing={3}>
                            {/* RADAR */}
                            <Grid item xs={12}>
                                <Paper sx={{ p: 3, height: '400px' }} elevation={2}>
                                    <Typography variant="h6" mb={2}>Comparativo de Perfil</Typography>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                                            { subject: 'Triagem', ideal: processedData.idealCandidate.triagem, ...processedData.chartData.slice(1,4).reduce((acc,c,i)=>({...acc, [`c${i}`]: c.triagem}), {}) },
                                            { subject: 'Cultura', ideal: processedData.idealCandidate.cultura, ...processedData.chartData.slice(1,4).reduce((acc,c,i)=>({...acc, [`c${i}`]: c.cultura}), {}) },
                                            { subject: 'Técnico', ideal: processedData.idealCandidate.tecnico, ...processedData.chartData.slice(1,4).reduce((acc,c,i)=>({...acc, [`c${i}`]: c.tecnico}), {}) }
                                        ]}>
                                            <PolarGrid />
                                            <PolarAngleAxis dataKey="subject" />
                                            <PolarRadiusAxis angle={30} domain={[0, 'auto']} /> 
                                            <Radar name="Ideal" dataKey="ideal" stroke="#ff9800" fill="#ff9800" fillOpacity={0.3} />
                                            {processedData.chartData.slice(1, 4).map((c, i) => (
                                                <Radar key={i} name={c.name} dataKey={`c${i}`} stroke={['#8884d8','#82ca9d','#ffc658'][i]} fill={['#8884d8','#82ca9d','#ffc658'][i]} fillOpacity={0.1} />
                                            ))}
                                            <Legend />
                                            <Tooltip />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </Paper>
                            </Grid>

                            {/* BARRAS - LADO A LADO (SEM EMPILHAMENTO) */}
                            <Grid item xs={12}>
                                <Paper sx={{ p: 3, minHeight: '500px' }} elevation={2}>
                                    <Typography variant="h6" mb={3}>Ranking por {metricFilter === 'total' ? 'Média Geral' : metricFilter}</Typography>
                                    {processedData.chartData.length > 0 ? (
                                        <Box sx={{ height: Math.max(500, processedData.chartData.length * 60) }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart 
                                                    data={processedData.chartData} 
                                                    layout="vertical" 
                                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                                    barSize={24}
                                                    barGap={4} 
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                                    <XAxis type="number" domain={[0, 'auto']} hide />
                                                    <YAxis dataKey="name" type="category" width={150} tick={{fontSize: 12}} />
                                                    <Tooltip cursor={{fill: '#f5f5f5'}} />
                                                    <Legend verticalAlign="top" height={36} />
                                                    
                                                    <Bar dataKey={activeDataKey} name="Nota" fill="#8884d8" radius={[0, 4, 4, 0]}>
                                                        <LabelList dataKey={activeDataKey} position="right" formatter={(v) => v.toFixed(1)} />
                                                    </Bar>
                                                    
                                                    {/* Linha de referência da meta */}
                                                    <ReferenceLine x={processedData.idealCandidate[activeDataKey]} stroke="orange" label="Meta" />
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
                    
                    <Box mt={4} p={2} bgcolor="#fff3e0" borderRadius={2}>
                        <Typography variant="subtitle1" fontWeight="bold" color="orange">Régua de Notas</Typography>
                        <RatingScaleSection notes={parameters?.notas} onNotesChange={n => setParameters({...parameters, notas: n})} />
                    </Box>

                    <Box mt={3} display="flex" justifyContent="flex-end">
                        <Button variant="contained" onClick={handleSaveParameters} disabled={saving} startIcon={<SaveIcon />}>Salvar Configurações</Button>
                    </Box>
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
                     <EvaluationForm 
                        jobParameters={parameters} 
                        initialData={{ scores: processedData.idealCandidate.rawScores }} 
                        customSubmit={handleSaveIdeal} 
                     />
                </Box>
            </Box>
        </Modal>

        <Snackbar open={feedback.open} autoHideDuration={4000} onClose={() => setFeedback({...feedback, open:false})}><Alert severity={feedback.severity} variant="filled">{feedback.message}</Alert></Snackbar>
    </Box>
  );
}