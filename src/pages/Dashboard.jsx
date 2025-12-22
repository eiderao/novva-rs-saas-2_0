import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { useAuth } from '../context/AuthContext';
import { formatStatus } from '../utils/formatters';

// Componentes UI
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Plus, Loader2, Users, Briefcase } from 'lucide-react';
import CreateJobModal from '../components/jobs/CreateJobModal';

const STATUS_PRIORITY = { 'active': 1, 'filled': 2, 'inactive': 3 };

const getStatusVariant = (status) => {
    switch (status) {
        case 'active': return 'success';
        case 'filled': return 'default'; // Blue
        case 'inactive': return 'secondary';
        default: return 'outline';
    }
};

const Dashboard = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    
    // Estados
    const [jobs, setJobs] = useState([]);
    const [planId, setPlanId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [openCreateModal, setOpenCreateModal] = useState(false);
    const [statusFilter, setStatusFilter] = useState('active');

    const fetchJobs = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Sessão não encontrada.");
            
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
        } catch (err) {
            console.error("Erro:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchJobs(); }, [currentUser]);

    const processedJobs = useMemo(() => {
      return jobs
        .filter(job => statusFilter === 'all' || job.status === statusFilter)
        .sort((a, b) => {
          const priorityA = STATUS_PRIORITY[a.status] || 99;
          const priorityB = STATUS_PRIORITY[b.status] || 99;
          if (priorityA !== priorityB) return priorityA - priorityB;
          return a.title.localeCompare(b.title);
        });
    }, [jobs, statusFilter]);

    // Métricas rápidas
    const totalCandidates = jobs.reduce((acc, job) => acc + (job.candidateCount || 0), 0);
    const activeJobsCount = jobs.filter(j => j.status === 'active').length;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
                    <p className="text-gray-500">Visão geral do seu recrutamento.</p>
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
                        <CardTitle className="text-sm font-medium">Total de Candidatos</CardTitle>
                        <Users className="h-4 w-4 text-gray-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalCandidates}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Plano Atual</CardTitle>
                        <div className="h-4 w-4 text-gray-500">💎</div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold capitalize">{planId || '...'}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Filtros e Tabela */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Suas Vagas</CardTitle>
                        <select 
                            className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="active">Apenas Ativas</option>
                            <option value="filled">Preenchidas</option>
                            <option value="inactive">Inativas</option>
                            <option value="all">Todas</option>
                        </select>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
                    ) : error ? (
                        <div className="text-red-500 text-center py-4">{error}</div>
                    ) : processedJobs.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">Nenhuma vaga encontrada.</div>
                    ) : (
                        <div className="relative w-full overflow-auto">
                            <table className="w-full caption-bottom text-sm text-left">
                                <thead className="[&_tr]:border-b">
                                    <tr className="border-b transition-colors hover:bg-gray-50/50">
                                        <th className="h-12 px-4 align-middle font-medium text-gray-500">Título</th>
                                        <th className="h-12 px-4 align-middle font-medium text-gray-500">Status</th>
                                        <th className="h-12 px-4 align-middle font-medium text-gray-500 text-center">Candidatos</th>
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
                onJobCreated={fetchJobs}
            />
        </div>
    );
};

export default Dashboard;