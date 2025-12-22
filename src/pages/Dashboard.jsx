import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { useAuth } from '../context/AuthContext';
import { formatStatus } from '../utils/formatters';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Plus, Loader2, Users, Briefcase, Building2, Crown, User, AlertCircle } from 'lucide-react';
import CreateJobModal from '../components/jobs/CreateJobModal';

const Dashboard = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth(); // Usando currentUser correto
    
    const [jobs, setJobs] = useState([]);
    const [meta, setMeta] = useState({ companyName: '...', userName: '...', planId: '...' });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [openCreateModal, setOpenCreateModal] = useState(false);
    
    const [statusFilter, setStatusFilter] = useState('active');
    const [deptFilter, setDeptFilter] = useState('all');

    // BUSCA DIRETA NO BANCO (Client-Side)
    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            if (!currentUser) return;

            // 1. Busca Perfil (Nome e Tenant)
            const { data: profile, error: profileError } = await supabase
                .from('user_profiles')
                .select(`name, tenantId, tenants ( companyName, planId )`)
                .eq('id', currentUser.id)
                .single();

            if (profileError) throw profileError;

            // 2. Busca Vagas do Tenant
            const { data: jobsData, error: jobsError } = await supabase
                .from('jobs')
                .select(`
                    *,
                    company_departments ( name ),
                    applications ( count )
                `)
                .eq('tenantId', profile.tenantId);

            if (jobsError) throw jobsError;

            // 3. Processamento
            const formattedJobs = (jobsData || []).map(job => ({
                ...job,
                candidateCount: job.applications?.[0]?.count || 0,
                deptName: job.company_departments?.name || 'Geral'
            })).sort((a, b) => {
                // Ordenação: Depto > Data
                const deptCompare = a.deptName.localeCompare(b.deptName);
                if (deptCompare !== 0) return deptCompare;
                return new Date(b.created_at) - new Date(a.created_at);
            });

            setJobs(formattedJobs);
            setMeta({
                companyName: profile.tenants?.companyName || 'Minha Empresa',
                userName: profile.name || currentUser.email,
                planId: profile.tenants?.planId || 'free'
            });

        } catch (err) {
            console.error("Erro Dashboard:", err);
            setError("Erro ao carregar dados. Verifique sua conexão.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { 
        if (currentUser) fetchData(); 
    }, [currentUser]);

    // Filtros
    const uniqueDepartments = useMemo(() => [...new Set(jobs.map(j => j.deptName))].sort(), [jobs]);
    
    const processedJobs = useMemo(() => {
        return jobs.filter(job => {
            const matchStatus = statusFilter === 'all' || job.status === statusFilter;
            const matchDept = deptFilter === 'all' || job.deptName === deptFilter;
            return matchStatus && matchDept;
        });
    }, [jobs, statusFilter, deptFilter]);

    const activeJobs = jobs.filter(j => j.status === 'active');
    const totalCandidates = jobs.reduce((acc, j) => acc + (j.candidateCount || 0), 0);
    const avgCandidates = activeJobs.length ? (totalCandidates / activeJobs.length).toFixed(1) : 0;

    const getStatusVariant = (status) => {
        return status === 'active' ? 'success' : status === 'filled' ? 'default' : 'secondary';
    };

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600"/></div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-lg border shadow-sm">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-5 h-5 text-gray-400" />
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{meta.companyName}</h1>
                        <span className="text-gray-300 mx-2">|</span>
                        <div className="flex items-center gap-2 text-gray-600 font-medium">
                            <User className="w-4 h-4" /> {meta.userName}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
                        <span>Painel de Vagas</span>
                        <span className="flex items-center text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium capitalize ml-2">
                            <Crown className="w-3 h-3 mr-1" /> Plano {meta.planId}
                        </span>
                    </div>
                </div>
                <Button onClick={() => setOpenCreateModal(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Nova Vaga
                </Button>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-700 rounded border border-red-200 flex items-center gap-2"><AlertCircle className="w-5 h-5"/>{error}</div>}

            {/* KPIs */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Vagas Ativas</CardTitle><Briefcase className="h-4 w-4 text-gray-500"/></CardHeader><CardContent><div className="text-2xl font-bold">{activeJobs.length}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Candidatos/Vaga</CardTitle><Users className="h-4 w-4 text-gray-500"/></CardHeader><CardContent><div className="text-2xl font-bold">{avgCandidates}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Candidatos</CardTitle><div>📄</div></CardHeader><CardContent><div className="text-2xl font-bold">{totalCandidates}</div></CardContent></Card>
            </div>

            {/* Lista */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                        <CardTitle>Painel de Vagas</CardTitle>
                        <div className="flex gap-2">
                            <select className="h-9 rounded-md border border-gray-300 text-sm px-3 bg-white" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                                <option value="all">Todos Departamentos</option>
                                {uniqueDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <select className="h-9 rounded-md border border-gray-300 text-sm px-3 bg-white" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                <option value="active">Ativas</option>
                                <option value="filled">Preenchidas</option>
                                <option value="inactive">Inativas</option>
                                <option value="all">Todas</option>
                            </select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {processedJobs.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed">Nenhuma vaga encontrada.</div>
                    ) : (
                        <div className="relative w-full overflow-auto">
                            <table className="w-full caption-bottom text-sm text-left">
                                <thead className="bg-gray-50/50 [&_tr]:border-b">
                                    <tr>
                                        <th className="h-10 px-4 font-medium text-gray-500">Empresa / Área</th>
                                        <th className="h-10 px-4 font-medium text-gray-500">Título</th>
                                        <th className="h-10 px-4 font-medium text-gray-500">Status</th>
                                        <th className="h-10 px-4 font-medium text-gray-500 text-center">Candidatos</th>
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {processedJobs.map((job) => (
                                        <tr key={job.id} className="border-b transition-colors hover:bg-gray-50 cursor-pointer group" onClick={() => navigate(`/jobs/${job.id}`)}>
                                            <td className="p-4 align-middle text-gray-600"><span className="font-medium text-gray-900">{meta.companyName}</span> <span className="text-gray-300 mx-2">/</span> {job.deptName}</td>
                                            <td className="p-4 align-middle font-medium text-blue-600 group-hover:underline">{job.title}</td>
                                            <td className="p-4 align-middle"><Badge variant={getStatusVariant(job.status)}>{formatStatus(job.status)}</Badge></td>
                                            <td className="p-4 align-middle text-center"><Badge variant="outline">{job.candidateCount}</Badge></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <CreateJobModal open={openCreateModal} handleClose={() => setOpenCreateModal(false)} onJobCreated={fetchData} />
        </div>
    );
};

export default Dashboard;