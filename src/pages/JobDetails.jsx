import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { format, parseISO } from 'date-fns';
import { 
    Container, Typography, Box, AppBar, Toolbar, Button, CircularProgress, 
    Alert, Paper, Tabs, Tab, TextField, IconButton, Snackbar, InputAdornment,
    List, ListItem, ListItemText, Divider, Grid,
    Table, TableHead, TableRow, TableCell, TableBody, Checkbox,
    FormControl, InputLabel, Select, MenuItem, Avatar, Chip
} from '@mui/material';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { Delete as DeleteIcon, ContentCopy as ContentCopyIcon, FileCopy as FileCopyIcon } from '@mui/icons-material';
import { formatStatus } from '../utils/formatters';

// ... (Imports de modal CopyParameters e DeleteDialog mantidos como no original, omitidos aqui por brevidade, mas devem estar no arquivo final) ...
// Vou focar na lógica nova da aba CLASSIFICAÇÃO e CANDIDATOS.

const JobDetails = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [applicants, setApplicants] = useState([]);
  const [allEvaluations, setAllEvaluations] = useState([]); // Dados brutos de todas avaliações
  
  // Filtro do Gráfico
  const [evaluatorFilter, setEvaluatorFilter] = useState('all'); // 'all' ou evaluator_id

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Não autenticado");

        // 1. Busca Vaga
        const { data: jobData } = await supabase.from('jobs').select('*').eq('id', jobId).single();
        setJob(jobData);

        // 2. Busca Candidatos (Applications)
        const { data: appsData } = await supabase
            .from('applications')
            .select('*, candidate:candidates(name, email)')
            .eq('jobId', jobId);
        
        setApplicants(appsData || []);

        // 3. Busca TODAS as avaliações (Evaluations) para esta vaga
        // Precisamos fazer um join manual pois evaluation tem application_id
        const appIds = (appsData || []).map(a => a.id);
        if (appIds.length > 0) {
            const { data: evalsData } = await supabase
                .from('evaluations')
                .select('*, evaluator:users(email, name)') // Tenta pegar nome se houver relacionamento
                .in('application_id', appIds);
            setAllEvaluations(evalsData || []);
        }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, [jobId]);

  // --- PROCESSAMENTO DE DADOS PARA O GRÁFICO E LISTA ---
  const processedClassificationData = useMemo(() => {
    // Lista única de avaliadores para o filtro
    const evaluatorsList = Array.from(new Set(allEvaluations.map(e => e.evaluator_id)))
        .map(id => {
            const ev = allEvaluations.find(e => e.evaluator_id === id);
            return { id, name: ev.evaluator?.name || ev.evaluator_name || 'Desconhecido' };
        });

    const chartData = applicants.map(app => {
        // Filtra avaliações baseadas no filtro selecionado
        const appEvaluations = allEvaluations.filter(e => 
            e.application_id === app.id && 
            (evaluatorFilter === 'all' || e.evaluator_id === evaluatorFilter)
        );

        if (appEvaluations.length === 0) {
            return { name: app.candidate.name, triagem: 0, cultura: 0, tecnico: 0, total: 0, count: 0, appId: app.id };
        }

        // Calcula médias (Geral ou Individual dependendo do filtro)
        let sumTriagem = 0, sumCultura = 0, sumTecnico = 0;
        let count = 0;

        appEvaluations.forEach(ev => {
            const p = ev.scores.pillar_scores || {};
            // Soma as notas brutas (0-10) de cada pilar
            sumTriagem += Number(p.triagem || 0);
            sumCultura += Number(p.cultura || 0);
            sumTecnico += Number(p.tecnico || 0);
            count++;
        });

        // Médias por pilar (0-10)
        const avgTriagem = count > 0 ? sumTriagem / count : 0;
        const avgCultura = count > 0 ? sumCultura / count : 0;
        const avgTecnico = count > 0 ? sumTecnico / count : 0;
        
        // Média Geral (0-10)
        const generalAvg = (avgTriagem + avgCultura + avgTecnico) / 3;

        // Para o gráfico empilhado, vamos dividir cada pilar por 3 para que a soma da pilha dê a média final (0-10)
        // Isso permite ver a contribuição de cada pilar para a nota final.
        return {
            appId: app.id,
            name: app.candidate.name,
            triagem: avgTriagem / 3, // Fatia do gráfico
            cultura: avgCultura / 3,
            tecnico: avgTecnico / 3,
            realTriagem: avgTriagem, // Valor real para tooltip
            realCultura: avgCultura,
            realTecnico: avgTecnico,
            total: generalAvg,
            count: count,
            hired: app.isHired,
            created_at: app.created_at
        };
    }).sort((a, b) => b.total - a.total); // Ordena por maior nota

    return { chartData, evaluatorsList };
  }, [applicants, allEvaluations, evaluatorFilter]);

  const handleHireToggle = async (appId, currentStatus) => {
      // Atualiza localmente
      const newStatus = !currentStatus;
      setApplicants(prev => prev.map(a => a.id === appId ? {...a, isHired: newStatus} : a));
      
      // Atualiza no banco
      await supabase.from('applications').update({ isHired: newStatus, hiredAt: newStatus ? new Date() : null }).eq('id', appId);
  };

  const renderClassificationTab = () => {
      const { chartData, evaluatorsList } = processedClassificationData;

      return (
        <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* FILTRO E GRÁFICO */}
            <Grid item xs={12} md={8}>
                <Paper sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h6">Comparativo de Notas</Typography>
                        <FormControl size="small" sx={{ width: 200 }}>
                            <InputLabel>Visão</InputLabel>
                            <Select 
                                value={evaluatorFilter} 
                                label="Visão"
                                onChange={(e) => setEvaluatorFilter(e.target.value)}
                            >
                                <MenuItem value="all">Geral (Média da Equipe)</MenuItem>
                                {evaluatorsList.map(ev => (
                                    <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                    
                    <Box sx={{ height: 400, width: '100%' }}>
                        <ResponsiveContainer>
                            <BarChart data={chartData} layout="vertical" margin={{ left: 50 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" domain={[0, 10]} />
                                <YAxis dataKey="name" type="category" width={100} style={{fontSize: '0.8rem'}} />
                                <Tooltip 
                                    formatter={(value, name, props) => {
                                        if (name === 'triagem') return [props.payload.realTriagem.toFixed(2), 'Triagem'];
                                        if (name === 'cultura') return [props.payload.realCultura.toFixed(2), 'Cultura'];
                                        if (name === 'tecnico') return [props.payload.realTecnico.toFixed(2), 'Técnico'];
                                        return [value.toFixed(2), name];
                                    }}
                                    labelStyle={{fontWeight: 'bold'}}
                                />
                                <Legend />
                                <Bar dataKey="triagem" stackId="a" name="Triagem" fill="#90caf9" />
                                <Bar dataKey="cultura" stackId="a" name="Cultura" fill="#a5d6a7" />
                                <Bar dataKey="tecnico" stackId="a" name="Técnico" fill="#ffcc80" />
                                <ReferenceLine x={5} stroke="red" strokeDasharray="3 3" label="Média" />
                            </BarChart>
                        </ResponsiveContainer>
                    </Box>
                </Paper>

                {/* BOX DE AVALIAÇÕES (READ-ONLY) */}
                <Paper sx={{ mt: 3, p: 3 }}>
                    <Typography variant="h6" gutterBottom>Histórico de Avaliações</Typography>
                    <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                        {allEvaluations.map((ev, idx) => {
                            const app = applicants.find(a => a.id === ev.application_id);
                            return (
                                <React.Fragment key={idx}>
                                    <ListItem alignItems="flex-start">
                                        <ListItemText 
                                            primary={
                                                <Box display="flex" justifyContent="space-between">
                                                    <Typography variant="subtitle2">Candidato: {app?.candidate?.name}</Typography>
                                                    <Chip label={`Nota: ${Number(ev.final_score).toFixed(2)}`} size="small" color="primary" variant="outlined" />
                                                </Box>
                                            }
                                            secondary={
                                                <>
                                                    <Typography variant="caption" display="block">Avaliador: {ev.evaluator_name || 'Usuário'}</Typography>
                                                    <Typography variant="caption" color="text.secondary">{ev.notes || 'Sem comentários'}</Typography>
                                                </>
                                            }
                                        />
                                    </ListItem>
                                    <Divider component="li" />
                                </React.Fragment>
                            );
                        })}
                        {allEvaluations.length === 0 && <Typography variant="body2" sx={{p:2}}>Nenhuma avaliação registrada.</Typography>}
                    </List>
                </Paper>
            </Grid>

            {/* LISTA LATERAL DETALHADA */}
            <Grid item xs={12} md={4}>
                <Paper sx={{ p: 0, height: '100%', overflow: 'hidden' }}>
                    <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
                        <Typography variant="subtitle1" fontWeight="bold">Ranking</Typography>
                    </Box>
                    <List sx={{ overflowY: 'auto', maxHeight: '80vh' }}>
                        {chartData.map((data) => (
                            <React.Fragment key={data.appId}>
                                <ListItem 
                                    secondaryAction={
                                        <Checkbox 
                                            edge="end" 
                                            checked={data.hired || false}
                                            onChange={() => handleHireToggle(data.appId, data.hired)}
                                            color="success"
                                        />
                                    }
                                >
                                    <ListItemText 
                                        primary={
                                            <Link component={RouterLink} to={`/vaga/${jobId}/candidato/${data.appId}`} underline="hover" color="inherit">
                                                <Typography variant="body2" fontWeight="bold">{data.name}</Typography>
                                            </Link>
                                        }
                                        secondary={
                                            <Box sx={{ mt: 0.5 }}>
                                                <Typography variant="caption" display="block">Data: {format(parseISO(data.created_at), 'dd/MM/yyyy')}</Typography>
                                                <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                                                    <Chip label={`T: ${data.realTriagem.toFixed(1)}`} size="small" sx={{ fontSize: '0.6rem', height: 20, bgcolor: '#e3f2fd' }} />
                                                    <Chip label={`C: ${data.realCultura.toFixed(1)}`} size="small" sx={{ fontSize: '0.6rem', height: 20, bgcolor: '#e8f5e9' }} />
                                                    <Chip label={`Tc: ${data.realTecnico.toFixed(1)}`} size="small" sx={{ fontSize: '0.6rem', height: 20, bgcolor: '#fff3e0' }} />
                                                </Box>
                                                <Typography variant="subtitle2" color="primary" sx={{ mt: 0.5, fontWeight: 'bold' }}>
                                                    Geral: {data.total.toFixed(2)}
                                                </Typography>
                                            </Box>
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
            <Paper sx={{ width: '100%', mb: 2 }}>
                <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} indicatorColor="primary" textColor="primary" centered>
                    <Tab label="Candidatos" />
                    <Tab label="Classificação & Ranking" />
                    <Tab label="Configurações da Vaga" />
                </Tabs>
            </Paper>

            {tabValue === 0 && (
                <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>Lista de Inscritos</Typography>
                    <Table>
                        <TableHead><TableRow><TableCell>Nome</TableCell><TableCell>Email</TableCell><TableCell align="center">Avaliações</TableCell><TableCell align="center">Nota Geral</TableCell></TableRow></TableHead>
                        <TableBody>
                            {applicants.map(app => {
                                const evals = allEvaluations.filter(e => e.application_id === app.id);
                                return (
                                    <TableRow key={app.id} hover component={RouterLink} to={`/vaga/${jobId}/candidato/${app.id}`} style={{textDecoration:'none'}}>
                                        <TableCell>{app.candidate.name}</TableCell>
                                        <TableCell>{app.candidate.email}</TableCell>
                                        <TableCell align="center">{evals.length}</TableCell>
                                        <TableCell align="center">
                                            <Chip 
                                                label={app.score_general ? Number(app.score_general).toFixed(2) : '-'} 
                                                color={app.score_general >= 8 ? 'success' : app.score_general >= 5 ? 'warning' : 'default'}
                                                variant={app.score_general ? 'filled' : 'outlined'}
                                            />
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </Paper>
            )}

            {tabValue === 1 && renderClassificationTab()}

            {tabValue === 2 && (
                <Box p={3} textAlign="center">
                    <Typography color="text.secondary">Use a aba de configurações anterior para editar pesos e notas.</Typography>
                </Box>
            )}
        </Container>
    </Box>
  );
};

export default JobDetails;