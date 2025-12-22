import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { useAuth } from '../context/AuthContext';
import { formatStatus } from '../utils/formatters';

import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Plus, Loader2, Users, Briefcase, Building2, Crown, User, AlertTriangle } from 'lucide-react';
import CreateJobModal from '../components/jobs/CreateJobModal';

const STATUS_PRIORITY = { 'active': 1, 'filled': 2, 'inactive': 3 };

const getStatusVariant = (status) => {
    switch (status) {
        case 'active': return 'success';
        case 'filled': return 'default';
        case 'inactive': return 'secondary';
        default: return 'outline';
    }
};

const Dashboard = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    
    // Estados Consolidados
    const [jobs, setJobs] = useState([]);
    const [meta, setMeta] = useState({ companyName: '', userName: '', planId: '' });
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [openCreateModal, setOpenCreateModal] = useState(false);
    
    // Filtros
    const [statusFilter, setStatusFilter] = useState('active');
    const [deptFilter, setDeptFilter] = useState('all');

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                // Se não tem sessão, força logout/login
                navigate('/login');
                return;
            }
            
            // Chamada ÚNICA e CENTRALIZADA
            const response = await fetch('/api/jobs', { 
                headers: { 'Authorization': `Bearer ${session.access_token}` } 
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.details || data.error || 'Falha na comunicação com o servidor.');
            }
            
            setJobs(data.jobs || []);
            // Preenche os metadados vindos do servidor
            if (data.meta) {
                setMeta(data.meta);
            }

        } catch (err) {
            console.error("Erro Dashboard:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { 
        if (currentUser) fetchData(); 
    }, [currentUser]);

    // Extrai departamentos únicos para o filtro (Baseado nos dados recebidos)
    const uniqueDepartments = useMemo(() => {
        const depts = jobs.map(j => j.deptName).filter(Boolean);
        return [...new Set(depts)];
    }, [jobs]);

    const processedJobs = useMemo(() => {
      return jobs
        .filter(job => {
            const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
            const matchesDept = deptFilter === 'all' || job.deptName === deptFilter;
            return matchesStatus && matchesDept;
        });
        // A ordenação já vem feita do backend (Regra 5), então não precisamos reordenar aqui
        // a menos que o usuário mude um filtro que exija reordenação visual.
    }, [jobs, statusFilter, deptFilter]);

    // KPIs
    const activeJobsCount = jobs.filter(j => j.status === 'active').length;
    const totalCandidates = jobs.reduce((acc, job) => acc + (job.candidateCount || 0), 0);
    const candidatesPerJob = activeJobsCount > 0 ? (totalCandidates / activeJobsCount).toFixed(1) : '0';

    return (
        <div className="space-y-6">
            {/* Header com Info da Empresa e Usuário */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-lg border shadow-sm">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-5 h-5 text-gray-400" />
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                            {loading ? '...' : meta.companyName || 'Empresa não identificada'}
                        </h1>
                        <span className="text-gray-300 text-2xl mx-1 font-light">|</span>
                        <div className="flex items-center gap-2 text-gray-600 font-medium">
                            <User className="w-5 h-5" />
                            {loading ? '...' : meta.userName}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
                        <span>Painel de Vagas</span>
                        <span>•</span>
                        <span className="flex items-center text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium capitalize">
                            <Crown className="w-3 h-3 mr-1" />
                            Plano {meta.planId || '...'}
                        </span>
                    </div>
                </div>
                <Button onClick={() => setOpenCreateModal(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Nova Vaga
                </Button>
            </div>

            {/* Tratamento de Erro Visual */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5" />
                    <div>
                        <p className="font-bold">Não foi possível carregar os dados.</p>
                        <p className="text-sm">{error}</p>
                    </div>
                    <Button variant="outline" size="sm" className="ml-auto bg-white" onClick={fetchData}>
                        Tentar Novamente
                    </Button>
                </div>
            )}

            {/* Cards de Métricas */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Vagas Ativas</CardTitle>
                        <Briefcase className="h-4 w-4 text-gray-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeJobsCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Candidatos / Vaga</CardTitle>
                        <Users className="h-4 w-4 text-gray-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{candidatesPerJob}</div>
                        <p className="text-xs text-gray-500 mt-1">Média em vagas ativas</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Currículos</CardTitle>
                        <div className="h-4 w-4 text-gray-500">📄</div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalCandidates}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Filtros e Tabela */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <CardTitle>Gerenciar Vagas</CardTitle>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <select 
                                className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 h-9 bg-white px-2"
                                value={deptFilter}
                                onChange={(e) => setDeptFilter(e.target.value)}
                            >
                                <option value="all">Todos Departamentos</option>
                                {uniqueDepartments.map(dept => (
                                    <option key={dept} value={dept}>{dept}</option>
                                ))}
                            </select>

                            <select 
                                className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 h-9 bg-white px-2"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="active">Ativas</option>
                                <option value="filled">Preenchidas</option>
                                <option value="inactive">Inativas</option>
                                <option value="all">Todas</option>
                            </select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
                    ) : processedJobs.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
                            <p>Nenhuma vaga encontrada com estes filtros.</p>
                            {statusFilter !== 'all' && (
                                <Button variant="link" onClick={() => setStatusFilter('all')}>Limpar filtros</Button>
                            )}
                        </div>
                    ) : (
                        <div className="relative w-full overflow-auto">
                            <table className="w-full caption-bottom text-sm text-left">
                                <thead className="[&_tr]:border-b bg-gray-50/50">
                                    <tr className="border-b transition-colors">
                                        <th className="h-10 px-4 align-middle font-medium text-gray-500">Título</th>
                                        <th className="h-10 px-4 align-middle font-medium text-gray-500">Departamento</th>
                                        <th className="h-10 px-4 align-middle font-medium text-gray-500">Status</th>
                                        <th className="h-10 px-4 align-middle font-medium text-gray-500 text-center">Candidatos</th>
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {processedJobs.map((job) => (
                                        <tr 
                                            key={job.id} 
                                            className="border-b transition-colors hover:bg-gray-50 cursor-pointer group"
                                            onClick={() => navigate(`/jobs/${job.id}`)}
                                        >
                                            <td className="p-4 align-middle font-medium text-blue-600 group-hover:underline">
                                                {job.title}
                                            </td>
                                            <td className="p-4 align-middle text-gray-600">
                                                {job.deptName}
                                            </td>
                                            <td className="p-4 align-middle">
                                                <Badge variant={getStatusVariant(job.status)}>
                                                    {formatStatus(job.status)}
                                                </Badge>
                                            </td>
                                            <td className="p-4 align-middle text-center">
                                                <Badge variant="outline" className="bg-gray-50 text-gray-700">
                                                    {job.candidateCount || 0}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <CreateJobModal 
                open={openCreateModal}
                handleClose={() => setOpenCreateModal(false)}
                onJobCreated={fetchData} 
            />
        </div>
    );
};

export default Dashboard;