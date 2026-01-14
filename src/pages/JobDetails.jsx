import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
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
import { 
    Delete as DeleteIcon, 
    Add as AddIcon,
    Save as SaveIcon
} from '@mui/icons-material';
import { Share2, MapPin, Briefcase, Calendar, ArrowLeft, Download, Plus, Trash2, Copy } from 'lucide-react'; 
import { processEvaluation } from '../utils/evaluationLogic';

// --- UTILITÁRIO DE UUID SEGURO (Evita crash em navegadores antigos/http) ---
const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// --- ESTILOS DOS MODAIS ---
const modalStyle = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 600, bgcolor: 'background.paper', boxShadow: 24, p: 4, borderRadius: 2 };

// --- COMPONENTE INTERNO: SEÇÃO DE CRITÉRIOS ---
const ParametersSection = ({ criteria = [], onCriteriaChange }) => {
  // Proteção contra dados nulos
  const safeCriteria = Array.isArray(criteria) ? criteria : [];

  const handleChange = (i, f, v) => { 
      const n = [...safeCriteria]; 
      n[i] = { ...n[i], [f]: f==='weight'?Number(v):v }; 
      onCriteriaChange(n); 
  };
  
  const total = safeCriteria.reduce((acc, c) => acc + (Number(c.weight)||0), 0);
  
  return (
    <Box sx={{mt:2, bgcolor: '#f8f9fa', p: 2, borderRadius: 2}}>
        {safeCriteria.map((c, i) => (
            <Box key={i} display="flex" gap={2} mb={1} alignItems="center">
                <TextField value={c.name || ''} onChange={e=>handleChange(i,'name',e.target.value)} fullWidth size="small" label={`Critério #${i+1}`} variant="outlined" sx={{ bgcolor: 'white' }} />
                <TextField type="number" value={c.weight || 0} onChange={e=>handleChange(i,'weight',e.target.value)} sx={{width:120, bgcolor: 'white'}} size="small" label="Peso %" />
                <IconButton onClick={()=>onCriteriaChange(safeCriteria.filter((_,idx)=>idx!==i))} color="error" size="small"><DeleteIcon/></IconButton>
            </Box>
        ))}
        <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
            <Button onClick={()=>onCriteriaChange([...safeCriteria, {name:'', weight:0}])} variant="outlined" size="small" startIcon={<AddIcon />}>Adicionar Critério</Button>
            <Typography color={total===100?'success.main':'error.main'} variant="body2" fontWeight="bold">Total: {total}%</Typography>
        </Box>
    </Box>
  );
};

// --- COMPONENTE INTERNO: RÉGUA DE NOTAS ---
const RatingScaleSection = ({ notes = [], onNotesChange }) => {
    // Proteção contra dados nulos
    const safeNotes = Array.isArray(notes) ? notes : [];

    const handleChange = (i, field, value) => {
        const newNotes = [...safeNotes];
        newNotes[i] = { ...newNotes[i], [field]: field === 'valor' ? Number(value) : value };
        onNotesChange(newNotes);
    };
    
    const handleAdd = () => onNotesChange([...safeNotes, { id: generateUUID(), nome: 'Novo Nível', valor: 0 }]);
    const handleRemove = (i) => onNotesChange(safeNotes.filter((_, idx) => idx !== i));
    
    return (
        <Box sx={{ mt: 2, bgcolor: '#fff3e0', p: 2, borderRadius: 2 }}>
            {safeNotes.map((n, i) => (
                <Box key={n.id || i} display="flex" gap={2} mb={1} alignItems="center">
                    <TextField value={n.nome || ''} onChange={(e) => handleChange(i, 'nome', e.target.value)} fullWidth size="small" label="Rótulo" sx={{bgcolor: 'white'}} />
                    <TextField type="number" value={n.valor || 0} onChange={(e) => handleChange(i, 'valor', e.target.value)} sx={{ width: 120, bgcolor: 'white' }} size="small" label="Valor (0-100)" />
                    <IconButton onClick={() => handleRemove(i)} color="error"><DeleteIcon /></IconButton>
                </Box>
            ))}
            <Button onClick={handleAdd} variant="outlined" color="warning" size="small" startIcon={<AddIcon />}>Adicionar Nível</Button>
            {safeNotes.length < 2 && <Typography color="warning.main" variant="caption" display="block" sx={{ mt: 1 }}>Recomendado ter pelo menos 2 níveis.</Typography>}
        </Box>
    );
};

// --- COMPONENTE INTERNO: MODAL DE CÓPIA ---
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

// --- COMPONENTE PRINCIPAL DA PÁGINA ---
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
  const [evaluatorFilter, setEvaluatorFilter] = useState('all');
  const [metricFilter, setMetricFilter] = useState('all');
  
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'success' });

  const safeJobId = jobId || useParams().id;

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const { data: jobData, error: jobError } = await supabase.from('jobs').select('*').eq('id', safeJobId).single();
        if (jobError) throw jobError;
        setJob(jobData);
        // Garante estrutura mínima para evitar crashes
        setParameters(jobData.parameters || { triagem: [], cultura: [], tecnico: [], notas: [] });

        const { data: appsData } = await supabase.from('applications').select('*, candidate:candidates(name, email)').eq('jobId', safeJobId);
        setApplicants(appsData || []);

        const appIds = (appsData || []).map(a => a.id);
        if (appIds.length > 0) {
            const { data: evalsData } = await supabase.from('evaluations').select('*').in('application_id', appIds);
            setAllEvaluations(evalsData || []);
        }

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
  }, [safeJobId]);

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
    navigator.clipboard.writeText(`${window.location.origin}/apply/${safeJobId}`);
    setFeedback({ open: true, message: 'Link copiado para a área de transferência!', severity: 'info' });
  };

  const processedData = useMemo(() => {
    if (!parameters) return { chartData: [], evaluators: [] };

    const evaluators = Object.keys(usersMap).map(id => ({ id, name: usersMap[id] }));

    const chartData = applicants.map(app => {
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
      const hiredAtDate = newStatus ? new Date().toISOString() : null;

      setApplicants(prev => prev.map(a => a.id === appId ? {...a, isHired: newStatus, hiredAt: hiredAtDate} : a));
      
      await supabase.from('applications').update({ 
          isHired: newStatus,
          hiredAt: hiredAtDate 
      }).eq('id', appId);
  };

  const handleSaveParameters = async () => {
      setSaving(true);
      await supabase.from('jobs').update({ parameters }).eq('id', safeJobId);
      setSaving(false);
      setFeedback({ open: true, message: 'Configurações salvas!', severity: 'success' });
  };

  if (loading) return <Box p={5} display="flex" justifyContent="center"><CircularProgress /></Box>;
  if (!job) return <Box p={5} textAlign="center">Vaga não encontrada</Box>;

  return (
    <Box>
        <AppBar position="static" color="default" elevation={1}>
            <Toolbar>
                <Typography variant="h6" sx={{flexGrow:1}}>{job?.title}</Typography>
                
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

            <Paper sx={{ mb: 3 }}><Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} centered><Tab label="Candidatos" /><Tab label="Classificação" /><Tab label="Configurações da Vaga" /></Tabs></Paper>
            
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

            {tabValue === 1 && (
                <Grid container spacing={3}>
                    <Grid item xs={12} md={8}>
                        <Paper sx={{ p: 3, height: '600px', display: 'flex', flexDirection: 'column' }} elevation={3}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, pb: 2, borderBottom: '1px solid #f0f0f0' }}>
                                <Typography variant="h6" color="text.primary" fontWeight="bold">Comparativo de Desempenho</Typography>
                                
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <FormControl size="small" sx={{ minWidth: 200 }}>
                                        <InputLabel>Avaliador</InputLabel>
                                        <Select value={evaluatorFilter} label="Avaliador" onChange={(e) => setEvaluatorFilter(e.target.value)}>
                                            <MenuItem value="all">Visão Geral (Média da Equipe)</MenuItem>
                                            {processedData.evaluators.map(ev => <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>)}
                                        </Select>
                                    </FormControl>

                                    <FormControl size="small" sx={{ minWidth: 180 }}>
                                        <InputLabel>Critério</InputLabel>
                                        <Select value={metricFilter} label="Critério" onChange={(e) => setMetricFilter(e.target.value)}>
                                            <MenuItem value="all">Todos os Critérios</MenuItem>
                                            <MenuItem value="triagem">Triagem</MenuItem>
                                            <MenuItem value="cultura">Fit Cultural</MenuItem>
                                            <MenuItem value="tecnico">Teste Técnico</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Box>
                            </Box>
                            
                            {processedData.chartData.some(d => d.total > 0 || d.count > 0) ? (
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
                                            <YAxis dataKey="name" type="category" width={150} style={{fontSize: '0.8rem', fontWeight: 500, fill: '#444'}} />
                                            <Tooltip cursor={{fill: '#f5f5f5'}} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} formatter={(val, name) => [val, name]} />
                                            <Legend verticalAlign="top" height={40} iconType="circle" />
                                            
                                            {(metricFilter === 'all' || metricFilter === 'triagem') && 
                                                <Bar dataKey="triagem" name="Triagem" fill="#90caf9" barSize={20} radius={[0, 4, 4, 0]}><LabelList dataKey="triagem" position="right" style={{fontSize:'0.7rem', fill:'#666'}} formatter={(v)=>v>0?v:''}/></Bar>
                                            }
                                            {(metricFilter === 'all' || metricFilter === 'cultura') && 
                                                <Bar dataKey="cultura" name="Fit Cultural" fill="#a5d6a7" barSize={20} radius={[0, 4, 4, 0]}><LabelList dataKey="cultura" position="right" style={{fontSize:'0.7rem', fill:'#666'}} formatter={(v)=>v>0?v:''}/></Bar>
                                            }
                                            {(metricFilter === 'all' || metricFilter === 'tecnico') && 
                                                <Bar dataKey="tecnico" name="Técnico" fill="#ffcc80" barSize={20} radius={[0, 4, 4, 0]}><LabelList dataKey="tecnico" position="right" style={{fontSize:'0.7rem', fill:'#666'}} formatter={(v)=>v>0?v:''}/></Bar>
                                            }
                                            
                                            {metricFilter === 'all' && 
                                                <Bar dataKey="total" name="Média Geral" fill="#4caf50" barSize={20} radius={[0, 4, 4, 0]}><LabelList dataKey="total" position="right" style={{fontSize:'0.8rem', fontWeight:'bold', fill:'#2e7d32'}} /></Bar>
                                            }
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
                        {/* Suporte duplo para chave 'tecnico' ou 'técnico' */}
                        <ParametersSection criteria={parameters?.tecnico || parameters?.['técnico'] || []} onCriteriaChange={(c) => setParameters({...parameters, tecnico: c})} />
                    </Paper>
                    
                    <Paper variant="outlined" sx={{p:3, mb:3, borderColor: 'orange'}}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="orange">4. Régua de Notas</Typography>
                        <Typography variant="caption" color="text.secondary" gutterBottom>
                            Defina os nomes e valores (0 a 100) que aparecerão nas opções de avaliação.
                        </Typography>
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
        <CopyParametersModal open={isCopyModalOpen} onClose={() => setIsCopyModalOpen(false)} currentJobId={safeJobId} onCopy={(p) => { setParameters(p); setFeedback({open:true, message:'Copiado!', severity:'info'}); }} />
        <Snackbar open={feedback.open} autoHideDuration={4000} onClose={() => setFeedback({...feedback, open:false})}><Alert severity={feedback.severity} variant="filled">{feedback.message}</Alert></Snackbar>
    </Box>
  );
}