import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { 
    Container, Typography, Box, AppBar, Toolbar, Button, CircularProgress, 
    Paper, Tabs, Tab, TextField, IconButton, Snackbar,
    List, ListItem, ListItemText, Divider, Grid,
    Table, TableHead, TableRow, TableCell, TableBody, 
    FormControl, InputLabel, Select, MenuItem, Chip, Modal, Alert, Switch,
    ToggleButton, ToggleButtonGroup
} from '@mui/material';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, LabelList,
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis 
} from 'recharts';
import { 
    Delete as DeleteIcon, 
    Save as SaveIcon,
    Add as AddIcon,
    Star as StarIcon,
    CheckCircle as CheckCircleIcon,
    Edit as EditIcon,
    EmojiEvents as TrophyIcon,
    FilterList as FilterIcon
} from '@mui/icons-material';
import { processEvaluation } from '../utils/evaluationLogic';
import EvaluationForm from '../components/EvaluationForm'; // Certifique-se que o caminho está correto

// --- ÍCONE SVG ---
const ArrowIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
);

const modalStyle = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 600, bgcolor: 'background.paper', boxShadow: 24, p: 4, borderRadius: 2 };
const formModalStyle = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '90%', maxWidth: 800, height: '85vh', bgcolor: 'background.paper', boxShadow: 24, p: 0, borderRadius: 2, overflow: 'hidden' };

// --- CONFIG DE CRITÉRIOS (REUTILIZADA) ---
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
  const [evaluatorFilter, setEvaluatorFilter] = useState('all');
  const [metricFilter, setMetricFilter] = useState('total'); // FILTRO DE PILARES RESTAURADO
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'success' });
  const [isIdealModalOpen, setIsIdealModalOpen] = useState(false); // Modal para editar o ideal

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const { data: jobData } = await supabase.from('jobs').select('*').eq('id', jobId).single();
        setJob(jobData);
        setParameters(jobData.parameters || { 
            triagem: [], cultura: [], tecnico: [], 
            notas: [{id:'1',nome:'Abaixo',valor:0}, {id:'2',nome:'Atende',valor:5}, {id:'3',nome:'Supera',valor:10}] 
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

  // CÁLCULO E PROCESSAMENTO
  const processedData = useMemo(() => {
    if (!parameters) return { chartData: [], evaluators: [] };

    const evaluators = Object.keys(usersMap).map(id => ({ id, name: usersMap[id] || 'Desconhecido' }));

    // 1. Lógica do Candidato Ideal (Benchmark) - Item Central da Régua
    const sortedNotes = [...(parameters.notas || [])].sort((a, b) => Number(a.valor) - Number(b.valor));
    let centralNoteId = null;
    if (sortedNotes.length > 0) {
        // Se par (ex: 4), pega index 2 (o 3º item). Se impar (ex: 3), pega index 1 (o 2º item).
        const centerIndex = Math.floor(sortedNotes.length / 2);
        centralNoteId = sortedNotes[centerIndex]?.id;
    }

    // Monta o gabarito do Ideal: Todos os critérios recebem a nota central
    // A menos que já tenha sido editado e salvo no parameters.benchmark_scores
    const idealScores = parameters.benchmark_scores || { triagem: {}, cultura: {}, tecnico: {} };
    
    if (!parameters.benchmark_scores && centralNoteId) {
        ['triagem', 'cultura', 'tecnico'].forEach(sec => {
            if(!idealScores[sec]) idealScores[sec] = {};
            (parameters[sec] || []).forEach(crit => {
                idealScores[sec][crit.name] = centralNoteId;
            });
        });
    }

    // Calcula nota do Ideal usando os mesmos pesos
    const idealResults = processEvaluation({ scores: idealScores }, parameters);
    
    const idealCandidate = {
        appId: 'ideal',
        name: 'Candidato Ideal (Ref)',
        email: 'benchmark@sistema',
        triagem: idealResults.triagem,
        cultura: idealResults.cultura,
        tecnico: idealResults.tecnico,
        total: idealResults.total,
        count: 1,
        hired: false,
        isIdeal: true,
        rawScores: idealScores // Para passar para o formulário de edição
    };

    // 2. Processa Candidatos Reais
    let chartData = applicants.map(app => {
        // FILTRO DE AVALIADOR APLICADO AQUI
        const appEvals = allEvaluations.filter(e => 
            String(e.application_id) === String(app.id) && 
            (evaluatorFilter === 'all' || e.evaluator_id === evaluatorFilter)
        );

        let sumT = 0, sumC = 0, sumTc = 0, count = 0, sumTotal = 0;
        
        // Se não houver avaliações após filtro, retorna zerado
        if (appEvals.length > 0) {
            appEvals.forEach(ev => {
                const scores = processEvaluation(ev, parameters);
                // Considera válida se tiver alguma nota
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

    // Filtra candidatos sem avaliação se houver filtro de avaliador ativo (opcional, mas bom pra UX)
    if (evaluatorFilter !== 'all') {
        chartData = chartData.filter(c => c.count > 0);
    }

    // Adiciona o Ideal na lista para o gráfico e tabela
    chartData = [idealCandidate, ...chartData];

    // Ordenação baseada na métrica selecionada
    chartData.sort((a, b) => {
        if (a.isIdeal) return -1;
        if (b.isIdeal) return 1;
        // Ordena pelo filtro ativo (total, triagem, etc)
        const metric = metricFilter === 'Média Geral' ? 'total' : metricFilter.toLowerCase().replace('é', 'e').split(' ')[0]; 
        // Fallback simples
        const valA = a[metric] || a.total;
        const valB = b[metric] || b.total;
        return valB - valA;
    });

    return { chartData, evaluators, idealCandidate };
  }, [applicants, allEvaluations, evaluatorFilter, parameters, usersMap, metricFilter]);

  // AÇÕES
  const handleHireToggle = async (appId, currentStatus) => {
      const newStatus = !currentStatus;
      setApplicants(prev => prev.map(a => a.id === appId ? {...a, isHired: newStatus} : a));
      const { error } = await supabase.from('applications').update({ isHired: newStatus }).eq('id', appId);
      if (!error) {
          setFeedback({ open: true, message: newStatus ? 'Contratado!' : 'Descontratado.', severity: 'success' });
      }
  };

  const handleSaveParameters = async () => {
      setSaving(true);
      await supabase.from('jobs').update({ parameters }).eq('id', jobId);
      setSaving(false);
      setFeedback({ open: true, message: 'Configurações salvas!', severity: 'success' });
  };

  const handleSaveIdeal = async (evalData) => {
      // Salva as respostas do ideal DENTRO da vaga (não na tabela evaluations)
      const newParams = { ...parameters, benchmark_scores: evalData.scores };
      setParameters(newParams);
      const { error } = await supabase.from('jobs').update({ parameters: newParams }).eq('id', jobId);
      if (!error) {
        setFeedback({ open: true, message: 'Candidato Ideal atualizado!', severity: 'success' });
        setIsIdealModalOpen(false);
      }
  };

  // Função para pegar a cor da nota (Regra: >=8 Verde, >=5 Amarelo, <5 Padrão/Vermelho)
  const getScoreColor = (val) => {
      if (val >= 8) return 'success';
      if (val >= 5) return 'warning';
      return 'default'; // ou 'error' se quiser vermelho
  };

  // Define qual chave de dados usar no gráfico baseado no filtro
  const activeDataKey = useMemo(() => {
      switch(metricFilter) {
          case 'Triagem': return 'triagem';
          case 'Fit Cultural': return 'cultura';
          case 'Teste Técnico': return 'tecnico';
          default: return 'total';
      }
  }, [metricFilter]);

  if (loading) return <Box p={10} display="flex" justifyContent="center"><CircularProgress /></Box>;

  return (
    <Box sx={{ bgcolor: '#f4f6f8', minHeight: '100vh', pb: 8 }}>
        <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: '1px solid #e0e0e0', bgcolor: 'white' }}>
            <Toolbar>
                <IconButton edge="start" onClick={() => navigate('/')} sx={{ mr: 2 }}><ArrowIcon /></IconButton>
                <Typography variant="h6" sx={{flexGrow:1, fontWeight:'bold'}}>{job?.title}</Typography>
            </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ mt: 4 }}>
            <Paper sx={{ mb: 3, borderRadius: 2 }}>
                <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} centered>
                    <Tab label={`Candidatos (${applicants.length})`} />
                    <Tab label="Classificação & Ranking" icon={<TrophyIcon />} iconPosition="start" />
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
                            {processedData.chartData.filter(d => !d.isIdeal).map(d => (
                                <TableRow key={d.appId} hover component={RouterLink} to={`/applications/${d.appId}`} style={{textDecoration:'none', cursor:'pointer'}}>
                                    <TableCell>{d.name}</TableCell>
                                    <TableCell>{d.email}</TableCell>
                                    <TableCell align="center">{d.hired ? <Chip label="Contratado" color="success" size="small" icon={<CheckCircleIcon/>}/> : <Chip label="Em análise" size="small"/>}</TableCell>
                                    <TableCell align="center"><Chip label={d.count} size="small" variant="outlined" /></TableCell>
                                    <TableCell align="center">
                                        <Chip label={d.total.toFixed(1)} color={getScoreColor(d.total)} variant={d.count > 0 ? 'filled' : 'outlined'} fontWeight="bold"/>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Paper>
            )}

            {/* ABA 1: CLASSIFICAÇÃO */}
            {tabValue === 1 && (
                <Grid container spacing={3}>
                    {/* LATERAL ESQUERDA: LISTA DE RANKING + FILTROS */}
                    <Grid item xs={12} md={4}>
                        <Paper sx={{ height: '100%', maxHeight: '800px', display: 'flex', flexDirection: 'column', borderRadius: 2 }} elevation={2}>
                            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <Typography variant="subtitle2" color="text.secondary" mb={1} fontWeight="bold">FILTROS</Typography>
                                
                                {/* 1. FILTRO DE AVALIADOR (CORRIGIDO) */}
                                <FormControl fullWidth size="small" sx={{ mb: 2, bgcolor: 'white' }}>
                                    <InputLabel>Avaliador</InputLabel>
                                    <Select value={evaluatorFilter} label="Avaliador" onChange={(e) => setEvaluatorFilter(e.target.value)}>
                                        <MenuItem value="all">Todos (Média)</MenuItem>
                                        {processedData.evaluators.map(ev => <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>)}
                                    </Select>
                                </FormControl>

                                {/* 2. FILTRO DE PILARES (RESTAURADO) */}
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
                                    <ToggleButton value="Triagem">Triagem</ToggleButton>
                                    <ToggleButton value="Fit Cultural">Cult</ToggleButton>
                                    <ToggleButton value="Teste Técnico">Téc</ToggleButton>
                                </ToggleButtonGroup>
                            </Box>

                            <List sx={{ overflowY: 'auto', flex: 1 }}>
                                {processedData.chartData.map((d, index) => {
                                    // Valor a exibir baseado no filtro
                                    const displayValue = d[activeDataKey]?.toFixed(1);
                                    
                                    if (d.isIdeal) {
                                        return (
                                            <ListItem key="ideal" button onClick={() => setIsIdealModalOpen(true)} sx={{ bgcolor: '#fff7ed', borderBottom: '1px dashed orange' }}>
                                                <StarIcon sx={{ color: 'orange', mr: 1 }} />
                                                <ListItemText 
                                                    primary={<Typography variant="body2" fontWeight="bold" color="orange">Candidato Ideal</Typography>} 
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
                                                    <Box textAlign="right">
                                                        <Typography variant="h6" fontWeight="bold" color={getScoreColor(d[activeDataKey]) + '.main'}>{displayValue}</Typography>
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

                    {/* LATERAL DIREITA: GRÁFICOS */}
                    <Grid item xs={12} md={8}>
                        <Grid container spacing={3}>
                            {/* RADAR */}
                            <Grid item xs={12}>
                                <Paper sx={{ p: 3, height: '400px', borderRadius: 2 }} elevation={2}>
                                    <Typography variant="h6" mb={2}>Comparativo de Perfil (Radar)</Typography>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                                            { subject: 'Triagem', ideal: processedData.idealCandidate.triagem, media: 0, ...processedData.chartData.slice(1).reduce((acc, c, i) => ({...acc, [`c${i}`]: c.triagem}), {}) },
                                            { subject: 'Cultura', ideal: processedData.idealCandidate.cultura, media: 0, ...processedData.chartData.slice(1).reduce((acc, c, i) => ({...acc, [`c${i}`]: c.cultura}), {}) },
                                            { subject: 'Técnico', ideal: processedData.idealCandidate.tecnico, media: 0, ...processedData.chartData.slice(1).reduce((acc, c, i) => ({...acc, [`c${i}`]: c.tecnico}), {}) }
                                        ]}>
                                            <PolarGrid />
                                            <PolarAngleAxis dataKey="subject" />
                                            <PolarRadiusAxis angle={30} domain={[0, 10]} /> {/* ESCALA CORRIGIDA PARA 0-10 */}
                                            <Radar name="Ideal" dataKey="ideal" stroke="#ff9800" fill="#ff9800" fillOpacity={0.3} />
                                            {processedData.chartData.slice(1, 4).map((c, i) => (
                                                <Radar key={i} name={c.name} dataKey={`c${i}`} stroke="#8884d8" fill="#8884d8" fillOpacity={0.1} />
                                            ))}
                                            <Legend />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </Paper>
                            </Grid>

                            {/* BARRAS - LADO A LADO (CORRIGIDO) */}
                            <Grid item xs={12}>
                                <Paper sx={{ p: 3, height: '500px', borderRadius: 2 }} elevation={2}>
                                    <Typography variant="h6" mb={2}>Ranking por {metricFilter}</Typography>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart 
                                            data={processedData.chartData} 
                                            layout="vertical" 
                                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                            barSize={24} /* Tamanho fixo para legibilidade */
                                        >
                                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                            <XAxis type="number" domain={[0, 10]} hide />
                                            <YAxis dataKey="name" type="category" width={150} tick={{fontSize: 12}} />
                                            <Tooltip cursor={{fill: '#f5f5f5'}} />
                                            <Legend />
                                            
                                            {/* BARRA ÚNICA BASEADA NO FILTRO (NÃO EMPILHADA) */}
                                            <Bar dataKey={activeDataKey} name={metricFilter} fill="#8884d8" radius={[0, 4, 4, 0]}>
                                                <LabelList dataKey={activeDataKey} position="right" formatter={(v) => v.toFixed(1)} />
                                            </Bar>
                                            
                                            {/* LINHA DE REFERÊNCIA DO IDEAL */}
                                            <ReferenceLine x={processedData.idealCandidate[activeDataKey]} stroke="orange" label="Ideal" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </Paper>
                            </Grid>
                        </Grid>
                    </Grid>
                </Grid>
            )}

            {/* ABA 2: CONFIGURAÇÕES */}
            {tabValue === 2 && (
                <Box p={3} sx={{ bgcolor: 'white', borderRadius: 2 }}>
                    <Box display="flex" justifyContent="space-between" mb={2}>
                        <Typography variant="h6">Critérios de Avaliação</Typography>
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

        {/* MODAIS */}
        <CopyParametersModal open={isCopyModalOpen} onClose={() => setIsCopyModalOpen(false)} currentJobId={jobId} onCopy={(p) => { setParameters(p); setFeedback({open:true, message:'Copiado!', severity:'info'}); }} />
        
        {/* MODAL EDITAR IDEAL */}
        <Modal open={isIdealModalOpen} onClose={() => setIsIdealModalOpen(false)}>
            <Box sx={formModalStyle}>
                <Box p={2} borderBottom="1px solid #eee" display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">Editar Avaliação do Candidato Ideal</Typography>
                    <Button onClick={() => setIsIdealModalOpen(false)}>Fechar</Button>
                </Box>
                <Box p={2} sx={{ height: 'calc(100% - 60px)', overflowY: 'auto' }}>
                     <EvaluationForm 
                        jobParameters={parameters} 
                        initialData={{ scores: processedData.idealCandidate.rawScores }} // Passa as notas atuais
                        customSubmit={handleSaveIdeal} // Salva no JSON da vaga, não no banco
                     />
                </Box>
            </Box>
        </Modal>

        <Snackbar open={feedback.open} autoHideDuration={4000} onClose={() => setFeedback({...feedback, open:false})}><Alert severity={feedback.severity} variant="filled">{feedback.message}</Alert></Snackbar>
    </Box>
  );
}