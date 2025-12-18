// src/pages/Dashboard.jsx (VERSÃO FINAL com Filtro e Ordenação Aprimorada)
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { useAuth } from '../context/AuthContext';
import CreateJobModal from '../components/jobs/CreateJobModal';
import { 
    Box, Button, Typography, Container, AppBar, Toolbar, CircularProgress, 
    Table, TableBody, TableCell, TableHead, TableRow, Paper, Alert,
    FormControl, InputLabel, Select, MenuItem // Adicionado para o Filtro
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
    
    // NOVO ESTADO para o filtro de status
    const [statusFilter, setStatusFilter] = useState('active'); // Inicia mostrando apenas vagas ativas

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
            
            // Removemos a lógica de ordenação daqui
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

    // NOVA LÓGICA DE ORDENAÇÃO E FILTRO
    const processedJobs = useMemo(() => {
      // Define a prioridade de ordenação
      const statusPriority = {
        'active': 1,
        'filled': 2,
        'inactive': 3
      };

      return jobs
        .sort((a, b) => {
          const priorityA = statusPriority[a.status] || 4;
          const priorityB = statusPriority[b.status] || 4;
          
          // 1. Ordena pela prioridade do status
          if (priorityA !== priorityB) {
            return priorityA - priorityB;
          }
          
          // 2. Se a prioridade for a mesma, ordena alfabeticamente pelo título
          return a.title.localeCompare(b.title);
        })
        .filter(job => {
          // 3. Aplica o filtro de status
          if (statusFilter === 'all') return true;
          return job.status === statusFilter;
        });
    }, [jobs, statusFilter]); // Recalcula apenas se as vagas ou o filtro mudarem

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
                            <Button color="inherit" component={RouterLink} to="/admin">
                                Admin
                            </Button>
                        )}
                        <Button color="inherit" onClick={handleLogout}>Sair</Button>
                    </Toolbar>
                </AppBar>

                <Container sx={{ mt: 4 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                        <Typography variant="h4" component="h1">
                            Painel de Vagas
                        </Typography>
                        <Box>
                            <Button variant="outlined" color="primary" size="large" component={RouterLink} to="/aprovados" sx={{ mr: 2 }}>
                                Ver Aprovados
                            </Button>
                            <Button 
                                variant="contained" 
                                color="primary" 
                                size="large"
                                onClick={() => setOpenCreateModal(true)}
                                disabled={isJobLimitReached}
                            >
                                Criar Nova Vaga
                            </Button>
                        </Box>
                    </Box>

                    {isJobLimitReached && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                            Você atingiu o limite de 2 vagas para o plano freemium.
                        </Alert>
                    )}

                    {/* NOVO CAMPO DE FILTRO */}
                    <Box sx={{ mb: 2 }}>
                      <FormControl size="small" sx={{ minWidth: 240 }}>
                        <InputLabel id="status-filter-label">Filtrar por Status</InputLabel>
                        <Select
                          labelId="status-filter-label"
                          value={statusFilter}
                          label="Filtrar por Status"
                          onChange={(e) => setStatusFilter(e.target.value)}
                        >
                          <MenuItem value="all">Todos os Status</MenuItem>
                          <MenuItem value="active">Ativas</MenuItem>
                          <MenuItem value="filled">Preenchidas</MenuItem>
                          <MenuItem value="inactive">Inativas</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>

                    {loading && <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}><CircularProgress /></Box>}
                    {error && <Typography color="error" align="center">Erro: {error}</Typography>}
                    
                    {!loading && !error && (
                        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Nome da Vaga</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>Candidatos</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {/* USA A NOVA LISTA PROCESSADA */}
                                    {processedJobs.length > 0 ? processedJobs.map((job) => (
                                        <TableRow 
                                            hover 
                                            key={job.id} 
                                            onClick={() => handleRowClick(job.id)}
                                            sx={{ 
                                                cursor: 'pointer',
                                                backgroundColor: job.status !== 'active' ? '#f5f5f5' : 'transparent',
                                                color: job.status !== 'active' ? '#9e9e9e' : 'inherit'
                                            }}
                                        >
                                            <TableCell>{job.title}</TableCell>
                                            <TableCell sx={{ textTransform: 'capitalize' }}>{formatStatus(job.status)}</TableCell>
                                            <TableCell align="center">{job.candidateCount || 0}</TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={3} align="center">
                                                Nenhuma vaga encontrada para este filtro.
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