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
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, LabelList 
} from 'recharts';
import { Delete as DeleteIcon, ContentCopy as ContentCopyIcon } from '@mui/icons-material';
import { processEvaluation } from '../utils/evaluationLogic';

// Estilo do Modal
const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 500,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: 2
};

// Componente Modal de Cópia
const CopyParametersModal = ({ open, onClose, currentJobId, onCopy }) => {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      const fetchJobsList = async () => {
        setLoading(true);
        try {
          const { data } = await supabase
            .from('jobs')
            .select('id, title')
            .neq('id', currentJobId)
            .eq('status', 'active');
          setJobs(data || []);
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      fetchJobsList();
    }
  }, [open, currentJobId]);

  const handleConfirmCopy = async () => {
    if (!selectedJobId) return;
    try {
      const { data } = await supabase
        .from('jobs')
        .select('parameters')
        .eq('id', selectedJobId)
        .single();
      
      if (data && data.parameters) {
        onCopy(data.parameters);
      }
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={modalStyle}>
        <Typography variant="h6" gutterBottom>Copiar Parâmetros de Outra Vaga</Typography>
        {loading ? (
          <Box display="flex" justifyContent="center" p={3}><CircularProgress /></Box>
        ) : (
          <FormControl fullWidth margin="normal">
            <InputLabel>Selecione a Vaga</InputLabel>
            <Select 
              value={selectedJobId} 
              onChange={(e) => setSelectedJobId(e.target.value)} 
              label="Selecione a Vaga"
            >
              {jobs.map(job => (
                <MenuItem key={job.id} value={job.id}>{job.title}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={onClose} variant="outlined">Cancelar</Button>
          <Button 
            onClick={handleConfirmCopy} 
            variant="contained" 
            disabled={!selectedJobId}
          >
            Copiar
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};

// Componente de Seção de Parâmetros
const ParametersSection = ({ criteria = [], onCriteriaChange }) => {
  const handleItemChange = (index, field, value) => { 
      const newCriteria = [...criteria]; 
      // Garante que o peso seja numérico para evitar concatenação de strings
      newCriteria[index] = { 
          ...newCriteria[index], 
          [field]: field === 'weight' ? Number(value) : value 
      }; 
      onCriteriaChange(newCriteria); 
  };

  const addCriterion = () => {
       if (criteria.length < 10) {
           onCriteriaChange([...criteria, { name: '', weight: 0 }]);
       }
  };

  const removeCriterion = (index) => {
      onCriteriaChange(criteria.filter((_, i) => i !== index));
  };
  
  const totalWeight = criteria.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);

  return (
    <Box sx={{ mt: 2 }}>
      {criteria.map((item, index) => (
        <Box key={index} sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField 
            label={`Critério ${index + 1}`} 
            value={item.name} 
            onChange={(e) => handleItemChange(index, 'name', e.target.value)} 
            fullWidth 
            variant="outlined"
            size="small"
          />
          <TextField 
            label="Peso (%)" 
            type="number" 
            value={item.weight} 
            onChange={(e) => handleItemChange(index, 'weight', e.target.value)} 
            sx={{ width: '120px' }} 
            variant="outlined"
            size="small"
          />
          <IconButton onClick={() => removeCriterion(index)} color="error">
            <DeleteIcon />
          </IconButton>
        </Box>
      ))}
      
      <Button 
        onClick={addCriterion} 
        disabled={criteria.length >= 10} 
        variant="outlined" 
        startIcon={<DeleteIcon style={{ transform: 'rotate(45deg)' }} />} 
      >
        Adicionar Critério
      </Button>

      <Typography 
        variant="caption" 
        sx={{ display:'block', mt: 2, fontWeight: 'bold', color: totalWeight === 100 ? 'green' : 'red' }}
      >
          Total Pesos: {totalWeight}% {totalWeight !== 100 && "(A soma deve ser 100%)"}
      </Typography>
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
  const [tabValue, setTabValue] = useState(0);
  const [applicants, setApplicants] = useState([]);
  const [allEvaluations, setAllEvaluations] = useState([]);
  const [usersMap, setUsersMap] = useState({}); // Mapa para nomes dos avaliadores
  const [evaluatorFilter, setEvaluatorFilter] = useState('all');
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Não autenticado");

        // 1. Busca Vaga
        const { data: jobData } = await supabase.from('jobs').select('*').eq('id', jobId).single();
        setJob(jobData);
        const params = jobData.parameters || { triagem: [], cultura: [], tecnico: [], notas: [] };
        setParameters(params);

        // 2. Busca Candidatos
        const { data: appsData } = await supabase
            .from('applications')
            .select('*, candidate:candidates(name, email)')
            .eq('jobId', jobId);
        setApplicants(appsData || []);

        // 3. Busca Avaliações
        const appIds = (appsData || []).map(a => a.id);
        if (appIds.length > 0) {
            const { data: evalsData } = await supabase
                .from('evaluations')
                .select('*')
                .in('application_id', appIds);
            
            setAllEvaluations(evalsData || []);

            // 4. Busca Nomes dos Avaliadores (Correção do "Avaliador Desconhecido")
            const userIds = [...new Set((evalsData || []).map(e => e.evaluator_id))];
            if (userIds.length > 0) {
                const { data: usersData } = await supabase
                    .from('users')
                    .select('id, name, email')
                    .in('id', userIds);
                
                const map = {};
                usersData?.forEach(u => map[u.id] = u.name || u.email);
                setUsersMap(map);
            }
        }
      } catch (err) { 
          console.error(err); 
      } finally { 
          setLoading(false); 
      }
    };
    fetchAllData();
  }, [jobId]);

  // --- PROCESSAMENTO DE DADOS ---
  const processedData = useMemo(() => {
    if (!parameters) return { chartData: [], evaluators: [] };

    // Lista de avaliadores usando o mapa de nomes real
    const evaluatorsList = Object.keys(usersMap).map(id => ({
        id, 
        name: usersMap[id] || 'Desconhecido'
    }));

    const chartData = applicants.map(app => {
        // Filtra avaliações deste candidato
        const appEvals = allEvaluations.filter(e => 
            String(e.application_id) === String(app.id) && 
            (evaluatorFilter === 'all' || e.evaluator_id === evaluatorFilter)
        );

        let sumT = 0, sumC = 0, sumTc = 0, count = 0;
        let sumTotal = 0;

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

        // Médias (0-10)
        const avgT = count > 0 ? sumT / count : 0;
        const avgC = count > 0 ? sumC / count : 0;
        const avgTc = count > 0 ? sumTc / count : 0;
        const avgGeneral = count > 0 ? sumTotal / count : 0;

        return {
            appId: app.id,
            name: app.candidate?.name || 'Candidato Sem Nome',
            email: app.candidate?.email,
            // Valores Reais
            triagem: Number(avgT.toFixed(1)),
            cultura: Number(avgC.toFixed(1)),
            tecnico: Number(avgTc.toFixed(1)),
            total: Number(avgGeneral.toFixed(1)),
            count: count,
            hired: app.isHired
        };
    }).sort((a, b) => b.total - a.total); 

    return { chartData, evaluators: evaluatorsList };
  }, [applicants, allEvaluations, evaluatorFilter, parameters, usersMap]);

  const handleHireToggle = async (appId, currentStatus) => {
      const newStatus = !currentStatus;
      setApplicants(prev => prev.map(a => a.id === appId ? {...a, isHired: newStatus} : a));
      await supabase.from('applications').update({ isHired: newStatus }).eq('id', appId);
  };

  const handleSaveParameters = async () => {
      await supabase.from('jobs').update({ parameters }).eq('id', jobId);
      setFeedback({ open: true, message: 'Parâmetros salvos com sucesso!', severity: 'success' });
  };

  if (loading) return <Box p={5} display="flex" justifyContent="center"><CircularProgress /></Box>;

  return (
    <Box>
        <AppBar position="static" color="default" elevation={1}>
            <Toolbar>
                <Typography variant="h6" sx={{flexGrow:1}}>{job?.title}</Typography>
                <Button color="inherit" component={RouterLink} to="/">Voltar</Button>
            </Toolbar>
        </AppBar>
        
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            <Paper sx={{ mb: 3 }}>
                <Tabs 
                    value={tabValue} 
                    onChange={(e, v) => setTabValue(v)} 
                    indicatorColor="primary" 
                    textColor="primary" 
                    centered
                >
                    <Tab label="Candidatos" />
                    <Tab label="Classificação" /> {/* CORREÇÃO: Título alterado */}
                    <Tab label="Configurações da Vaga" />
                </Tabs>
            </Paper>
            
            {/* ABA 0: LISTA DE CANDIDATOS */}
            {tabValue === 0 && (
                <Paper sx={{ p: 0, overflow: 'hidden' }}>
                    <Table>
                        <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                            <TableRow>
                                <TableCell><strong>Nome</strong></TableCell>
                                <TableCell><strong>Email</strong></TableCell>
                                <TableCell align="center"><strong>Avaliações</strong></TableCell>
                                <TableCell align="center"><strong>Nota Geral</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {processedData.chartData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} align="center" sx={{ py: 3 }}>Nenhum candidato inscrito.</TableCell>
                                </TableRow>
                            ) : (
                                processedData.chartData.map(d => (
                                    <TableRow key={d.appId} hover component={RouterLink} to={`/applications/${d.appId}`} style={{textDecoration:'none', cursor:'pointer'}}>
                                        <TableCell>{d.name}</TableCell>
                                        <TableCell>{d.email}</TableCell>
                                        <TableCell align="center">
                                            <Chip label={d.count} size="small" />
                                        </TableCell>
                                        <TableCell align="center">
                                            <Chip 
                                                label={d.total.toFixed(1)} 
                                                color={d.total >= 8 ? 'success' : d.total >= 5 ? 'warning' : 'default'} 
                                                variant={d.count > 0 ? 'filled' : 'outlined'}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Paper>
            )}

            {/* ABA 1: CLASSIFICAÇÃO (GRÁFICO) */}
            {tabValue === 1 && (
                <Grid container spacing={3}>
                    {/* Coluna Esquerda: Gráfico */}
                    <Grid item xs={12} md={8}>
                        <Paper sx={{ p: 3, height: '500px', display: 'flex', flexDirection: 'column' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                <Typography variant="h6">Comparativo de Desempenho</Typography>
                                <FormControl size="small" sx={{ width: 200 }}>
                                    <InputLabel>Visão</InputLabel>
                                    <Select value={evaluatorFilter} label="Visão" onChange={(e) => setEvaluatorFilter(e.target.value)}>
                                        <MenuItem value="all">Média da Equipe</MenuItem>
                                        {/* CORREÇÃO: Exibe os nomes reais dos avaliadores */}
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
                                            margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
                                            barGap={2}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                            <XAxis type="number" domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} />
                                            <YAxis dataKey="name" type="category" width={120} style={{fontSize: '0.75rem', fontWeight: 500}} />
                                            <Tooltip formatter={(val, name) => [val, name]} cursor={{fill: 'transparent'}} />
                                            <Legend verticalAlign="top" height={36}/>
                                            
                                            {/* BARRAS LADO A LADO */}
                                            <Bar dataKey="triagem" name="Triagem" fill="#90caf9" barSize={15}>
                                                <LabelList dataKey="triagem" position="right" style={{fontSize:'0.65rem', fill:'#666'}} formatter={(v) => v > 0 ? v : ''} />
                                            </Bar>
                                            <Bar dataKey="cultura" name="Fit Cultural" fill="#a5d6a7" barSize={15}>
                                                <LabelList dataKey="cultura" position="right" style={{fontSize:'0.65rem', fill:'#666'}} formatter={(v) => v > 0 ? v : ''} />
                                            </Bar>
                                            <Bar dataKey="tecnico" name="Técnico" fill="#ffcc80" barSize={15}>
                                                <LabelList dataKey="tecnico" position="right" style={{fontSize:'0.65rem', fill:'#666'}} formatter={(v) => v > 0 ? v : ''} />
                                            </Bar>
                                            
                                            {/* BARRA DE MÉDIA GERAL */}
                                            <Bar dataKey="total" name="Média Geral" fill="#4caf50" barSize={15} radius={[0, 4, 4, 0]}>
                                                <LabelList dataKey="total" position="right" style={{fontSize:'0.75rem', fontWeight:'bold', fill:'#000'}} />
                                            </Bar>

                                            <ReferenceLine x={5} stroke="red" strokeDasharray="3 3" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </Box>
                            ) : (
                                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
                                    <Typography>Ainda não há avaliações suficientes para gerar o gráfico.</Typography>
                                </Box>
                            )}
                        </Paper>
                    </Grid>
                    
                    {/* Coluna Direita: Ranking */}
                    <Grid item xs={12} md={4}>
                        <Paper sx={{ height: '500px', display: 'flex', flexDirection: 'column' }}>
                            <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
                                <Typography variant="subtitle1" fontWeight="bold">Ranking Final</Typography>
                            </Box>
                            <List sx={{ overflowY: 'auto', flex: 1 }}>
                                {processedData.chartData.map((d, index) => (
                                    <React.Fragment key={d.appId}>
                                        <ListItem 
                                            secondaryAction={
                                                <Checkbox 
                                                    checked={d.hired || false} 
                                                    onChange={() => handleHireToggle(d.appId, d.hired)} 
                                                    color="success" 
                                                />
                                            }
                                        >
                                            <ListItemText 
                                                primary={
                                                    <Typography variant="body2" fontWeight="bold">
                                                        #{index + 1} {d.name}
                                                    </Typography>
                                                }
                                                secondary={
                                                    <Typography variant="caption" color="text.secondary">
                                                        Média: <strong>{d.total.toFixed(1)}</strong> 
                                                        <span style={{marginLeft: 8}}>
                                                            (T:{d.triagem} C:{d.cultura} Tc:{d.tecnico})
                                                        </span>
                                                    </Typography>
                                                }
                                            />
                                        </ListItem>
                                        <Divider component="li" />
                                    </React.Fragment>
                                ))}
                                {processedData.chartData.length === 0 && (
                                    <Box p={3} textAlign="center"><Typography variant="caption">Sem candidatos.</Typography></Box>
                                )}
                            </List>
                        </Paper>
                    </Grid>
                </Grid>
            )}

            {/* ABA 2: CONFIGURAÇÕES */}
            {tabValue === 2 && (
                <Box p={3} sx={{ bgcolor: 'white', borderRadius: 1, boxShadow: 1 }}>
                    <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>1. Triagem</Typography>
                        <ParametersSection criteria={parameters?.triagem || []} onCriteriaChange={(c) => setParameters({...parameters, triagem: c})} />
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>2. Fit Cultural</Typography>
                        <ParametersSection criteria={parameters?.cultura || []} onCriteriaChange={(c) => setParameters({...parameters, cultura: c})} />
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>3. Teste Técnico</Typography>
                        <ParametersSection criteria={parameters?.tecnico || parameters?.['técnico'] || []} onCriteriaChange={(c) => setParameters({...parameters, tecnico: c})} />
                    </Paper>
                    
                    <Box display="flex" justifyContent="flex-end">
                        <Button 
                            variant="contained" 
                            color="primary" 
                            size="large"
                            onClick={handleSaveParameters}
                            startIcon={<ContentCopyIcon />} 
                        >
                            Salvar Configurações da Vaga
                        </Button>
                    </Box>
                </Box>
            )}
        </Container>

        <CopyParametersModal 
            open={isCopyModalOpen} 
            onClose={() => setIsCopyModalOpen(false)} 
            currentJobId={jobId} 
            onCopy={(p) => { setParameters(p); setFeedback({open:true, message:'Copiado!', severity:'info'}); }} 
        />
        
        <Snackbar 
            open={feedback.open} 
            autoHideDuration={4000} 
            onClose={() => setFeedback({...feedback, open:false})}
        >
            <Alert severity={feedback.severity} variant="filled">{feedback.message}</Alert>
        </Snackbar>
    </Box>
  );
}