import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { Building, Users, Save, Shield, CheckCircle, XCircle, Trash2, AlertTriangle, ArrowLeft } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('company');
  const [loading, setLoading] = useState(true);
  
  const [currentUser, setCurrentUser] = useState(null);
  
  // Estado da Empresa e Plano
  const [tenant, setTenant] = useState({ 
    name: '', 
    planId: '', 
    planName: 'Carregando...', 
    userLimit: 1 
  });
  
  const [team, setTeam] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Pega usuário logado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // 2. Busca dados do usuário
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;
      setCurrentUser(userData);

      if (userData?.tenantId) {
        // 3. Busca Empresa e o ID do Plano
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('companyName, planId') 
          .eq('id', userData.tenantId)
          .single();
        
        let currentPlanName = 'Plano Desconhecido';
        let currentLimit = 1; 

        if (tenantData) {
          // 4. Busca Detalhes do Plano na tabela 'plans'
          if (tenantData.planId) {
             const { data: planData } = await supabase
               .from('plans')
               .select('name, user_limit')
               .eq('id', tenantData.planId)
               .single();
             
             if (planData) {
               currentPlanName = planData.name;
               currentLimit = planData.user_limit;
             }
          }

          setTenant({
            name: tenantData.companyName || '',
            planId: tenantData.planId,
            planName: currentPlanName,
            userLimit: currentLimit
          });
        }

        // 5. Busca Equipe (Apenas se for Admin)
        if (userData.isAdmin === true) {
          const { data: teamData } = await supabase
            .from('users')
            .select('*')
            .eq('tenantId', userData.tenantId)
            .order('email', { ascending: true });
          
          setTeam(teamData || []);
        }
      }
    } catch (error) {
      console.error("Erro:", error);
      alert("Erro ao carregar dados. Verifique o console.");
    } finally {
      setLoading(false);
    }
  };

  // --- AÇÕES ---

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    if (!currentUser?.tenantId) return;

    const { error } = await supabase
        .from('tenants')
        .update({ companyName: tenant.name })
        .eq('id', currentUser.tenantId);

    if (error) alert("Erro ao salvar: " + error.message);
    else alert("Empresa atualizada!");
  };

  const handleToggleAdmin = async (userId, currentStatus) => {
    if (userId === currentUser.id && currentStatus === true) {
        if (!window.confirm("Você vai remover seu próprio acesso de Admin. Tem certeza?")) return;
    }

    const newStatus = !currentStatus;
    const { error } = await supabase.from('users').update({ isAdmin: newStatus }).eq('id', userId);

    if (error) alert("Erro: " + error.message);
    else setTeam(team.map(u => u.id === userId ? { ...u, isAdmin: newStatus } : u));
  };

  const handleToggleActive = async (userId, currentStatus) => {
    const safeStatus = currentStatus || 'inactive';
    const newStatus = safeStatus === 'active' ? 'inactive' : 'active';
    
    // CORREÇÃO: Validação de limite respeitando -1 (Ilimitado)
    if (newStatus === 'active') {
        // Se for diferente de -1, aplica a restrição numérica
        if (tenant.userLimit !== -1) {
            const activeCount = team.filter(u => u.status === 'active').length;
            if (activeCount >= tenant.userLimit) {
                return alert(`Limite do plano atingido (${tenant.userLimit} usuários). Faça upgrade do plano ${tenant.planName}.`);
            }
        }
    }

    if (userId === currentUser.id && newStatus === 'inactive') return alert("Não desative a si mesmo.");

    const { error } = await supabase.from('users').update({ status: newStatus }).eq('id', userId);
    
    if (error) alert("Erro: " + error.message);
    else setTeam(team.map(u => u.id === userId ? { ...u, status: newStatus } : u));
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Excluir usuário permanentemente?")) return;
    if (userId === currentUser.id) return alert("Não se exclua.");

    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) alert("Erro: " + error.message);
    else setTeam(team.filter(u => u.id !== userId));
  };

  // Helper para exibir texto amigável
  const renderLimit = (limit) => limit === -1 ? "Ilimitado" : limit;

  // Verificação visual para cor do badge (considera -1 como sempre verde)
  const isLimitReached = () => {
      if (tenant.userLimit === -1) return false;
      return team.filter(u => u.status === 'active').length >= tenant.userLimit;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <button onClick={() => navigate('/')} className="flex items-center text-gray-500 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4 mr-2"/> Voltar para Dashboard
      </button>

      <h1 className="text-3xl font-bold text-gray-900 mb-6">Configurações</h1>

      <div className="flex gap-6 border-b mb-6">
        <button onClick={() => setActiveTab('company')} className={`pb-3 px-1 border-b-2 transition ${activeTab === 'company' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-gray-500'}`}>
          <Building size={18} className="inline mr-2"/> Minha Empresa
        </button>
        <button onClick={() => setActiveTab('team')} className={`pb-3 px-1 border-b-2 transition ${activeTab === 'team' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-gray-500'}`}>
          <Users size={18} className="inline mr-2"/> Gestão de Equipe
        </button>
      </div>

      {activeTab === 'company' && (
        <div className="bg-white p-6 rounded shadow border max-w-2xl">
            <form onSubmit={handleSaveCompany}>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Empresa</label>
                    <input 
                        className="w-full border p-2 rounded" 
                        value={tenant.name} 
                        onChange={e => setTenant({...tenant, name: e.target.value})}
                        disabled={!currentUser?.isAdmin}
                    />
                </div>
                
                <div className="bg-blue-50 p-4 rounded border border-blue-100 mb-4">
                    <p className="text-sm text-blue-900">
                        <strong>Plano Atual:</strong> <span className="font-bold text-lg uppercase ml-2">{tenant.planName}</span>
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                        Limite de usuários ativos: <strong>{renderLimit(tenant.userLimit)}</strong>
                    </p>
                </div>

                {currentUser?.isAdmin && (
                    <button className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"><Save size={16}/> Salvar</button>
                )}
            </form>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="space-y-6">
            {!currentUser?.isAdmin ? (
                <div className="bg-yellow-100 p-4 rounded text-yellow-800 border border-yellow-200">
                    <AlertTriangle className="inline mr-2" size={18}/> Acesso restrito a Administradores.
                </div>
            ) : (
                <div className="bg-white rounded shadow border overflow-hidden">
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                        <h2 className="font-bold text-gray-700">Equipe ({team.length})</h2>
                        
                        <span className={`text-xs px-2 py-1 rounded border ${isLimitReached() ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-600 border-green-200'}`}>
                            {team.filter(u => u.status === 'active').length} / {renderLimit(tenant.userLimit)} licenças em uso
                        </span>
                    </div>
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase">
                                <th className="p-4">Usuário</th>
                                <th className="p-4">Permissão</th>
                                <th className="p-4">Status</th>
                                <th className="p-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {team.map(u => (
                                <tr key={u.id} className="hover:bg-gray-50">
                                    <td className="p-4">
                                        <div className="font-medium text-gray-900">{u.name || 'Sem Nome'}</div>
                                        <div className="text-sm text-gray-500">{u.email}</div>
                                    </td>
                                    <td className="p-4">
                                        <button onClick={() => handleToggleAdmin(u.id, u.isAdmin)} className={`text-xs px-2 py-1 rounded border font-bold uppercase flex items-center gap-1 ${u.isAdmin ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-gray-100 text-gray-600'}`}>
                                            <Shield size={12}/> {u.isAdmin ? 'Admin' : 'Recrutador'}
                                        </button>
                                    </td>
                                    <td className="p-4">
                                        <button onClick={() => handleToggleActive(u.id, u.status)} className={`text-xs px-2 py-1 rounded border font-bold uppercase flex items-center gap-1 ${u.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                            {u.status === 'active' ? <><CheckCircle size={12}/> Ativo</> : <><XCircle size={12}/> Inativo</>}
                                        </button>
                                    </td>
                                    <td className="p-4 text-right">
                                        {u.id !== currentUser.id && (
                                            <button onClick={() => handleDeleteUser(u.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {team.length === 0 && <div className="p-8 text-center text-gray-500">Nenhum membro encontrado.</div>}
                </div>
            )}
        </div>
      )}
    </div>
  );
}