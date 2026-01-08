import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
// IMPORTAÇÕES COMPLETAS DO MATERIAL UI (Mantendo padrão existente)
import { 
    Container, Typography, Box, AppBar, Toolbar, Button, CircularProgress, 
    Paper, Tabs, Tab, TextField, IconButton, Snackbar,
    List, ListItem, ListItemText, Divider, Grid,
    Table, TableHead, TableRow, TableCell, TableBody, Checkbox,
    FormControl, InputLabel, Select, MenuItem, Chip, Modal, Alert, Avatar
} from '@mui/material';
// IMPORTAÇÕES DOS GRÁFICOS (RECHARTS) - Incluindo RadarChart agora
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList,
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis 
} from 'recharts';
// ÍCONES
import { 
    Delete as DeleteIcon, Save as SaveIcon, Add as AddIcon,
    Star as StarIcon, FilterList as FilterIcon
} from '@mui/icons-material';
import { Share2, MapPin, Briefcase, Calendar, ArrowLeft } from 'lucide-react'; 
import { processEvaluation } from '../utils/evaluationLogic';
import CopyParametersModal from '../components/jobs/CopyParametersModal';

// --- COMPONENTES AUXILIARES INTERNOS (NÃO REMOVIDOS) ---

const ParametersSection = ({ criteria = [], onCriteriaChange }) => {
  const handleChange = (i, field, value) => { 
      const newCriteria = [...criteria]; 
      newCriteria[i] = { ...newCriteria[i], [field]: field === 'weight' ? Number(value) : value }; 
      onCriteriaChange(newCriteria); 
  };
  
  const totalWeight = criteria.reduce((acc, c) => acc + (Number(c.weight) || 0), 0);

  return (
    <Box sx={{ mt: 2 }}>
        {criteria.map((c, i) => (
            <Box key={i} display="flex" gap={2} mb={2} alignItems="center">
                <TextField 
                    value={c.name} 
                    onChange={(e) => handleChange(i, 'name', e.target.value)} 
                    fullWidth 
                    size="small" 
                    label="Nome do Critério" 
                    variant="outlined"
                />
                <TextField 
                    type="number" 
                    value={c.weight} 
                    onChange={(e) => handleChange(i, 'weight', e.target.value)} 
                    sx={{ width: 120 }} 
                    size="small" 
                    label="Peso (%)" 
                    variant="outlined"
                />
                <IconButton onClick={() => onCriteriaChange(criteria.filter((_, idx) => idx !== i))} color="error" size="small">
                    <DeleteIcon />
                </IconButton>
            </Box>
        ))}
        <Box display="flex" alignItems="center" justifyContent="space-between" mt={1}>
            <Button 
                onClick={() => onCriteriaChange([...criteria, { name: '', weight: 0 }])} 
                variant="outlined" 
                size="small" 
                startIcon={<AddIcon />}
            >
                Adicionar Critério
            </Button>
            <Typography 
                color={totalWeight === 100 ? 'success.main' : 'error.main'} 
                variant="caption" 
                display="block" 
                sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}
            >
                Total: {totalWeight}%
            </Typography>
        </Box>
    </Box>
  );
};

const RatingScaleSection = ({ scale = [], onScaleChange }) => {
    const handleChange = (id, field, value) => { 
        const newScale = scale.map(s => s.id === id ? { ...s, [field]: field === 'valor' ? Number(value) : value } : s); 
        onScaleChange(newScale); 
    };
    
    return (
        <Box sx={{ mt: 2 }}>
            {scale.map((s) => (
                <Box key={s.id} display="flex" gap={2} mb={2} alignItems="center">
                    <TextField 
                        value={s.nome} 
                        onChange={(e) => handleChange(s.id, 'nome', e.target.value)} 
                        fullWidth 
                        size="small" 
                        label="Rótulo (Ex: Atende)" 
                        variant="outlined"
                    />
                    <TextField 
                        type="number" 
                        value={s.valor} 
                        onChange={(e) => handleChange(s.id, 'valor', e.target.value)} 
                        sx={{ width: 120 }} 
                        size="small" 
                        label="Nota (0-10)" 
                        variant="outlined"
                    />
                </Box>
            ))}
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                * A escala padrão de 3 níveis (Abaixo, Atende, Supera) é recomendada para consistência.
            </Typography>
        </Box>
    );
};

// --- COMPONENTE PRINCIPAL ---

export default function JobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // ESTADOS GLOBAIS
  const [job, setJob] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [parameters, setParameters] = useState(null);
  const [evaluators, setEvaluators] = useState([]); 
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);

  // NOVOS ESTADOS DE FILTRO
  const [selectedEvaluator, setSelectedEvaluator] = useState('ALL');
  const [selectedPillar, setSelectedPillar] = useState('FINAL'); // Opções: FINAL, TRIAGEM, CULTURA, TECNICO

  useEffect(() => {
    fetchJobData();
  }, [id]);

  const fetchJobData = async () => {
    try {
        // 1. Busca Vaga e Parâmetros
        const { data: jobData, error } = await supabase.from('jobs').select('*').eq('id', id).single();
        if (error) throw error;
        setJob(jobData);
        setParameters(jobData.parameters || { triagem:[], cultura:[], tecnico:[], notas:[] });

        // 2. Busca Candidatos e Avaliações
        const { data: apps } = await supabase
            .from('applications')
            .select(`
                *,
                candidate:candidates(*),
                evaluations(*)
            `)
            .eq('jobId', id);

        if (apps) {
            // Processa as notas
            const processed = apps.map(app => {
                const result = processEvaluation(app.evaluations || [], jobData.parameters);
                return {
                    ...app,
                    candidateName: app.candidate?.name || 'Desconhecido',
                    candidateEmail: app.candidate?.email || '',
                    ...result // Injeta notas calculadas
                };
            });
            setCandidates(processed);

            // Extrai lista de avaliadores para o filtro
            const allEvals = apps.flatMap(a => a.evaluations || []);
            const uniqueEvaluators = [...new Set(allEvals.map(e => e.evaluator_email))].filter(Boolean);
            setEvaluators(uniqueEvaluators);
        }

    } catch (err) {
        console.error("Erro ao buscar dados:", err);
    } finally {
        setLoading(false);
    }
  };

  const handleSaveParameters = async () => {
    const { error } = await supabase.from('jobs').update({ parameters }).eq('id', id);
    if (!error) {
        setSnackbar({ open: true, message: 'Critérios atualizados com sucesso!' });
        fetchJobData(); // Recarrega para aplicar novos pesos nas notas
    } else {
        alert('Erro ao salvar critérios: ' + error.message);
    }
  };

  // --- LÓGICA DE DADOS COMPUTADOS (MEMOS) ---

  // 1. Separa o Candidato Ideal (Benchmark) dos Reais
  const { idealCandidate, realCandidates } = useMemo(() => {
    const ideal = candidates.find(c => c.candidateName.includes('PERFIL IDEAL') || c.candidateEmail.includes('novva.benchmark'));
    const real = candidates.filter(c => c.id !== ideal?.id);
    return { idealCandidate: ideal, realCandidates: real };
  }, [candidates]);

  // 2. Prepara Dados para o Gráfico de Barras (Ranking)
  // Aplica filtro de Pilar e Avaliador
  const chartData = useMemo(() => {
    // Nota: O filtro de avaliador aqui é visual, usando a nota consolidada. 
    // (Para filtro real de recálculo, precisaríamos reprocessar as notas).
    let filteredList = realCandidates;

    if (selectedEvaluator !== 'ALL') {
        // Filtra apenas candidatos que foram avaliados por esta pessoa (opcional, mas útil visualmente)
        filteredList = filteredList.filter(c => 
            c.evaluations?.some(e => e.evaluator_email === selectedEvaluator)
        );
    }

    return filteredList
        .map(c => ({
            name: c.candidateName.split(' ')[0], // Primeiro nome apenas
            score: selectedPillar === 'FINAL' ? c.finalScore :
                   selectedPillar === 'TRIAGEM' ? c.triagemScore :
                   selectedPillar === 'CULTURA' ? c.cultureScore :
                   selectedPillar === 'TECNICO' ? c.technicalScore : 0,
            fullData: c
        }))
        .sort((a, b) => b.score - a.score) // Ordena Descrescente
        .slice(0, 15); // Top 15
  }, [realCandidates, selectedPillar, selectedEvaluator]);

  // 3. Prepara Dados para o Gráfico Radar (Comparativo Média vs Ideal)
  const radarData = useMemo(() => {
    const count = realCandidates.length || 1;
    
    // Média dos candidatos reais
    const avg = {
        triagem: realCandidates.reduce((a,b) => a + (b.triagemScore||0), 0) / count,
        cultura: realCandidates.reduce((a,b) => a + (b.cultureScore||0), 0) / count,
        tecnico: realCandidates.reduce((a,b) => a + (b.technicalScore||0), 0) / count,
    };

    // Dados do Ideal
    const ideal = {
        triagem: idealCandidate ? (idealCandidate.triagemScore || 0) : 0,
        cultura: idealCandidate ? (idealCandidate.cultureScore || 0) : 0,
        tecnico: idealCandidate ? (idealCandidate.technicalScore || 0) : 0,
    };

    return [
        { subject: 'Triagem', Media: avg.triagem, Ideal: ideal.triagem, fullMark: 100 },
        { subject: 'Fit Cultural', Media: avg.cultura, Ideal: ideal.cultura, fullMark: 100 },
        { subject: 'Técnico', Media: avg.tecnico, Ideal: ideal.tecnico, fullMark: 100 },
    ];
  }, [realCandidates, idealCandidate]);


  if (loading) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;
  if (!job) return <Typography sx={{ p: 4 }}>Vaga não encontrada.</Typography>;

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      
      {/* HEADER PRINCIPAL */}
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: '1px solid #e2e8f0', bgcolor: 'white' }}>
        <Toolbar>
            <IconButton onClick={() => navigate('/dashboard')} edge="start" sx={{ mr: 2 }}>
                <ArrowLeft size={20}/>
            </IconButton>
            <Box flexGrow={1}>
                <Typography variant="h6" fontWeight="bold" color="text.primary">{job.title}</Typography>
                <Box display="flex" gap={2} fontSize={13} color="text.secondary" mt={0.5}>
                    <span className="flex items-center gap-1"><MapPin size={14}/> {job.location_type}</span>
                    <span className="flex items-center gap-1"><Briefcase size={14}/> {job.type}</span>
                    <span className="flex items-center gap-1"><Calendar size={14}/> {new Date(job.created_at).toLocaleDateString()}</span>
                </Box>
            </Box>
            <Button variant="outlined" startIcon={<Share2 size={16}/>} sx={{ mr: 1, textTransform: 'none' }}>
                Compartilhar
            </Button>
            {job.status === 'active' && (
                <Button variant="contained" color="primary" sx={{ textTransform: 'none' }}>
                    Editar Vaga
                </Button>
            )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 4 }}>
        
        {/* NAVEGAÇÃO ENTRE ABAS */}
        <Paper square elevation={0} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider', bgcolor: 'transparent' }}>
            <Tabs 
                value={tabValue} 
                onChange={(e, v) => setTabValue(v)} 
                sx={{ '& .MuiTab-root': { textTransform: 'none', fontWeight: 'bold', fontSize: '1rem' } }}
            >
                <Tab label={`Candidatos (${realCandidates.length})`} />
                <Tab label="Dashboard & Analytics" />
                <Tab label="Configurar Avaliação" />
            </Tabs>
        </Paper>

        {/* TAB 0: LISTA DE CANDIDATOS (TABELA) */}
        {tabValue === 0 && (
            <Paper sx={{ p: 0, borderRadius: 2, overflow: 'hidden', boxShadow: 1 }}>
                <Table>
                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Candidato</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 'bold' }}>Triagem</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 'bold' }}>Cultural</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 'bold' }}>Técnico</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 'bold' }}>Média Final</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 'bold' }}>Status</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Ação</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        
                        {/* 1. RENDERIZA O PERFIL IDEAL PRIMEIRO (EM DESTAQUE) */}
                        {idealCandidate && (
                            <TableRow sx={{ bgcolor: '#fffbeb', '&:hover': { bgcolor: '#fef3c7' } }}>
                                <TableCell>
                                    <Box display="flex" alignItems="center" gap={2}>
                                        <Avatar sx={{ bgcolor: '#000', width: 32, height: 32 }}>
                                            <StarIcon fontSize="small" />
                                        </Avatar>
                                        <Box>
                                            <Typography fontWeight="bold" variant="body2">PERFIL IDEAL (Benchmarking)</Typography>
                                            <Typography variant="caption" color="text.secondary">Gabarito de Comparação</Typography>
                                        </Box>
                                    </Box>
                                </TableCell>
                                <TableCell align="center">{idealCandidate.triagemScore?.toFixed(1)}</TableCell>
                                <TableCell align="center">{idealCandidate.cultureScore?.toFixed(1)}</TableCell>
                                <TableCell align="center">{idealCandidate.technicalScore?.toFixed(1)}</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 'bold' }}>{idealCandidate.finalScore?.toFixed(1)}</TableCell>
                                <TableCell align="center">
                                    <Chip label="GABARITO" size="small" sx={{ bgcolor: '#000', color: '#fff', fontWeight: 'bold', fontSize: '10px' }} />
                                </TableCell>
                                <TableCell align="right">
                                    <Button 
                                        size="small" 
                                        variant="contained" 
                                        color="warning" 
                                        component={RouterLink} 
                                        to={`/application/${idealCandidate.id}`}
                                        sx={{ textTransform: 'none' }}
                                    >
                                        Definir Ideal
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )}

                        {/* 2. RENDERIZA OS CANDIDATOS REAIS */}
                        {realCandidates.map((app) => (
                            <TableRow key={app.id} hover>
                                <TableCell>
                                    <Typography fontWeight="500">{app.candidateName}</Typography>
                                    <Typography variant="caption" color="text.secondary">{app.candidateEmail}</Typography>
                                </TableCell>
                                <TableCell align="center">{app.triagemScore?.toFixed(1)}</TableCell>
                                <TableCell align="center">{app.cultureScore?.toFixed(1)}</TableCell>
                                <TableCell align="center">{app.technicalScore?.toFixed(1)}</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 'bold', color: app.finalScore >= 70 ? 'green' : 'inherit' }}>
                                    {app.finalScore?.toFixed(1)}
                                </TableCell>
                                <TableCell align="center">
                                    <Chip label={app.status} size="small" variant="outlined" />
                                </TableCell>
                                <TableCell align="right">
                                    <Button 
                                        size="small" 
                                        component={RouterLink} 
                                        to={`/application/${app.id}`} 
                                        sx={{ textTransform: 'none' }}
                                    >
                                        Avaliar
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}

                        {realCandidates.length === 0 && !idealCandidate && (
                            <TableRow>
                                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                    Nenhum candidato inscrito nesta vaga.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Paper>
        )}

        {/* TAB 1: DASHBOARD & ANALYTICS (NOVA FUNCIONALIDADE) */}
        {tabValue === 1 && (
            <Box>
                {/* BARRA DE FILTROS */}
                <Paper sx={{ p: 2, mb: 3, display: 'flex', gap: 3, alignItems: 'center', borderRadius: 2 }}>
                    <Box display="flex" alignItems="center" gap={1} color="text.secondary">
                        <FilterIcon />
                        <Typography fontWeight="bold">Filtros:</Typography>
                    </Box>
                    
                    <FormControl size="small" sx={{ minWidth: 220 }}>
                        <InputLabel>Avaliador</InputLabel>
                        <Select value={selectedEvaluator} label="Avaliador" onChange={e => setSelectedEvaluator(e.target.value)}>
                            <MenuItem value="ALL">Todos os Avaliadores</MenuItem>
                            {evaluators.map(ev => <MenuItem key={ev} value={ev}>{ev}</MenuItem>)}
                        </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: 220 }}>
                        <InputLabel>Pilar de Análise</InputLabel>
                        <Select value={selectedPillar} label="Pilar de Análise" onChange={e => setSelectedPillar(e.target.value)}>
                            <MenuItem value="FINAL">Média Geral (Ranking)</MenuItem>
                            <MenuItem value="TRIAGEM">1. Triagem / Requisitos</MenuItem>
                            <MenuItem value="CULTURA">2. Fit Cultural</MenuItem>
                            <MenuItem value="TECNICO">3. Teste Técnico</MenuItem>
                        </Select>
                    </FormControl>
                </Paper>

                <Grid container spacing={3}>
                    {/* GRÁFICO 1: BARRAS (Ranking) */}
                    <Grid item xs={12} md={7}>
                        <Paper sx={{ p: 3, height: 450, borderRadius: 2, boxShadow: 2 }}>
                            <Typography variant="h6" gutterBottom fontWeight="bold" color="primary">
                                Ranking de Candidatos ({selectedPillar})
                            </Typography>
                            <Typography variant="caption" color="text.secondary" paragraph>
                                Comparativo direto de notas. Exibe os Top 15.
                            </Typography>
                            
                            <ResponsiveContainer width="100%" height="85%">
                                <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                    <XAxis type="number" domain={[0, 100]} hide />
                                    <YAxis type="category" dataKey="name" width={100} tick={{ fontWeight: 'bold' }} />
                                    <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: 8 }} />
                                    <Bar dataKey="score" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={25}>
                                        <LabelList dataKey="score" position="right" formatter={(v) => v.toFixed(1)} style={{ fontWeight: 'bold', fill: '#64748b' }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </Paper>
                    </Grid>