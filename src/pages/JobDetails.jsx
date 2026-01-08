import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { 
    Container, Typography, Box, AppBar, Toolbar, Button, CircularProgress, 
    Paper, Tabs, Tab, TextField, IconButton, Snackbar,
    List, ListItem, ListItemText, Divider, Grid,
    Table, TableHead, TableRow, TableCell, TableBody, 
    FormControl, InputLabel, Select, MenuItem, Chip, Modal, Alert, Switch, Tooltip as MuiTooltip, Card, CardContent
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
    EmojiEvents as TrophyIcon
} from '@mui/icons-material';
import { processEvaluation } from '../utils/evaluationLogic';

// --- ESTILOS AUXILIARES ---
const modalStyle = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 600, bgcolor: 'background.paper', boxShadow: 24, p: 4, borderRadius: 2 };

// --- COMPONENTE MODAL DE CÓPIA ---
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
              <Typography variant="h6" fontWeight="bold" mb={2}>Copiar Critérios de Outra Vaga</Typography>
              <FormControl fullWidth margin="normal">
                  <InputLabel>Selecionar Vaga de Origem</InputLabel>
                  <Select value={selectedJobId} onChange={e=>setSelectedJobId(e.target.value)} label="Selecionar Vaga de Origem">
                      {jobs.map(j=><MenuItem key={j.id} value={j.id}>{j.title}</MenuItem>)}
                  </Select>
              </FormControl>
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                  <Button onClick={onClose} color="inherit">Cancelar</Button>
                  <Button onClick={handleConfirm} variant="contained" color="primary" disabled={!selectedJobId}>Copiar Dados</Button>
              </Box>
          </Box>
      </Modal> 
  );
};

// --- COMPONENTE DE SEÇÃO DE CRITÉRIOS ---
const ParametersSection = ({ criteria = [], onCriteriaChange }) => {
  const handleChange = (i, f, v) => { const n = [...criteria]; n[i] = { ...n[i], [f]: f==='weight'?Number(v):v }; onCriteriaChange(n); };
  const total = criteria.reduce((acc, c) => acc + (Number(c.weight)||0), 0);
  return (
    <Box sx={{mt:2, bgcolor: '#f8f9fa', p: 2, borderRadius: 2}}>
        {criteria.map((c, i) => (
            <Box key={i} display="flex" gap={2} mb={1} alignItems="center">
                <TextField 
                    value={c.name} 
                    onChange={e=>handleChange(i,'name',e.target.value)} 
                    fullWidth 
                    size="small" 
                    label={`Critério #${i+1}`}
                    variant="outlined"
                    sx={{ bgcolor: 'white' }}
                />
                <TextField 
                    type="number" 
                    value={c.weight} 
                    onChange={e=>handleChange(i,'weight',e.target.value)} 
                    sx={{width:120, bgcolor: 'white'}} 
                    size="small" 
                    label="Peso %" 
                />
                <IconButton onClick={()=>onCriteriaChange(criteria.filter((_,idx)=>idx!==i))} color="error" size="small"><DeleteIcon/></IconButton>
            </Box>
        ))}
        <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
            <Button onClick={()=>onCriteriaChange([...criteria, {name:'', weight:0}])} variant="outlined" size="small" startIcon={<AddIcon />}>Adicionar Critério</Button>
            <Typography color={total===100?'success.main':'error.main'} variant="body2" fontWeight="bold">Total: {total}% {total!==100 && '(Deve ser 100%)'}</Typography>
        </Box>
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
        <Box sx={{ mt: 2, bgcolor: '#fff3e0', p: 2, borderRadius: 2 }}>
            {notes.map((n, i) => (
                <Box key={n.id || i} display="flex" gap={2} mb={1} alignItems="center">
                    <TextField value={n.nome} onChange={(e) => handleChange(i, 'nome', e.target.value)} fullWidth size="small" label="Rótulo (Ex: Supera)" sx={{bgcolor: 'white'}} />
                    <TextField type="number" value={n.valor} onChange={(e) => handleChange(i, 'valor', e.target.value)} sx={{ width: 120, bgcolor: 'white' }} size="small" label="Valor (0-100)" />
                    <IconButton onClick={() => handleRemove(i)} color="error"><DeleteIcon /></IconButton>
                </Box>
            ))}
            <Button onClick={handleAdd} variant="outlined" color="warning" size="small" startIcon={<AddIcon />}>Adicionar Nível</Button>
        </Box>
    );
};

// --- PÁGINA PRINCIPAL ---
export default function JobDetails() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [parameters, setParameters] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tabValue, setTabValue] = useState(1); // Inicia na aba de Classificação para UX imediata
  const [applicants, setApplicants] = useState([]);
  const [allEvaluations, setAllEvaluations] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [evaluatorFilter, setEvaluatorFilter] = useState('all');
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'success' });

  // Busca dados iniciais
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const { data: jobData } = await supabase.from('jobs').select('*').eq('id', jobId).single();
        setJob(jobData);
        setParameters(jobData.parameters || { 
            triagem: [], cultura: [], tecnico: [], 
            notas: [{id:'1',nome:'Abaixo',valor:0}, {id:'2',nome:'Atende',valor:50}, {id:'3',nome:'Supera',valor:100}] 
        });

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

  // Processamento de Dados para Gráficos e Tabelas
  const processedData = useMemo(() => {
    if (!parameters) return { chartData: [], evaluators: [] };

    const evaluators = Object.keys(usersMap).map(id => ({ id, name: usersMap[id] || 'Desconhecido' }));

    let chartData = applicants.map(app => {
        const appEvals = allEvaluations.filter(e => 
            String(e.application_id) === String(app.id) && 
            (evaluatorFilter === 'all' || e.evaluator_id === evaluatorFilter)
        );

        let sumT = 0, sumC = 0, sumTc = 0, count = 0, sumTotal = 0;
        appEvals.forEach(ev => {
            const scores = processEvaluation(ev, parameters);
            if (scores.total > 0 || scores.triagem > 0 || scores.cultura > 0 || scores.tecnico > 0) {
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
            triagem: Number(avgT.toFixed(1)),
            cultura: Number(avgC.toFixed(1)),
            tecnico: Number(avgTc.toFixed(1)),
            total: Number(general.toFixed(1)),
            count: count,
            hired: app.isHired,
            isIdeal: false
        };
    });

    // --- LÓGICA DO CANDIDATO IDEAL (BENCHMARK) ---
    // Adiciona o candidato ideal na lista se estiver na aba de classificação
    const idealCandidate = {
        appId: 'ideal-benchmark',
        name: 'Candidato Ideal (Meta)',
        email: 'benchmark@sistema',
        triagem: 100,
        cultura: 100,
        tecnico: 100,
        total: 100,
        count: 1,
        hired: false,
        isIdeal: true
    };
    
    // Adiciona o ideal no topo para comparação
    chartData = [idealCandidate, ...chartData];

    // Ordena: Ideal primeiro (fixo), depois por nota decrescente
    chartData.sort((a, b) => {
        if (a.isIdeal) return -1;
        if (b.isIdeal) return 1;
        return b.total - a.total;
    });

    return { chartData, evaluators };
  }, [applicants, allEvaluations, evaluatorFilter, parameters, usersMap]);

  const handleHireToggle = async (appId, currentStatus) => {
      const newStatus = !currentStatus;
      setApplicants(prev => prev.map(a => a.id === appId ? {...a, isHired: newStatus} : a));
      
      const { error } = await supabase.from('applications').update({ isHired: newStatus }).eq('id', appId);
      
      if (error) {
          alert("Erro ao atualizar status: " + error.message);
      } else {
          setFeedback({ 
              open: true, 
              message: newStatus ? 'Candidato marcado como CONTRATADO!' : 'Status de contratação removido.', 
              severity: newStatus ? 'success' : 'info' 
          });
      }
  };

  const handleSaveParameters = async () => {
      setSaving(true);
      await supabase.from('jobs').update({ parameters }).eq('id', jobId);
      setSaving(false);
      setFeedback({ open: true, message: 'Configurações salvas com sucesso!', severity: 'success' });
  };

  const jumpToSettings = () => setTabValue(2);

  if (loading) return <Box p={10} display="flex" flexDirection="column" alignItems="center"><CircularProgress size={60} /><Typography mt={2}>Carregando dados da vaga...</Typography></Box>;

  return (
    <Box sx={{ bgcolor: '#f4f6f8', minHeight: '100vh', pb: 8 }}>
        {/* HEADER */}
        <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: '1px solid #e0e0e0', bgcolor: 'white' }}>
            <Toolbar>
                <IconButton edge="start" color="inherit" onClick={() => navigate('/')} sx={{ mr: 2 }}>
                    <RouterLink to="/" style={{ color: 'inherit', display: 'flex' }}><ArrowIcon /></RouterLink> 
                </IconButton>
                <Typography variant="h6" sx={{flexGrow:1, fontWeight: 'bold', color: '#1a202c'}}>
                    {job?.title} <Chip label={job?.status === 'active' ? 'Ativa' : 'Inativa'} size="small" color={job?.status === 'active' ? 'success' : 'default'} sx={{ml: 1}}/>
                </Typography>
                <Button variant="outlined" component={RouterLink} to="/">Voltar ao Dashboard</Button>
            </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ mt: 4 }}>
            <Paper sx={{ mb: 3, borderRadius: 2 }}>
                <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} centered indicatorColor="primary" textColor="primary">
                    <Tab label={`Candidatos (${applicants.length})`} />
                    <Tab label="Classificação & Ranking" icon={<TrophyIcon />} iconPosition="start" />
                    <Tab label="Configuração da Vaga" />
                </Tabs>
            </Paper>
            
            {/* ABA 0: LISTA SIMPLES */}
            {tabValue === 0 && (
                <Paper sx={{ p: 0, borderRadius: 2, overflow: 'hidden' }} elevation={1}>
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
                                    <TableCell sx={{fontWeight:500}}>{d.name}</TableCell>
                                    <TableCell>{d.email}</TableCell>
                                    <TableCell align="center">{d.hired ? <Chip label="Contratado" color="success" size="small" icon={<CheckCircleIcon/>}/> : <Chip label="Em análise" size="small"/>}</TableCell>
                                    <TableCell align="center"><Chip label={d.count} size="small" variant="outlined" /></TableCell>
                                    <TableCell align="center">
                                        <Chip label={d.total.toFixed(1)} color={d.total >= 80 ? 'success' : d.total >= 50 ? 'warning' : 'error'} variant={d.count > 0 ? 'filled' : 'outlined'} fontWeight="bold"/>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {processedData.chartData.length <= 1 && (
                                <TableRow><TableCell colSpan={5} align="center" sx={{py: 4, color: 'text.secondary'}}>Nenhum candidato inscrito ainda.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </Paper>
            )}

            {/* ABA 1: CLASSIFICAÇÃO & DASHBOARD (REFORMULADA) */}
            {tabValue === 1 && (
                <Grid container spacing={3}>
                    {/* COLUNA ESQUERDA: RANKING */}
                    <Grid item xs={12} md={5} lg={4}>
                        <Paper sx={{ height: '100%', maxHeight: '800px', display: 'flex', flexDirection: 'column', borderRadius: 2 }} elevation={2}>
                            <Box sx={{ p: 2.5, bgcolor: '#1e293b', color: 'white', borderTopLeftRadius: 8, borderTopRightRadius: 8, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TrophyIcon sx={{ color: '#fbbf24' }} />
                                <Typography variant="h6" fontWeight="bold">Ranking Final</Typography>
                            </Box>
                            
                            <Box sx={{ p: 2, bgcolor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                                <FormControl fullWidth size="small" sx={{ bgcolor: 'white', borderRadius: 1 }}>
                                    <InputLabel>Filtrar por Avaliador</InputLabel>
                                    <Select value={evaluatorFilter} label="Filtrar por Avaliador" onChange={(e) => setEvaluatorFilter(e.target.value)}>
                                        <MenuItem value="all">Média de Todos os Avaliadores</MenuItem>
                                        {processedData.evaluators.map(ev => <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            </Box>

                            <List sx={{ overflowY: 'auto', flex: 1, p: 0 }}>
                                {processedData.chartData.map((d, index) => {
                                    const isWinner = index === 1 && !d.isIdeal; // Primeiro real (após o ideal)
                                    
                                    if (d.isIdeal) {
                                        return (
                                            <React.Fragment key="ideal">
                                                <ListItem button onClick={jumpToSettings} sx={{ bgcolor: '#fff7ed', borderBottom: '1px dashed #fdba74' }}>
                                                    <Box sx={{ mr: 2, color: 'orange' }}><StarIcon /></Box>
                                                    <ListItemText 
                                                        primary={<Typography variant="body2" fontWeight="bold" color="orange">Candidato Ideal (Benchmark)</Typography>}
                                                        secondary="Clique para editar critérios"
                                                    />
                                                    <Chip label="100.0" size="small" sx={{ bgcolor: 'orange', color: 'white', fontWeight: 'bold' }} />
                                                </ListItem>
                                            </React.Fragment>
                                        )
                                    }

                                    return (
                                        <React.Fragment key={d.appId}>
                                            <ListItem 
                                                alignItems="flex-start"
                                                sx={{ 
                                                    bgcolor: d.hired ? '#f0fdf4' : 'white', 
                                                    borderLeft: d.hired ? '6px solid #22c55e' : isWinner ? '6px solid #fbbf24' : '6px solid transparent',
                                                    transition: 'all 0.2s',
                                                    '&:hover': { bgcolor: '#f8fafc' }
                                                }}
                                                secondaryAction={
                                                    <Box display="flex" flexDirection="column" alignItems="center" gap={1}>
                                                        <Typography variant="h6" fontWeight="bold" color={d.total >= 80 ? 'success.main' : 'text.primary'}>
                                                            {d.total.toFixed(1)}
                                                        </Typography>
                                                        <Switch 
                                                            size="small"
                                                            checked={d.hired || false}
                                                            onChange={() => handleHireToggle(d.appId, d.hired)}
                                                            color="success"
                                                        />
                                                        <Typography variant="caption" sx={{fontSize: '0.6rem'}} color={d.hired ? 'success.main' : 'text.disabled'}>
                                                            {d.hired ? 'CONTRATADO' : 'CONTRATAR'}
                                                        </Typography>
                                                    </Box>
                                                }
                                            >
                                                <ListItemText 
                                                    primary={
                                                        <Box display="flex" alignItems="center" gap={1}>
                                                            <Typography variant="body1" fontWeight="bold" color="text.primary">
                                                                #{index} {d.name}
                                                            </Typography>
                                                            {isWinner && <TrophyIcon sx={{ fontSize: 16, color: '#fbbf24' }} />}
                                                        </Box>
                                                    }
                                                    secondary={
                                                        <Box mt={0.5}>
                                                            <Typography variant="caption" display="block" color="text.secondary">{d.email}</Typography>
                                                            <Box display="flex" gap={1} mt={0.5}>
                                                                <Chip label={`Triagem: ${d.triagem.toFixed(0)}`} size="small" sx={{height: 20, fontSize: '0.65rem'}} variant="outlined"/>
                                                                <Chip label={`Téc: ${d.tecnico.toFixed(0)}`} size="small" sx={{height: 20, fontSize: '0.65rem'}} variant="outlined"/>
                                                                <Chip label={`Cult: ${d.cultura.toFixed(0)}`} size="small" sx={{height: 20, fontSize: '0.65rem'}} variant="outlined"/>
                                                            </Box>
                                                        </Box>
                                                    } 
                                                />
                                            </ListItem>
                                            <Divider component="li" />
                                        </React.Fragment>
                                    );
                                })}
                                {processedData.chartData.length <= 1 && (
                                    <Box p={4} textAlign="center" color="text.secondary">
                                        <Typography variant="body2">Aguardando candidatos...</Typography>
                                    </Box>
                                )}
                            </List>
                        </Paper>
                    </Grid>

                    {/* COLUNA DIREITA: VISUALIZAÇÃO GRÁFICA */}
                    <Grid item xs={12} md={7} lg={8}>
                        <Grid container spacing={3}>
                            
                            {/* 1. GRÁFICO RADAR (ANÁLISE DE PERFIL) */}
                            <Grid item xs={12}>
                                <Paper sx={{ p: 3, borderRadius: 2, height: '450px', position: 'relative' }} elevation={2}>
                                    <Typography variant="h6" fontWeight="bold" color="#1e293b" mb={2}>Análise de Perfil (Radar)</Typography>
                                    {processedData.chartData.length > 1 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                                                { subject: 'Triagem', ideal: 100, media: 0, ...processedData.chartData.slice(1).reduce((acc, curr, i) => ({ ...acc, [`c${i}`]: curr.triagem }), {}) },
                                                { subject: 'Cultura', ideal: 100, media: 0, ...processedData.chartData.slice(1).reduce((acc, curr, i) => ({ ...acc, [`c${i}`]: curr.cultura }), {}) },
                                                { subject: 'Técnico', ideal: 100, media: 0, ...processedData.chartData.slice(1).reduce((acc, curr, i) => ({ ...acc, [`c${i}`]: curr.tecnico }), {}) },
                                            ]}>
                                                <PolarGrid />
                                                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontWeight: 'bold', fontSize: 14 }} />
                                                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                                                
                                                {/* Candidato Ideal (Fixo) */}
                                                <Radar name="Candidato Ideal" dataKey="ideal" stroke="#fbbf24" strokeWidth={3} fill="#fbbf24" fillOpacity={0.1} />
                                                
                                                {/* Top 3 Candidatos */}
                                                {processedData.chartData.slice(1, 4).map((c, i) => (
                                                    <Radar 
                                                        key={c.appId} 
                                                        name={c.name} 
                                                        dataKey={`c${i}`} 
                                                        stroke={['#3b82f6', '#10b981', '#8b5cf6'][i]} 
                                                        strokeWidth={2} 
                                                        fill={['#3b82f6', '#10b981', '#8b5cf6'][i]} 
                                                        fillOpacity={0.3} 
                                                    />
                                                ))}
                                                <Legend />
                                                <Tooltip 
                                                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                />
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <Box display="flex" alignItems="center" justifyContent="center" height="100%" color="text.secondary">
                                            <Typography>Dados insuficientes para o Radar.</Typography>
                                        </Box>
                                    )}
                                    {/* Botão de Atalho para Editar Ideal */}
                                    <Button 
                                        size="small" 
                                        onClick={jumpToSettings}
                                        sx={{ position: 'absolute', top: 20, right: 20 }} 
                                        startIcon={<EditIcon/>}
                                    >
                                        Ajustar Ideal
                                    </Button>
                                </Paper>
                            </Grid>

                            {/* 2. GRÁFICO DE BARRAS (COMPARATIVO GERAL) */}
                            <Grid item xs={12}>
                                <Paper sx={{ p: 3, borderRadius: 2, minHeight: '500px' }} elevation={2}>
                                    <Typography variant="h6" fontWeight="bold" color="#1e293b" mb={3}>Comparativo Geral (Pontuação)</Typography>
                                    {processedData.chartData.length > 0 ? (
                                        <Box sx={{ height: Math.max(500, processedData.chartData.length * 60) }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart 
                                                    data={processedData.chartData} 
                                                    layout="vertical" 
                                                    margin={{ top: 10, right: 50, left: 10, bottom: 5 }} 
                                                    barGap={6}
                                                    barSize={32} /* BARRAS MAIS LARGAS */
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                                                    <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" />
                                                    <YAxis 
                                                        dataKey="name" 
                                                        type="category" 
                                                        width={180} 
                                                        tick={{fontSize: 12, fontWeight: 600, fill: '#334155'}} 
                                                    />
                                                    <Tooltip 
                                                        cursor={{fill: '#f1f5f9'}}
                                                        contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                                    />
                                                    <Legend verticalAlign="top" height={36}/>
                                                    
                                                    <Bar dataKey="triagem" name="Triagem" fill="#93c5fd" stackId="a" radius={[4, 0, 0, 4]} />
                                                    <Bar dataKey="cultura" name="Fit Cultural" fill="#86efac" stackId="a" />
                                                    <Bar dataKey="tecnico" name="Técnico" fill="#fca5a5" stackId="a" radius={[0, 4, 4, 0]}>
                                                        <LabelList dataKey="total" position="right" style={{fontWeight: 'bold', fill: '#0f172a'}} formatter={(val) => val.toFixed(1)} />
                                                    </Bar>

                                                    <ReferenceLine x={50} stroke="#94a3b8" strokeDasharray="3 3" label={{ position: 'top', value: 'Média (50)', fill: '#94a3b8', fontSize: 10 }} />
                                                    <ReferenceLine x={80} stroke="#22c55e" strokeDasharray="3 3" label={{ position: 'top', value: 'Meta (80)', fill: '#22c55e', fontSize: 10 }} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </Box>
                                    ) : (
                                        <Typography align="center" color="text.secondary" py={10}>Sem dados para exibir.</Typography>
                                    )}
                                </Paper>
                            </Grid>
                        </Grid>
                    </Grid>
                </Grid>
            )}

            {/* ABA 2: CONFIGURAÇÕES (CRITÉRIOS) */}
            {tabValue === 2 && (
                <Box p={3} sx={{ bgcolor: 'white', borderRadius: 2, boxShadow: 1, maxWidth: '1000px', mx: 'auto' }}>
                    <Box display="flex" justifyContent="space-between" mb={3}>
                        <Typography variant="h5" fontWeight="bold">Configuração de Critérios</Typography>
                        <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={() => setIsCopyModalOpen(true)}>Importar de Outra Vaga</Button>
                    </Box>

                    <Paper variant="outlined" sx={{p:3, mb:3, borderColor: '#e2e8f0'}}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="primary">1. Triagem (RH)</Typography>
                        <Typography variant="caption" color="text.secondary">Critérios eliminatórios e básicos.</Typography>
                        <ParametersSection criteria={parameters?.triagem || []} onCriteriaChange={(c) => setParameters({...parameters, triagem: c})} />
                    </Paper>

                    <Paper variant="outlined" sx={{p:3, mb:3, borderColor: '#e2e8f0'}}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="success.main">2. Fit Cultural (Comportamental)</Typography>
                        <Typography variant="caption" color="text.secondary">Alinhamento com valores da empresa.</Typography>
                        <ParametersSection criteria={parameters?.cultura || []} onCriteriaChange={(c) => setParameters({...parameters, cultura: c})} />
                    </Paper>

                    <Paper variant="outlined" sx={{p:3, mb:3, borderColor: '#e2e8f0'}}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="info.main">3. Teste Técnico (Hard Skills)</Typography>
                        <Typography variant="caption" color="text.secondary">Avaliação técnica específica da função.</Typography>
                        <ParametersSection criteria={parameters?.tecnico || parameters?.['técnico'] || []} onCriteriaChange={(c) => setParameters({...parameters, tecnico: c})} />
                    </Paper>
                    
                    <Paper variant="outlined" sx={{p:3, mb:3, borderColor: 'orange', bgcolor: '#fffaf0'}}>
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <StarIcon sx={{color: 'orange'}} />
                            <Typography variant="subtitle1" fontWeight="bold" color="orange">4. Régua de Notas</Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                            Defina os nomes e valores (0 a 100) que aparecerão nos botões de avaliação.
                        </Typography>
                        <RatingScaleSection 
                            notes={parameters?.notas || []} 
                            onNotesChange={(n) => setParameters({...parameters, notas: n})} 
                        />
                    </Paper>

                    <Box display="flex" justifyContent="flex-end" pt={2}>
                        <Button 
                            variant="contained" 
                            color="primary" 
                            size="large"
                            onClick={handleSaveParameters}
                            disabled={saving}
                            startIcon={<SaveIcon />}
                            sx={{ px: 5, py: 1.5, fontWeight: 'bold' }} 
                        >
                            {saving ? 'Salvando...' : 'Salvar Todas Configurações'}
                        </Button>
                    </Box>
                </Box>
            )}
        </Container>
        
        <CopyParametersModal open={isCopyModalOpen} onClose={() => setIsCopyModalOpen(false)} currentJobId={jobId} onCopy={(p) => { setParameters(p); setFeedback({open:true, message:'Copiado!', severity:'info'}); }} />
        <Snackbar open={feedback.open} autoHideDuration={4000} onClose={() => setFeedback({...feedback, open:false})}><Alert severity={feedback.severity} variant="filled">{feedback.message}</Alert></Snackbar>

        {/* Componente simples de Icon para o Header */}
        function ArrowIcon() { return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg> }
    </Box>
  );
}