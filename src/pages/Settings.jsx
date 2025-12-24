import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { Building, Users, Save, Shield, CheckCircle, XCircle, Trash2, AlertTriangle, ArrowLeft } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('company');
  const [loading, setLoading] = useState(true);
  
  // Usuário Logado e Permissões
  const [currentUser, setCurrentUser] = useState(null);
  
  // Dados do Formulário
  const [tenant, setTenant] = useState({ name: '', plan: 'free' });
  const [team, setTeam] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Pega usuário da sessão (Auth)
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Usuário não autenticado.");

      // 2. Busca dados detalhados na tabela 'users' (Public)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error("Erro perfil:", userError);
        throw new Error("Não foi possível carregar seu perfil.");
      }
      
      setCurrentUser(userData);

      if (userData?.tenantId) {
        // 3. Busca Empresa
        const { data: tenantData, error: tenantError } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', userData.tenantId)
          .single();
        
        if (tenantData) {
          setTenant({
            name: tenantData.companyName || '', // Campo correto
            plan: tenantData.plan || 'free'
          });
        }

        // 4. Busca Equipe (Se for Admin)
        if (userData.isAdmin === true) {
          const { data: teamData, error: teamError } = await supabase
            .from('users')
            .select('*')
            .eq('tenantId', userData.tenantId)
            .order('email', { ascending: true });
          
          if (teamError) {
              console.error("Erro time:", teamError);
              // Não lança erro fatal aqui para permitir ver a aba da empresa
          } else {
              setTeam(teamData || []);
          }
        }
      }
    } catch (error) {
      console.error("Erro fatal:", error);
      alert(`Erro ao carregar configurações: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- AÇÕES DO SISTEMA ---

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    if (!currentUser?.tenantId) return;

    try {
        const { error } = await supabase
            .from('tenants')
            .update({ companyName: tenant.name }) // Campo correto
            .eq('id', currentUser.tenantId);

        if (error) throw error;
        alert("Empresa atualizada com sucesso!");
    } catch (err) {
        alert("Erro ao salvar: " + err.message);
    }
  };

  const handleToggleAdmin = async (targetUserId, currentStatus) => {
    try {
        const newStatus = !currentStatus;
        
        // Proteção contra remover o próprio admin
        if (targetUserId === currentUser.id && newStatus === false) {
             if (!window.confirm("ATENÇÃO: Você está removendo seus próprios direitos de Admin. Continuar?")) {
                 return;
             }
        }

        const { error } = await supabase
        .from('users')
        .update({ isAdmin: newStatus })
        .eq('id', targetUserId);

        if (error) throw error;

        // Atualiza lista local
        setTeam(team.map(u => u.id === targetUserId ? { ...u, isAdmin: newStatus } : u));
    } catch (err) {
        alert("Erro ao alterar permissão: " + err.message);
    }
  };

  const handleToggleActive = async (targetUserId, currentStatus) => {
    try {
        const safeStatus = currentStatus || 'inactive';
        const newStatus = safeStatus === 'active' ? 'inactive' : 'active';
        
        // Verifica limites do plano
        if (newStatus === 'active') {
            const limit = getLimit(tenant.plan);
            const activeCount = team.filter(u => u.status === 'active').length;
            if (activeCount >= limit) {
                alert(`Limite do plano atingido (${limit} usuários). Faça upgrade.`);
                return;
            }
        }

        if (targetUserId === currentUser.id && newStatus === 'inactive') {
            alert("Você não pode desativar a si mesmo.");
            return;
        }

        const { error } = await supabase
        .from('users')
        .update({ status: newStatus })
        .eq('id', targetUserId);

        if (error) throw error;

        setTeam(team.map(u => u.id === targetUserId ? { ...u, status: newStatus } : u));
    } catch (err) {
        alert("Erro ao alterar status: " + err.message);
    }
  };

  const handleDeleteUser = async (targetUserId) => {
    if (!window.confirm("Tem certeza que deseja excluir este usuário?")) return;
    if (targetUserId === currentUser.id) return alert("Não exclua a si mesmo.");

    try {
        const { error } = await supabase.from('users').delete().eq('id', targetUserId);
        if (error) throw error;
        setTeam(team.filter(u => u.id !== targetUserId));
    } catch (err) {
        alert("Erro ao excluir: " + err.message);
    }
  };

  const getLimit = (p) => {
    const plan = (p || 'free').toLowerCase();
    if (plan === 'enterprise') return 999;
    if (plan === 'pro') return 5;
    return 1;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50">Carregando configurações...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <button onClick={() => navigate('/')} className="flex items-center text-gray-500 hover:text-gray-900 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2"/> Voltar para Dashboard
      </button>

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
        {currentUser && (
            <div className="text-sm text-gray-500 mt-2 md:mt-0">
                Logado como: <span className="font-medium text-gray-800">{currentUser.email}</span> 
                {currentUser.isAdmin && <span className="ml-2 bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold uppercase">Admin</span>}
            </div>
        )}
      </div>

      <div className="flex gap-6 border-b mb-6 overflow-x-auto">
        <button onClick={() => setActiveTab('company')} className={`pb-3 px-1 border-b-2 transition whitespace-nowrap ${activeTab === 'company' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <Building size={18} className="inline mr-2"/> Minha Empresa
        </button>
        <button onClick={() => setActiveTab('team')} className={`pb-3 px-1 border-b-2 transition whitespace-nowrap ${activeTab === 'team' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <Users size={18} className="inline mr-2"/> Gestão de Equipe
        </button>
      </div>

      {/* ABA EMPRESA */}
      {activeTab === 'company' && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 max-w-2xl">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Dados da Organização</h2>
            <form onSubmit={handleSaveCompany}>
                <div className="mb-5">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Empresa</label>
                    <input 
                      className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition" 
                      value={tenant.name} 
                      onChange={e => setTenant({...tenant, name: e.target.value})} 
                      disabled={!currentUser?.isAdmin}
                      placeholder="Ex: Minha Empresa Ltda"
                    />
                    {!currentUser?.isAdmin && <p className="text-xs text-gray-400 mt-1">Apenas administradores podem editar.</p>}
                </div>
                
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-sm text-blue-900"><strong>Plano Atual:</strong> <span className="uppercase font-bold">{tenant.plan}</span></p>
                            <p className="text-xs text-blue-700 mt-1">Limite de usuários ativos: <strong>{getLimit(tenant.plan)}</strong></p>
                        </div>
                    </div>
                </div>
                
                {currentUser?.isAdmin && (
                  <button className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition flex items-center gap-2 shadow-sm">
                    <Save size={18}/> Salvar Alterações
                  </button>
                )}
            </form>
        </div>
      )}

      {/* ABA EQUIPE */}
      {activeTab === 'team' && (
        <div className="space-y-6">
            {!currentUser?.isAdmin ? (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-yellow-800 flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 flex-shrink-0" size={20}/> 
                    <div>
                        <strong className="block mb-1">Acesso Restrito</strong>
                        Você não possui privilégios de Administrador para gerenciar a equipe.
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center flex-wrap gap-4">
                        <div>
                            <h2 className="font-bold text-gray-800 text-lg">Membros da Equipe</h2>
                            <p className="text-sm text-gray-500">Gerencie o acesso dos colaboradores</p>
                        </div>
                        <span className={`text-xs px-3 py-1.5 rounded-full border font-medium ${team.filter(u => u.status === 'active').length >= getLimit(tenant.plan) ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                            {team.filter(u => u.status === 'active').length} / {getLimit(tenant.plan)} licenças em uso
                        </span>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                                    <th className="p-4 font-semibold">Usuário</th>
                                    <th className="p-4 font-semibold">Permissão</th>
                                    <th className="p-4 font-semibold">Status</th>
                                    <th className="p-4 font-semibold text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {team.map(u => (
                                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-medium text-gray-900">{u.name || 'Usuário sem nome'}</div>
                                            <div className="text-sm text-gray-500">{u.email}</div>
                                        </td>
                                        <td className="p-4">
                                            <button 
                                            onClick={() => handleToggleAdmin(u.id, u.isAdmin)}
                                            className={`text-xs px-2.5 py-1 rounded-md border font-bold uppercase flex items-center gap-1.5 transition-all ${u.isAdmin ? 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'}`}
                                            >
                                            <Shield size={12}/> {u.isAdmin ? 'Admin' : 'Recrutador'}
                                            </button>
                                        </td>
                                        <td className="p-4">
                                            <button 
                                            onClick={() => handleToggleActive(u.id, u.status)}
                                            className={`text-xs px-2.5 py-1 rounded-md border font-bold uppercase flex items-center gap-1.5 transition-all ${u.status === 'active' ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' : 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'}`}
                                            >
                                            {u.status === 'active' ? <><CheckCircle size={12}/> Ativo</> : <><XCircle size={12}/> Inativo</>}
                                            </button>
                                        </td>
                                        <td className="p-4 text-right">
                                            {u.id !== currentUser.id && (
                                                <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition" title="Excluir">
                                                    <Trash2 size={18}/>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
      )}
    </div>
  );
}