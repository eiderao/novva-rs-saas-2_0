import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { 
    Container, Typography, Box, AppBar, Toolbar, Button, CircularProgress, 
    Paper, Tabs, Tab, TextField, IconButton, Snackbar,
    List, ListItem, ListItemText, Divider, Grid,
    Table, TableHead, TableRow, TableCell, TableBody, Checkbox,
    FormControl, InputLabel, Select, MenuItem, Chip, Modal, Alert, Avatar
} from '@mui/material';
// IMPORTAÇÕES DE GRÁFICOS (Adicionado Radar)
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
    FilterList as FilterIcon
} from '@mui/icons-material';
import { Share2, MapPin, Briefcase, Calendar, ArrowLeft } from 'lucide-react'; 
import { processEvaluation } from '../utils/evaluationLogic';

// --- COMPONENTES AUXILIARES ---
const modalStyle = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 500, bgcolor: 'background.paper', boxShadow: 24, p: 4, borderRadius: 2 };

const CopyParametersModal = ({ open, onClose, currentJobId, onCopy }) => {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  useEffect(() => { if (open) { const f = async () => { const { data } = await supabase.from('jobs').select('id, title').neq('id', currentJobId).eq('status', 'active'); setJobs(data || []); }; f(); } }, [open, currentJobId]);
  const handleConfirm = async () => { if (!selectedJobId) return; const { data } = await supabase.from('jobs').select('parameters').eq('id', selectedJobId).single(); if (data?.parameters) onCopy(data.parameters); onClose(); };
  return ( <Modal open={open} onClose={onClose}><Box sx={modalStyle}><Typography variant="h6">Copiar de Vaga</Typography><FormControl fullWidth margin="normal"><InputLabel>Vaga</InputLabel><Select value={selectedJobId} onChange={e=>setSelectedJobId(e.target.value)} label="Vaga">{jobs.map(j=><MenuItem key={j.id} value={j.id}>{j.title}</MenuItem>)}</Select></FormControl><Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}><Button onClick={onClose}>Cancelar</Button><Button onClick={handleConfirm} variant="contained" disabled={!selectedJobId}>Copiar</Button></Box></Box></Modal> );
};

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
    const handleRemove = (i) => { onNotesChange(notes.filter((_, idx) => idx !== i)); };

    return (
        <Box sx={{ mt: 2 }}>
            {notes.map((n, i) => (
                <Box key={n.id || i} display="flex" gap={2} mb={1} alignItems="center">
                    <TextField value={n.nome} onChange={(e) => handleChange(i, 'nome', e.target.value)} fullWidth size="small" label="Nome do Nível" />
                    <TextField type="number" value={n.valor} onChange={(e) => handleChange(i, 'valor', e.target.value)} sx={{ width: 120 }} size="small" label="Valor (0-100)" />
                    <IconButton onClick={() => handleRemove(i)} color="error"><DeleteIcon /></IconButton>
                </Box>
            ))}
            <Button onClick={handleAdd} variant="outlined" size="small" startIcon={<AddIcon />}>Adicionar Nível</Button>
            {notes.length < 2 && <Typography color="warning.main" variant="caption" display="block" sx={{ mt: 1 }}>Recomendado ter pelo menos 2 níveis.</Typography>}
        </Box>
    );
};

export default function JobDetails() {
  const { jobId } = useParams();
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [parameters, setParameters] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [applicants, setApplicants] = useState([]);
  const [allEvaluations, setAllEvaluations] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  
  // NOVOS ESTADOS DE FILTRO
  const [evaluatorFilter, setEvaluatorFilter] = useState('all');
  const [selectedPillar, setSelectedPillar] = useState('FINAL'); // FINAL, TRIAGEM, CULTURA, TECNICO

  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const { data: jobData, error: jobError } = await supabase.from('jobs').select('*').eq('id', jobId).single();
        if (jobError) throw jobError;
        setJob(jobData);
        setParameters(jobData.parameters || { triagem: [], cultura: [], tecnico: [], notas: [] });

        const { data: appsData } = await supabase.from('applications').select('*, candidate:candidates(name, email)').eq('jobId', jobId);
        setApplicants(appsData || []);

        const appIds = (appsData || []).map(a => a.id);
        if (appIds.length > 0) {
            const { data: evalsData } = await supabase.from('evaluations').select('*').in('application_id', appIds);
            setAllEvaluations(evalsData || []);
        }

        // Busca toda a equipe para o dropdown
        if (jobData.tenantId) {
            const { data: teamData, error: teamError } = await supabase
                .from('user_tenants')
                .select('user:user_profiles(id, name, email)')
                .eq('tenant_id', jobData.tenantId);

            if (!teamError && teamData) {
                const map = {};
                teamData.forEach(item => {
                    if (item.user) {
                        map[item.user.id] = item.user.name || item.user.email;
                    }
                });
                setUsersMap(map);
            }
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchAllData();
  }, [jobId]);

  const handleStatusChange = async (e) => {
    const newStatus = e.target.value;
    setStatusUpdating(true);
    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        const res = await fetch('/api/jobs', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ 
                action: 'updateJobStatus', 
                jobId: job.id, 
                newStatus 
            })
        });

        if (!res.ok) throw new Error('Falha ao atualizar status');

        setJob(prev => ({ ...prev, status: newStatus }));
        setFeedback({ open: true, message: 'Status da vaga atualizado!', severity: 'success' });
    } catch (err) {
        console.error(err);
        setFeedback({ open: true, message: 'Erro ao atualizar status.', severity: 'error' });
    } finally {
        setStatusUpdating(false);
    }
  };

  const handleCopyLink = () => {
    if (job.status !== 'active') return;
    navigator.clipboard.writeText(`${window.location.origin}/apply/${jobId}`);
    setFeedback({ open: true, message: 'Link copiado para a área de transferência!', severity: 'info' });
  };

  // --- LÓGICA DE DADOS COMPUTADOS (MEMOS) ---
  
  // 1. Identifica o Candidato Ideal (Benchmark)
  const { idealCandidate, realCandidates } = useMemo(() => {
    const ideal = applicants.find(app => 
        app.candidate?.name?.includes('PERFIL IDEAL') || 
        app.candidate?.email?.includes('novva.benchmark')
    );
    // Cria um objeto "Ideal" enriquecido com suas notas
    let idealWithScores = null;
    if (ideal && parameters) {
        const idealEvals = allEvaluations.filter(e => String(e.application_id) === String(ideal.id));
        // Se houver múltiplas, pega a média ou a última. Vamos pegar a última.
        const lastEval = idealEvals[idealEvals.length - 1];
        const scores = lastEval ? processEvaluation(lastEval, parameters) : { triagem: 0, cultura: 0, tecnico: 0, total: 0 };
        idealWithScores = { ...ideal, ...scores };
    }

    const real = applicants.filter(app => app.id !== ideal?.id);
    return { idealCandidate: idealWithScores, realCandidates: real };
  }, [applicants, allEvaluations, parameters]);

  // 2. Prepara Dados para o Gráfico de Barras e Tabela (Real Candidates)
  const processedData = useMemo(() => {
    if (!parameters) return { chartData: [], evaluators: [] };

    const evaluators = Object.keys(usersMap).map(id => ({ id, name: usersMap[id] }));

    const chartData = realCandidates.map(app => {
        const appEvals = allEvaluations.filter(e => String(e.application_id) === String(app.id));
        const evalsToConsider = evaluatorFilter === 'all' 
            ? appEvals 
            : appEvals.filter(e => e.evaluator_id === evaluatorFilter);

        let sumT = 0, sumC = 0, sumTc = 0, count = 0, sumTotal = 0;
        evalsToConsider.forEach(ev => {
            const scores = processEvaluation(ev, parameters);
            if (scores.total > 0 || scores.triagem > 0) {
                sumT += scores.triagem; sumC += scores.cultura; sumTc += scores.tecnico; sumTotal += scores.total; count++;
            }
        });

        const avgT = count > 0 ? sumT / count : 0;
        const avgC = count > 0 ? sumC / count : 0;
        const avgTc = count > 0 ? sumTc / count : 0;
        const general = count > 0 ? sumTotal / count : 0;

        // Seleciona a nota a exibir com base no Pilar
        let displayScore = general;
        if (selectedPillar === 'TRIAGEM') displayScore = avgT;
        if (selectedPillar === 'CULTURA') displayScore = avgC;
        if (selectedPillar === 'TECNICO') displayScore = avgTc;

        return {
            appId: app.id,
            name: app.candidate?.name || 'Sem Nome',
            email: app.candidate?.email,
            triagem: Number(avgT.toFixed(1)),
            cultura: Number(avgC.toFixed(1)),
            tecnico: Number(avgTc.toFixed(1)),
            total: Number(general.toFixed(1)),
            displayScore: Number(displayScore.toFixed(1)), // Usado no gráfico
            count: count,
            hired: app.isHired
        };
    }).sort((a, b) => b.displayScore - a.displayScore);

    return { chartData, evaluators };
  }, [realCandidates, allEvaluations, evaluatorFilter, parameters, usersMap, selectedPillar]);

  // 3. Prepara Dados para o Gráfico Radar (Comparativo Média vs Ideal)
  const radarData = useMemo(() => {
    // Média dos candidatos reais (filtrados ou total)
    const data = processedData.chartData;
    const count = data.length || 1;
    
    const avg = {
        triagem: data.reduce((a,b) => a + b.triagem, 0) / count,
        cultura: data.reduce((a,b) => a + b.cultura, 0) / count,
        tecnico: data.reduce((a,b) => a + b.tecnico, 0) / count,
    };

    // Dados do Ideal
    const ideal = {
        triagem: idealCandidate ? idealCandidate.triagem : 0,
        cultura: idealCandidate ? idealCandidate.cultura : 0,
        tecnico: idealCandidate ? idealCandidate.tecnico : 0,
    };

    return [
        { subject: 'Triagem', Media: avg.triagem, Ideal: ideal.triagem, fullMark: 100 },
        { subject: 'Fit Cultural', Media: avg.cultura, Ideal: ideal.cultura, fullMark: 100 },
        { subject: 'Técnico', Media: avg.tecnico, Ideal: ideal.tecnico, fullMark: 100 },
    ];
  }, [processedData.chartData, idealCandidate]);


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

  if (loading) return <Box p={5} display="flex" justifyContent="center"><CircularProgress /></Box>;
  if (!job) return <Box p={5} textAlign="center">Vaga não encontrada</Box>;

  return (
    <Box>
        <AppBar position="static" color="default" elevation={1}>
            <Toolbar>
                <IconButton onClick={() => navigate('/')} edge="start" sx={{mr:2}}><ArrowLeft size={20}/></IconButton>
                <Typography variant="h6" sx={{flexGrow:1}}>{job?.title}</Typography>
                
                {/* SELETOR DE STATUS */}
                <FormControl size="small" sx={{ minWidth: 150, mr: 2 }}>
                    <Select 
                        value={job?.status || 'active'} 
                        onChange={handleStatusChange}
                        disabled={statusUpdating}
                        sx={{ bgcolor: 'white', '& .MuiSelect-select': { py: 1 } }}
                    >
                        <MenuItem value="active">Ativa</MenuItem>
                        <MenuItem value="inactive">Inativa</MenuItem>
                        <MenuItem value="filled">Preenchida</MenuItem>
                        <MenuItem value="suspended">Suspensa</MenuItem>
                        <MenuItem value="cancelled">Cancelada</MenuItem>
                    </Select>
                </FormControl>

                <Button color="inherit" component={RouterLink} to="/">Voltar</Button>
            </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            
            <Box mb={4}>
                <Box display="flex" justifyContent="space-between" alignItems="start">
                    <Box>
                        <Typography variant="h4" fontWeight="bold" color="text.primary">{job.title}</Typography>
                        <Box display="flex" gap={3} mt={1} color="text.secondary">
                            <Box display="flex" alignItems="center" gap={0.5}><MapPin size={16}/> <Typography variant="body2">{job.location_type || 'Remoto'}</Typography></Box>
                            <Box display="flex" alignItems="center" gap={0.5}><Briefcase size={16}/> <Typography variant="body2">{job.type || 'CLT'}</Typography></Box>
                            <Box display="flex" alignItems="center" gap={0.5}><Calendar size={16}/> <Typography variant="body2">{new Date(job.created_at).toLocaleDateString()}</Typography></Box>
                        </Box>
                    </Box>
                    
                    <Button 
                        variant="outlined" 
                        onClick={handleCopyLink}
                        disabled={job.status !== 'active'}
                        startIcon={<Share2 size={18}/>}
                        sx={{ textTransform: 'none', fontWeight: 'bold' }}
                    >
                        {job.status === 'active' ? 'Compartilhar Formulário' : 'Link Indisponível (Vaga Inativa)'}
                    </Button>
                </Box>
            </Box>

            <Paper sx={{ mb: 3 }}>
                <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} centered sx={{'& .MuiTab-root': {textTransform:'none', fontWeight:'bold'}}}>
                    <Tab label="Candidatos" />
                    <Tab label="Dashboard & Analytics" />
                    <Tab label="Configurações da Vaga" />
                </Tabs>
            </Paper>
            
            {/* TAB 0: CANDIDATOS */}
            {tabValue === 0 && (
                <Paper sx={{ p: 0 }}>
                    <Box p={3} borderBottom="1px solid #eee">
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" fontWeight="bold">Descrição</Typography>
                                <Typography variant="body2" color="text.secondary" whiteSpace="pre-wrap">{job.description || 'Sem descrição.'}</Typography>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" fontWeight="bold">Requisitos</Typography>
                                <Typography variant="body2" color="text.secondary" whiteSpace="pre-wrap">{job.requirements || 'Sem requisitos.'}</Typography>
                            </Grid>
                        </Grid>
                    </Box>

                    <Table>
                        <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                            <TableRow>
                                <TableCell><strong>Nome</strong></TableCell>
                                <TableCell><strong>Email</strong></TableCell>
                                <TableCell align="center"><strong>Avaliações</strong></TableCell>
                                <TableCell align="center"><strong>Nota Geral</strong></TableCell>
                                <TableCell align="right"><strong>Ação</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {/* PERFIL IDEAL EM DESTAQUE */}
                            {idealCandidate && (
                                <TableRow sx={{bgcolor:'#fffbeb', '&:hover':{bgcolor:'#fef3c7'}}}>
                                    <TableCell>
                                        <Box display="flex" alignItems="center" gap={2}>
                                            <Avatar sx={{bgcolor:'#000', width:32, height:32}}><StarIcon fontSize="small"/></Avatar>
                                            <Box>
                                                <Typography fontWeight="bold" variant="body2">PERFIL IDEAL (Benchmark)</Typography>
                                                <Typography variant="caption" color="text.secondary">Meta / Gabarito</Typography>
                                            </Box>
                                        </Box>
                                    </TableCell>
                                    <TableCell colSpan={2} align="center">
                                        <Typography variant="caption">Use para calibrar o gráfico</Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Chip label={idealCandidate.total?.toFixed(1) || '-'} sx={{bgcolor:'#000', color:'#fff', fontWeight:'bold'}} size="small"/>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Button size="small" variant="contained" color="warning" component={RouterLink} to={`/applications/${idealCandidate.id}`} sx={{textTransform:'none'}}>
                                            Definir Ideal
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )}

                            {/* CANDIDATOS REAIS */}
                            {processedData.chartData.map(d => (
                            <TableRow key={d.appId} hover component={RouterLink} to={`/applications/${d.appId}`} style={{textDecoration:'none', cursor:'pointer'}}>
                                <TableCell>{d.name}</TableCell>
                                <TableCell>{d.email}</TableCell>
                                <TableCell align="center"><Chip label={d.count} size="small" /></TableCell>
                                <TableCell align="center"><Chip label={d.total.toFixed(1)} color={d.total >= 8 ? 'success' : d.total >= 5 ? 'warning' : 'default'} variant={d.count > 0 ? 'filled' : 'outlined'}/></TableCell>
                                <TableCell align="right"><Button size="small">Ver</Button></TableCell>
                            </TableRow>
                        ))}</TableBody>
                    </Table>
                </Paper>
            )}

            {/* TAB 1: DASHBOARD (COM NOVOS FILTROS E RADAR) */}
            {tabValue === 1 && (
                <Grid container spacing={3}>
                    {/* BARRA DE FILTROS */}
                    <Grid item xs={12}>
                        <Paper sx={{p:2, display:'flex', gap:3, alignItems:'center', borderRadius:2, mb:1}}>
                            <Box display="flex" alignItems="center" gap={1} color="text.secondary">
                                <FilterIcon />
                                <Typography fontWeight="bold">Filtros:</Typography>
                            </Box>
                            
                            <FormControl size="small" sx={{minWidth:220}}>
                                <InputLabel>Avaliador</InputLabel>
                                <Select value={evaluatorFilter} label="Avaliador" onChange={e => setEvaluatorFilter(e.target.value)}>
                                    <MenuItem value="all">Todos os Avaliadores</MenuItem>
                                    {processedData.evaluators.map(ev => <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>)}
                                </Select>
                            </FormControl>

                            <FormControl size="small" sx={{minWidth:220}}>
                                <InputLabel>Pilar de Análise</InputLabel>
                                <Select value={selectedPillar} label="Pilar de Análise" onChange={e => setSelectedPillar(e.target.value)}>
                                    <MenuItem value="FINAL">Média Geral (Ranking)</MenuItem>
                                    <MenuItem value="TRIAGEM">1. Triagem / Requisitos</MenuItem>
                                    <MenuItem value="CULTURA">2. Fit Cultural</MenuItem>
                                    <MenuItem value="TECNICO">3. Teste Técnico</MenuItem>
                                </Select>
                            </FormControl>
                        </Paper>
                    </Grid>

                    <Grid item xs={12} md={7}>
                        <Paper sx={{ p: 3, height: '500px', display: 'flex', flexDirection: 'column' }} elevation={3}>
                            <Box sx={{ mb: 2, borderBottom: '1px solid #f0f0f0' }}>
                                <Typography variant="h6" color="text.primary" fontWeight="bold">Ranking ({selectedPillar})</Typography>
                            </Box>
                            
                            {processedData.chartData.length > 0 ? (
                                <Box sx={{ flex: 1, width: '100%', minHeight: 0 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart 
                                            data={processedData.chartData.slice(0, 10)} 
                                            layout="vertical" 
                                            margin={{ top: 10, right: 30, left: 10, bottom: 5 }} 
                                            barGap={4}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#eee" />
                                            <XAxis type="number" domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} stroke="#999" />
                                            <YAxis dataKey="name" type="category" width={100} style={{fontSize: '0.8rem', fontWeight: 500, fill: '#444'}} />
                                            <Tooltip cursor={{fill: '#f5f5f5'}} contentStyle={{ borderRadius: 8 }} />
                                            <Legend />
                                            <Bar dataKey="displayScore" name={`Nota ${selectedPillar}`} fill="#3b82f6" barSize={25} radius={[0, 4, 4, 0]}>
                                                <LabelList dataKey="displayScore" position="right" style={{fontSize:'0.8rem', fontWeight:'bold', fill:'#333'}} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </Box>
                            ) : (
                                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Typography color="text.secondary">Sem dados para exibir.</Typography>
                                </Box>
                            )}
                        </Paper>
                    </Grid>

                    {/* GRÁFICO RADAR (COMPARATIVO) */}
                    <Grid item xs={12} md={5}>
                        <Paper sx={{ p: 3, height: '500px', display: 'flex', flexDirection: 'column' }} elevation={3}>
                            <Box sx={{ mb: 2, borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="h6" fontWeight="bold">Perfil Ideal vs Média</Typography>
                                <Chip label="Radar" size="small" />
                            </Box>

                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                    <PolarGrid />
                                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#666', fontSize: 12 }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} />
                                    
                                    <Radar 
                                        name="Média Candidatos" 
                                        dataKey="Media" 
                                        stroke="#3b82f6" 
                                        fill="#3b82f6" 
                                        fillOpacity={0.4} 
                                    />
                                    <Radar 
                                        name="Perfil Ideal" 
                                        dataKey="Ideal" 
                                        stroke="#000000" 
                                        strokeWidth={3} 
                                        strokeDasharray="5 5" 
                                        fillOpacity={0} 
                                    />
                                    <Legend />
                                    <Tooltip />
                                </RadarChart>
                            </ResponsiveContainer>
                        </Paper>
                    </Grid>
                </Grid>
            )}

            {/* TAB 2: CONFIGURAÇÕES */}
            {tabValue === 2 && (
                <Box p={3} sx={{ bgcolor: 'white', borderRadius: 1, boxShadow: 1 }}>
                    <Paper variant="outlined" sx={{p:3, mb:3}}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>1. Triagem</Typography>
                        <ParametersSection criteria={parameters?.triagem || []} onCriteriaChange={(c) => setParameters({...parameters, triagem: c})} />
                    </Paper>
                    <Paper variant="outlined" sx={{p:3, mb:3}}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>2. Fit Cultural</Typography>
                        <ParametersSection criteria={parameters?.cultura || []} onCriteriaChange={(c) => setParameters({...parameters, cultura: c})} />
                    </Paper>
                    <Paper variant="outlined" sx={{p:3, mb:3}}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>3. Teste Técnico</Typography>
                        <ParametersSection criteria={parameters?.tecnico || parameters?.['técnico'] || []} onCriteriaChange={(c) => setParameters({...parameters, tecnico: c})} />
                    </Paper>
        
                    <Paper variant="outlined" sx={{p:3, mb:3, borderColor: 'orange'}}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="orange">4. Régua de Notas</Typography>
                        <RatingScaleSection 
                            notes={parameters?.notas || []} 
                            onNotesChange={(n) => setParameters({...parameters, notas: n})} 
                        />
                    </Paper>

                    <Box display="flex" justifyContent="flex-end">
                        <Button 
                            variant="contained" 
                            color="primary" 
                            onClick={handleSaveParameters}
                            disabled={saving}
                            startIcon={<SaveIcon />} 
                        >
                            {saving ? 'Salvando...' : 'Salvar Configurações'}
                        </Button>
                    </Box>
                </Box>
            )}
        </Container>
        <CopyParametersModal open={isCopyModalOpen} onClose={() => setIsCopyModalOpen(false)} currentJobId={jobId} onCopy={(p) => { setParameters(p); setFeedback({open:true, message:'Copiado!', severity:'info'}); }} />
        <Snackbar open={feedback.open} autoHideDuration={4000} onClose={() => setFeedback({...feedback, open:false})}><Alert severity={feedback.severity} variant="filled">{feedback.message}</Alert></Snackbar>
    </Box>
  );
}