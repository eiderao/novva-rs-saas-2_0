import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { useAuth } from '../context/AuthContext';
import CreateJobModal from '../components/jobs/CreateJobModal';
import { 
    Box, Button, Typography, Container, AppBar, Toolbar, CircularProgress, 
    Table, TableBody, TableCell, TableHead, TableRow, Paper, Alert,
    FormControl, InputLabel, Select, MenuItem, Chip, Grid
} from '@mui/material';
import { formatStatus } from '../utils/formatters';

const Dashboard = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [jobs, setJobs] = useState([]);
    const [planId, setPlanId] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [openCreateModal, setOpenCreateModal] = useState(false);
    
    // Filtros
    const [statusFilter, setStatusFilter] = useState('active');
    const [areaFilter, setAreaFilter] = useState('all'); // Novo filtro de Área

    const fetchJobs = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Sessão do usuário não encontrada.");
            
            const response = await fetch('/api/jobs', { headers: { 'Authorization': `Bearer ${session.access_token}` } });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha ao buscar vagas do servidor.');
            }
            const data = await response.json();
            
            setJobs(data.jobs || []);
            setPlanId(data.planId);
            setIsAdmin(data.isAdmin);
        } catch (err) {
            console.error("Erro ao buscar vagas:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJobs();
    }, [currentUser]);

    // Extrai a lista de áreas disponíveis baseada nas vagas carregadas para preencher o filtro
    const availableAreas = useMemo(() => {
        const areas = new Set();
        jobs.forEach(job => {
            if (job.company_departments?.name) {
                areas.add(job.company_departments.name);
            }
        });
        return Array.from(areas).sort();
    }, [jobs]);

    // LÓGICA DE ORDENAÇÃO E FILTRAGEM
    const processedJobs = useMemo(() => {
      const statusPriority = { 'active': 1, 'filled': 2, 'inactive': 3 };

      return jobs
        .filter(job => {
            // Filtro de Status
            if (statusFilter !== 'all' && job.status !== statusFilter) return false;
            // Filtro de Área
            if (areaFilter !== 'all') {
                const areaName = job.company_departments?.name || 'Sem Área';
                if (areaName !== areaFilter) return false;
            }
            return true;
        })
        .sort((a, b) => {
          // 1. Por Área (Alfabética)
          const areaA = a.company_departments?.name || '';
          const areaB = b.company_departments?.name || '';
          const areaCompare = areaA.localeCompare(areaB);
          
          if (areaCompare !== 0) return areaCompare;

          // 2. Por Prioridade de Status
          const priorityA = statusPriority[a.status] || 4;
          const priorityB = statusPriority[b.status] || 4;
          if (priorityA !== priorityB) return priorityA - priorityB;
          
          // 3. Por Título
          return a.title.localeCompare(b.title);
        });
    }, [jobs, statusFilter, areaFilter]);

    const handleLogout = async () => { await supabase.auth.signOut(); };
    const handleRowClick = (jobId) => { navigate(`/vaga/${jobId}`); };
    
    const isFreemium = planId === 'freemium';
    const isJobLimitReached = isFreemium && jobs.length >= 2;

    return (
        <>
            <Box sx={{ flexGrow: 1 }}>
                <AppBar position="static">
                    <Toolbar>
                        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                            Novva R&S Dashboard
                        </Typography>
                        {isAdmin && (
                            <Button color="inherit" component={RouterLink} to="/admin">Admin</Button>
                        )}
                        <Button color="inherit" onClick={handleLogout}>Sair</Button>
                    </Toolbar>
                </AppBar>

                <Container sx={{ mt: 4 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Typography variant="h4" component="h1">Painel de Vagas</Typography>
                        <Box>
                            <Button variant="outlined" color="primary" component={RouterLink} to="/aprovados" sx={{ mr: 2 }}>
                                Ver Aprovados
                            </Button>
                            <Button 
                                variant="contained" 
                                color="primary" 
                                onClick={() => setOpenCreateModal(true)}
                                disabled={isJobLimitReached}
                            >
                                Criar Nova Vaga
                            </Button>
                        </Box>
                    </Box>

                    {isJobLimitReached && (
                        <Alert severity="info" sx={{ mb: 2 }}>Limite de vagas atingido (Plano Grátis).</Alert>
                    )}

                    {/* BARRA DE FILTROS */}
                    <Paper sx={{ p: 2, mb: 3, bgcolor: '#f8f9fa' }}>
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} md={4}>
                                <FormControl size="small" fullWidth>
                                    <InputLabel>Status</InputLabel>
                                    <Select
                                        value={statusFilter}
                                        label="Status"
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                    >
                                        <MenuItem value="all">Todos</MenuItem>
                                        <MenuItem value="active">Ativas</MenuItem>
                                        <MenuItem value="filled">Preenchidas</MenuItem>
                                        <MenuItem value="inactive">Inativas</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <FormControl size="small" fullWidth>
                                    <InputLabel>Área / Departamento</InputLabel>
                                    <Select
                                        value={areaFilter}
                                        label="Área / Departamento"
                                        onChange={(e) => setAreaFilter(e.target.value)}
                                    >
                                        <MenuItem value="all">Todas as Áreas</MenuItem>
                                        {availableAreas.map(area => (
                                            <MenuItem key={area} value={area}>{area}</MenuItem>
                                        ))}
                                        <MenuItem value="Sem Área">Sem Área Definida</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>
                    </Paper>

                    {loading && <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}><CircularProgress /></Box>}
                    {error && <Typography color="error" align="center">{error}</Typography>}
                    
                    {!loading && !error && (
                        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Nome da Vaga</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Área</TableCell> {/* NOVA COLUNA */}
                                        <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>Candidatos</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {processedJobs.length > 0 ? processedJobs.map((job) => (
                                        <TableRow 
                                            hover 
                                            key={job.id} 
                                            onClick={() => handleRowClick(job.id)}
                                            sx={{ cursor: 'pointer', opacity: job.status !== 'active' ? 0.6 : 1 }}
                                        >
                                            <TableCell>{job.title}</TableCell>
                                            <TableCell>
                                                {/* Exibição da Área */}
                                                {job.company_departments?.name ? (
                                                    <Chip label={job.company_departments.name} size="small" color="primary" variant="outlined" />
                                                ) : (
                                                    <Typography variant="caption" color="text.secondary">-</Typography>
                                                )}
                                            </TableCell>
                                            <TableCell sx={{ textTransform: 'capitalize' }}>{formatStatus(job.status)}</TableCell>
                                            <TableCell align="center">{job.candidateCount || 0}</TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                                                Nenhuma vaga encontrada para os filtros selecionados.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </Paper>
                    )}
                </Container>
            </Box>
            <CreateJobModal 
                open={openCreateModal}
                handleClose={() => setOpenCreateModal(false)}
                onJobCreated={fetchJobs}
            />
        </>
    );
};

export default Dashboard;