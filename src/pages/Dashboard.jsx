import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { useAuth } from '../context/AuthContext';
import { formatStatus } from '../utils/formatters';

import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Plus, Loader2, Users, Briefcase, Building2, Crown } from 'lucide-react';
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
    const { currentUser } = useAuth(); // Se tiver o objeto user no contexto
    
    const [jobs, setJobs] = useState([]);
    const [planId, setPlanId] = useState(null);
    const [companyName, setCompanyName] = useState(''); // Novo estado para nome da empresa
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [openCreateModal, setOpenCreateModal] = useState(false);
    
    // Filtros
    const [statusFilter, setStatusFilter] = useState('active');
    const [deptFilter, setDeptFilter] = useState('all');

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Sessão não encontrada.");
            
            // 1. Busca Vagas
            const response = await fetch('/api/jobs', { 
                headers: { 'Authorization': `Bearer ${session.access_token}` } 
            });

            if (!response.ok) throw new Error('Falha ao buscar vagas.');
            const data = await response.json();
            setJobs(data.jobs || []);
            setPlanId(data.planId);

            // 2. Busca Nome da Empresa (Tenant)
            // Precisamos pegar o tenantId do usuário primeiro para buscar o nome
            const { data: userData } = await supabase
                .from('users')
                .select('tenantId')
                .eq('id', session.user.id)
                .single();

            if (userData?.tenantId) {
                const { data: tenantData } = await supabase
                    .from('tenants')
                    .select('companyName')
                    .eq('id', userData.tenantId)
                    .single();
                setCompanyName(tenantData?.companyName || 'Sua Empresa');
            }

        } catch (err) {
            console.error("Erro:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // Extrai departamentos únicos para o filtro
    const uniqueDepartments = useMemo(() => {
        const depts = jobs.map(j => j.company_departments?.name).filter(Boolean);
        return [...new Set(depts)];
    }, [jobs]);

    const processedJobs = useMemo(() => {
      return jobs
        .filter(job => {
            const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
            const matchesDept = deptFilter === 'all' || job.company_departments?.name === deptFilter;
            return matchesStatus && matchesDept;
        })
        .sort((a, b) => {
          const priorityA = STATUS_PRIORITY[a.status] || 99;
          const priorityB = STATUS_PRIORITY[b.status] || 99;
          if (priorityA !== priorityB) return priorityA - priorityB;
          return a.title.localeCompare(b.title);
        });
    }, [jobs, statusFilter, deptFilter]);

    // KPIs Atualizados
    const activeJobsCount = jobs.filter(j => j.status === 'active').length;
    const totalCandidates = jobs.reduce((acc, job) => acc + (job.candidateCount || 0), 0);
    // KPI 2: Candidatos por Vaga (Média)
    const candidatesPerJob = activeJobsCount > 0 ? (totalCandidates / activeJobsCount).toFixed(1) : '0';

    return (
        <div className="space-y-6">
            {/* Header com Info da Empresa e Plano (Ponto 3) */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-lg border shadow-sm">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-5 h-5 text-gray-400" />
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                            {loading ? 'Carregando...' : companyName}
                        </h1>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>Painel de Recrutamento</span>
                        <span>•</span>
                        <span className="flex items-center text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium capitalize">
                            <Crown className="w-3 h-3 mr-1" />
                            Plano {planId || '...'}
                        </span>
                    </div>
                </div>
                <Button onClick={() => setOpenCreateModal(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Nova Vaga
                </Button>
            </div>

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
                        {/* Ponto 2: KPI ajustado */}
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
                            {/* Filtro de Departamento (Ponto 1) */}
                            <select 
                                className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 h-9"
                                value={deptFilter}
                                onChange={(e) => setDeptFilter(e.target.value)}
                            >
                                <option value="all">Todos Departamentos</option>
                                {uniqueDepartments.map(dept => (
                                    <option key={dept} value={dept}>{dept}</option>
                                ))}
                            </select>

                            {/* Filtro de Status */}
                            <select 
                                className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 h-9"
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
                        <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
                    ) : error ? (
                        <div className="text-red-500 text-center py-4">{error}</div>
                    ) : processedJobs.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">Nenhuma vaga encontrada com estes filtros.</div>
                    ) : (
                        <div className="relative w-full overflow-auto">
                            <table className="w-full caption-bottom text-sm text-left">
                                <thead className="[&_tr]:border-b bg-gray-50/50">
                                    <tr className="border-b transition-colors">
                                        <th className="h-10 px-4 align-middle font-medium text-gray-500">Título</th>
                                        {/* Ponto 1: Coluna Departamento */}
                                        <th className="h-10 px-4 align-middle font-medium text-gray-500">Departamento</th>
                                        <th className="h-10 px-4 align-middle font-medium text-gray-500">Status</th>
                                        <th className="h-10 px-4 align-middle font-medium text-gray-500 text-center">Candidatos</th>
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {processedJobs.map((job) => (
                                        <tr 
                                            key={job.id} 
                                            className="border-b transition-colors hover:bg-gray-50 cursor-pointer"
                                            onClick={() => navigate(`/jobs/${job.id}`)}
                                        >
                                            <td className="p-4 align-middle font-medium text-blue-600 hover:underline">
                                                {job.title}
                                            </td>
                                            <td className="p-4 align-middle text-gray-600">
                                                {job.company_departments?.name || '-'}
                                            </td>
                                            <td className="p-4 align-middle">
                                                <Badge variant={getStatusVariant(job.status)}>
                                                    {formatStatus(job.status)}
                                                </Badge>
                                            </td>
                                            <td className="p-4 align-middle text-center">
                                                <Badge variant="outline" className="bg-gray-50">
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
                onJobCreated={fetchData} // Atualiza a lista após criar
            />
        </div>
    );
};

export default Dashboard;