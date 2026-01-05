import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase/client';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Briefcase, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  Calendar,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeJobs: 0,
    totalApplications: 0,
    hiredCandidates: 0,
    pendingEvaluations: 0
  });
  const [recentApplications, setRecentApplications] = useState([]);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [tenant, setTenant] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/login');
        return;
      }

      // 1. Busca Perfil
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        setCurrentUserProfile(profile);

        // 2. Busca Empresa (Tenant) para exibir o nome no cabeçalho
        if (profile.tenantId) {
            const { data: tenantData } = await supabase
                .from('tenants')
                .select('companyName')
                .eq('id', profile.tenantId)
                .single();
            setTenant(tenantData);
        }
        
        const tenantId = profile.tenantId;

        // 3. Busca Estatísticas (Filtradas pelo Tenant)
        
        // Vagas Ativas
        const { count: activeJobsCount } = await supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .eq('tenantId', tenantId)
          .eq('status', 'active');

        // Total de Candidaturas (em vagas deste tenant)
        // Precisamos filtrar applications cujas vagas pertencem ao tenant
        // A melhor forma é buscar as vagas do tenant e depois as applications
        const { data: tenantJobs } = await supabase
            .from('jobs')
            .select('id')
            .eq('tenantId', tenantId);
            
        const jobIds = tenantJobs.map(j => j.id);
        
        let totalApps = 0;
        let hiredCount = 0;
        let recentAppsData = [];

        if (jobIds.length > 0) {
            const { count: appsCount } = await supabase
                .from('applications')
                .select('*', { count: 'exact', head: true })
                .in('jobId', jobIds);
            totalApps = appsCount || 0;

            const { count: hired } = await supabase
                .from('applications')
                .select('*', { count: 'exact', head: true })
                .in('jobId', jobIds)
                .eq('isHired', true);
            hiredCount = hired || 0;

            // Busca Candidaturas Recentes
            const { data: recent } = await supabase
                .from('applications')
                .select(`
                    id, 
                    created_at, 
                    job:jobs(title), 
                    candidate:candidates(name, email)
                `)
                .in('jobId', jobIds)
                .order('created_at', { ascending: false })
                .limit(5);
            recentAppsData = recent || [];
        }

        setStats({
          activeJobs: activeJobsCount || 0,
          totalApplications: totalApps,
          hiredCandidates: hiredCount,
          pendingEvaluations: 0 // Placeholder para lógica futura se necessário
        });

        setRecentApplications(recentAppsData);
      }

    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500 font-medium">Carregando indicadores...</p>
        </div>
      </div>
    );
  }

  // Dados para os gráficos (Mockados para visualização, idealmente viriam do banco)
  const chartData = [
    { name: 'Seg', candidaturas: 4 },
    { name: 'Ter', candidaturas: 7 },
    { name: 'Qua', candidaturas: 5 },
    { name: 'Qui', candidaturas: 12 },
    { name: 'Sex', candidaturas: 9 },
    { name: 'Sáb', candidaturas: 3 },
    { name: 'Dom', candidaturas: 2 },
  ];

  const pieData = [
    { name: 'Triagem', value: stats.totalApplications - stats.hiredCandidates },
    { name: 'Contratados', value: stats.hiredCandidates },
  ];
  const COLORS = ['#94a3b8', '#16a34a'];

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans bg-gray-50 min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
             {/* ALTERAÇÃO SOLICITADA: Empresa / Usuário */}
             {tenant?.companyName ? `${tenant.companyName} / ` : ''}{currentUserProfile?.name}
          </h1>
          <p className="text-gray-500 mt-1 flex items-center gap-2">
            <Calendar size={16}/> {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-3">
            <button onClick={() => navigate('/jobs/new')} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition flex items-center gap-2">
                <Briefcase size={18}/> Nova Vaga
            </button>
        </div>
      </div>

      {/* Cards de KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-4">
                <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                    <Briefcase size={24} />
                </div>
                <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">+2 essa semana</span>
            </div>
            <p className="text-gray-500 text-sm font-medium">Vagas Ativas</p>
            <h3 className="text-3xl font-bold text-gray-900">{stats.activeJobs}</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-4">
                <div className="bg-purple-50 p-3 rounded-xl text-purple-600">
                    <Users size={24} />
                </div>
                <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">+12%</span>
            </div>
            <p className="text-gray-500 text-sm font-medium">Total Candidaturas</p>
            <h3 className="text-3xl font-bold text-gray-900">{stats.totalApplications}</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-4">
                <div className="bg-green-50 p-3 rounded-xl text-green-600">
                    <CheckCircle size={24} />
                </div>
            </div>
            <p className="text-gray-500 text-sm font-medium">Contratações</p>
            <h3 className="text-3xl font-bold text-gray-900">{stats.hiredCandidates}</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-4">
                <div className="bg-orange-50 p-3 rounded-xl text-orange-600">
                    <Clock size={24} />
                </div>
            </div>
            <p className="text-gray-500 text-sm font-medium">Aguardando Avaliação</p>
            <h3 className="text-3xl font-bold text-gray-900">{stats.pendingEvaluations}</h3>
        </div>
      </div>

      {/* Gráficos e Listas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Gráfico Principal */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                    <TrendingUp size={20} className="text-blue-600"/> Fluxo de Candidaturas
                </h3>
                <select className="text-sm border-gray-200 rounded-lg text-gray-500 bg-gray-50 p-1">
                    <option>Últimos 7 dias</option>
                    <option>Este Mês</option>
                </select>
            </div>
            <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10}/>
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}}/>
                        <Tooltip 
                            cursor={{fill: '#f8fafc'}}
                            contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                        />
                        <Bar dataKey="candidaturas" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Funil / Pizza */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 text-lg mb-6">Conversão</h3>
            <div className="h-60 relative">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={pieData}
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                    <span className="text-3xl font-bold text-gray-800">{stats.hiredCandidates}</span>
                    <span className="text-xs text-gray-500 uppercase font-bold">Contratados</span>
                </div>
            </div>
            <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2 text-gray-600"><div className="w-3 h-3 rounded-full bg-green-600"></div> Contratados</span>
                    <span className="font-bold">{stats.hiredCandidates}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2 text-gray-600"><div className="w-3 h-3 rounded-full bg-slate-400"></div> Em Processo</span>
                    <span className="font-bold">{stats.totalApplications - stats.hiredCandidates}</span>
                </div>
            </div>
        </div>

        {/* Candidaturas Recentes */}
        <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-gray-800 text-lg">Candidaturas Recentes</h3>
                <button onClick={() => navigate('/jobs')} className="text-blue-600 text-sm font-bold hover:underline flex items-center gap-1">
                    Ver todas <ArrowRight size={14}/>
                </button>
            </div>
            
            {recentApplications.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                    <AlertCircle className="mx-auto mb-2 opacity-50" size={32}/>
                    <p>Nenhuma candidatura recente.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="text-xs text-gray-500 uppercase border-b border-gray-100">
                            <tr>
                                <th className="pb-3 font-semibold pl-4">Candidato</th>
                                <th className="pb-3 font-semibold">Vaga</th>
                                <th className="pb-3 font-semibold">Data</th>
                                <th className="pb-3 font-semibold text-right pr-4">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {recentApplications.map((app) => (
                                <tr key={app.id} className="hover:bg-blue-50/50 transition">
                                    <td className="py-4 pl-4">
                                        <p className="font-bold text-gray-900 text-sm">{app.candidate?.name || 'Desconhecido'}</p>
                                        <p className="text-xs text-gray-500">{app.candidate?.email}</p>
                                    </td>
                                    <td className="py-4 text-sm text-gray-700">{app.job?.title}</td>
                                    <td className="py-4 text-sm text-gray-500">{new Date(app.created_at).toLocaleDateString()}</td>
                                    <td className="py-4 text-right pr-4">
                                        <button 
                                            onClick={() => navigate(`/applications/${app.id}`)}
                                            className="text-xs font-bold bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 hover:text-blue-600 transition shadow-sm"
                                        >
                                            Ver Perfil
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>

      </div>
    </div>
  );
}
