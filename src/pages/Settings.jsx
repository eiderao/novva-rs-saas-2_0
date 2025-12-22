import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Users, Building, Power, AlertCircle } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const [tenant, setTenant] = useState(null);
  const [plan, setPlan] = useState(null);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserInfo, setCurrentUserInfo] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Busca Perfil Atual
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setCurrentUserInfo(userProfile);

      if (userProfile?.tenantId) {
        // 2. Busca Empresa e Plano
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', userProfile.tenantId)
          .single();
        setTenant(tenantData);

        if (tenantData?.planId) {
            const { data: planData } = await supabase
                .from('plans')
                .select('*')
                .eq('id', tenantData.planId)
                .maybeSingle();
            // Fallback seguro se não achar o plano
            setPlan(planData || { name: 'Desconhecido', user_limit: 1, job_limit: 1 });
        }

        // 3. Busca Equipe
        const { data: teamData } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('tenantId', userProfile.tenantId)
          .order('active', { ascending: false }) // Ativos primeiro
          .order('name');
        setTeam(teamData || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    // Impede desativar a si mesmo
    if (userId === currentUserInfo.id) return alert("Você não pode desativar a si mesmo.");
    
    // Regra: Se for ativar, verificar limite do plano
    if (!currentStatus) {
        const activeCount = team.filter(u => u.active).length;
        const limit = plan?.user_limit || 1;
        const isUnlimited = limit === -1;

        if (!isUnlimited && activeCount >= limit) {
            return alert(`Limite do plano atingido (${limit} usuários ativos). Faça upgrade para ativar mais pessoas.`);
        }
    }

    const { error } = await supabase
        .from('user_profiles')
        .update({ active: !currentStatus })
        .eq('id', userId);

    if (error) alert("Erro ao atualizar: " + error.message);
    else fetchData();
  };

  const copyToClipboard = () => {
    const activeCount = team.filter(u => u.active).length;
    const limit = plan?.user_limit || 1;
    const isUnlimited = limit === -1;

    if (!isUnlimited && activeCount >= limit) {
        return alert("Limite de usuários atingido! Novos usuários não conseguirão entrar com este código.");
    }
    if (tenant?.id) {
      navigator.clipboard.writeText(tenant.id);
      alert("Código copiado!");
    }
  };

  if (loading) return <div className="p-10 text-center">Carregando...</div>;

  const activeUsersCount = team.filter(u => u.active).length;
  const limit = plan?.user_limit || 1;
  const isUnlimited = limit === -1;
  const isLimitReached = !isUnlimited && activeUsersCount >= limit;

  return (
    <div className="p-8 max-w-4xl mx-auto bg-gray-50 min-h-screen">
      <button onClick={() => navigate('/')} className="flex items-center text-gray-500 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4 mr-2"/> Voltar para Dashboard
      </button>

      <h1 className="text-3xl font-bold text-gray-900 mb-8">Configurações & Equipe</h1>

      {/* Cartão do Plano */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <div className="flex justify-between items-start">
            <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 text-purple-600 rounded">
                <Building size={24} />
            </div>
            <div>
                <h2 className="text-xl font-bold text-gray-800">{tenant?.companyName}</h2>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">
                        Plano {plan?.name || 'Freemium'}
                    </span>
                    {isLimitReached && <span className="text-xs text-red-600 flex items-center"><AlertCircle size={12} className="mr-1"/> Limite Atingido</span>}
                </div>
            </div>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div className="bg-gray-50 p-3 rounded border">
                <p className="text-xs text-gray-500 uppercase font-bold">Usuários Ativos</p>
                <p className={`text-lg font-bold ${isLimitReached ? 'text-red-600' : 'text-gray-800'}`}>
                    {activeUsersCount} / {isUnlimited ? '∞' : limit}
                </p>
            </div>
            <div className="bg-gray-50 p-3 rounded border">
                <p className="text-xs text-gray-500 uppercase font-bold">ID da Empresa (Código)</p>
                <div className="flex justify-between items-center mt-1">
                    <code className="text-sm">{tenant?.id}</code>
                    <button onClick={copyToClipboard} className="text-blue-600 text-xs font-bold hover:underline">COPIAR</button>
                </div>
            </div>
        </div>
      </div>

      {/* Lista da Equipe */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="p-6 border-b bg-gray-50">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
                <Users size={20}/> Gerenciar Acesso
            </h3>
        </div>
        
        <table className="w-full text-left text-sm">
          <thead className="border-b text-gray-500">
            <tr>
              <th className="p-4">Usuário</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {team.map(member => (
              <tr key={member.id} className={`border-b last:border-0 ${!member.active ? 'bg-gray-50 opacity-60' : ''}`}>
                <td className="p-4">
                  <p className="font-medium text-gray-900">{member.name || 'Sem nome'}</p>
                  <p className="text-xs text-gray-500">{member.email}</p>
                  <span className="text-xs text-gray-400">{member.role === 'admin' ? 'Administrador' : 'Avaliador'}</span>
                </td>
                <td className="p-4">
                  {member.active ? (
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">Ativo</span>
                  ) : (
                    <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold">Inativo</span>
                  )}
                </td>
                <td className="p-4 text-right">
                  {currentUserInfo.role === 'admin' && member.id !== currentUserInfo.id && (
                      <button 
                        onClick={() => toggleUserStatus(member.id, member.active)}
                        className={`p-2 rounded hover:bg-gray-100 transition ${member.active ? 'text-red-500' : 'text-green-600'}`}
                        title={member.active ? "Desativar Acesso" : "Reativar Acesso"}
                      >
                        <Power size={18} />
                      </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}