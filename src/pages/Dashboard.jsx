// src/pages/Dashboard.jsx (VERSÃO FINAL: UX Aprimorada e Chips de Status)
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { useAuth } from '../context/AuthContext';
import CreateJobModal from '../components/jobs/CreateJobModal';
import { 
    Box, Button, Typography, Container, AppBar, Toolbar, CircularProgress, 
    Table, TableBody, TableCell, TableHead, TableRow, Paper, Alert,
    FormControl, InputLabel, Select, MenuItem, Chip, Stack
} from '@mui/material';
import { formatStatus } from '../utils/formatters';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

// Função auxiliar para definir cores dos status (Design System)
const getStatusColor = (status) => {
    switch (status) {
        case 'active': return 'success';   // Verde
        case 'filled': return 'info';      // Azul
        case 'inactive': return 'default'; // Cinza
        default: return 'default';
    }
};

// Prioridade de ordenação (Constante para não recriar a cada render)
const STATUS_PRIORITY = {
    'active': 1,
    'filled': 2,
    'inactive': 3
};

const Dashboard = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    
    // Estados de Dados
    const [jobs, setJobs] = useState([]);
    const [planId, setPlanId] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    
    // Estados de UI
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [openCreateModal, setOpenCreateModal] = useState(false);
    const [statusFilter, setStatusFilter] = useState('active'); // UX: Padrão 'active' foca no que importa

    const fetchJobs = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            // Nota: O arquivo client.js já garante que as chaves existem
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Sessão do usuário não encontrada.");
            
            const response = await fetch('/api/jobs', { 
                headers: { 'Authorization': `Bearer ${session.access_token}` } 
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha ao buscar vagas.');
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

    // Lógica de Filtro e Ordenação Otimizada (Memoized)
    const processedJobs = useMemo(() => {
      return jobs
        .filter(job => {
          if (statusFilter === 'all') return true;
          return job.status === statusFilter;
        })
        .sort((a, b) => {
          // 1. Ordena pela prioridade do status
          const priorityA = STATUS_PRIORITY[a.status] || 99;
          const priorityB = STATUS_PRIORITY[b.status] || 99;
          
          if (priorityA !== priorityB) return priorityA - priorityB;
          
          // 2. Desempate: Ordem alfabética
          return a.title.localeCompare(b.title);
        });
    }, [jobs, statusFilter]);

    const handleLogout = async () => { await supabase.auth.signOut(); };
    const handleRowClick = (jobId) => { navigate(`/vaga/${jobId}`); };
    
    const isFreemium = planId === 'freemium';
    const isJobLimitReached = isFreemium && jobs.length >= 2;

    return (
        <>
            <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: '#f5f5f5' }}>
                <AppBar position="static" color="default" elevation={1}>
                    <Toolbar>
                        <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold', color: 'primary.main' }}>
                            Novva R&S
                        </Typography>
                        {isAdmin && (
                            <Button color="inherit" component={RouterLink} to="/admin" sx={{ mr: 1 }}>
                                Admin System
                            </Button>
                        )}
                        <Button color="inherit" onClick={handleLogout}>Sair</Button>
                    </Toolbar>
                </AppBar>

                <Container sx={{ mt: 4, pb: 4 }}>
                    {/* Cabeçalho da Página */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
                        <Typography variant="h4" component="h1" fontWeight="500">
                            Painel de Vagas
                        </Typography>
                        <Stack direction="row" spacing={2}>
                            <Button 
                                variant="outlined" 
                                startIcon={<CheckCircleIcon />}
                                component={RouterLink} 
                                to="/aprovados"
                            >
                                Ver Aprovados
                            </Button>
                            <Button 
                                variant="contained" 
                                startIcon={<AddIcon />}
                                onClick={() => setOpenCreateModal(true)}
                                disabled={isJobLimitReached}
                            >
                                Nova Vaga
                            </Button>
                        </Stack>
                    </Box>

                    {isJobLimitReached && (
                        <Alert severity="info" sx={{ mb: 3 }}>
                            Seu plano <strong>Freemium</strong> permite até 2 vagas. Faça um upgrade para criar mais.
                        </Alert>
                    )}

                    {/* Barra de Ferramentas da Tabela */}
                    <Paper sx={{ mb: 3, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <FormControl size="small" sx={{ minWidth: 200 }}>
                                <InputLabel id="status-filter-label">Status da Vaga</InputLabel>
                                <Select
                                    labelId="status-filter-label"
                                    value={statusFilter}
                                    label="Status da Vaga"
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                >
                                    <MenuItem value="active">Apenas Ativas</MenuItem>
                                    <MenuItem value="filled">Preenchidas</MenuItem>
                                    <MenuItem value="inactive">Inativas</MenuItem>
                                    <Divider />
                                    <MenuItem value="all">Todas as Vagas</MenuItem>
                                </Select>
                            </FormControl>
                            <Typography variant="body2" color="text.secondary">
                                Exibindo <strong>{processedJobs.length}</strong> de {jobs.length} vagas
                            </Typography>
                        </Box>
                    </Paper>

                    {/* Área de Conteúdo */}
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', my: 8 }}><CircularProgress /></Box>
                    ) : error ? (
                        <Alert severity="error">Erro ao carregar dados: {error}</Alert>
                    ) : (
                        <Paper sx={{ width: '100%', overflow: 'hidden', boxShadow: 2 }}>
                            <Table>
                                <TableHead sx={{ bgcolor: '#f9fafb' }}>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Título da Vaga</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold', width: '150px' }}>Status</TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 'bold', width: '150px' }}>Candidatos</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {processedJobs.length > 0 ? processedJobs.map((job) => (
                                        <TableRow 
                                            hover 
                                            key={job.id} 
                                            onClick={() => handleRowClick(job.id)}
                                            sx={{ cursor: 'pointer', transition: '0.2s' }}
                                        >
                                            <TableCell>
                                                <Typography variant="body1" fontWeight="500">{job.title}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip 
                                                    label={formatStatus(job.status)} 
                                                    color={getStatusColor(job.status)}
                                                    size="small"
                                                    variant={job.status === 'active' ? 'filled' : 'outlined'}
                                                />
                                            </TableCell>
                                            <TableCell align="center">
                                                <Chip 
                                                    label={job.candidateCount || 0} 
                                                    size="small" 
                                                    variant="outlined" 
                                                    sx={{ minWidth: 40 }}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={3} align="center" sx={{ py: 6 }}>
                                                <Typography color="text.secondary">
                                                    Nenhuma vaga encontrada com o filtro atual.
                                                </Typography>
                                                {statusFilter !== 'all' && (
                                                    <Button onClick={() => setStatusFilter('all')} sx={{ mt: 1 }}>
                                                        Limpar Filtros
                                                    </Button>
                                                )}
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

// Pequeno ajuste para importar Divider que esqueci no topo
import { Divider } from '@mui/material';

export default Dashboard;