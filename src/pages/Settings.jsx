import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { Building, Users, Save, Shield, CheckCircle, XCircle, Trash2, AlertTriangle } from 'lucide-react';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('company');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Dados da Empresa
  const [tenant, setTenant] = useState({ name: '', plan: 'free' });
  
  // Dados da Equipe
  const [team, setTeam] = useState([]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
    
    setCurrentUser(userData);

    if (userData?.tenantId) {
        // 1. BUSCA DADOS DA EMPRESA
        const { data: tenantData } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', userData.tenantId)
            .single();
        
        // CORREÇÃO: Mapeia 'companyName' do banco para o estado local 'name'
        if (tenantData) {
            setTenant({
                name: tenantData.companyName || '', // Aqui estava o problema de leitura
                plan: tenantData.plan || 'free'
            });
        }

        // 2. BUSCA EQUIPE (Apenas Admin)
        if (userData.role === 'admin') {
            const { data: teamData } = await supabase
                .from('users')
                .select('*')
                .eq('tenantId', userData.tenantId)
                .order('created_at', { ascending: true });
            setTeam(teamData || []);
        }
    }
    setLoading(false);
  };

  // --- AÇÕES DA EMPRESA ---
  const handleSaveCompany = async (e) => {
    e.preventDefault();
    if (!currentUser?.tenantId) return;

    // CORREÇÃO: Salva no campo 'companyName' em vez de 'name'
    const { error } = await supabase
        .from('tenants')
        .update({ companyName: tenant.name }) 
        .eq('id', currentUser.tenantId);

    if (error) alert("Erro ao salvar: " + error.message);
    else alert("Dados da empresa atualizados!");
  };

  // --- AÇÕES DA EQUIPE ---
  const getPlanLimit = (plan) => {
    if (plan === 'enterprise') return 999;
    if (plan === 'pro') return 5;
    return 1; // Free
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    
    // Verifica limite do plano antes de ativar
    if (newStatus === 'active') {
        const limit = getPlanLimit(tenant.plan);
        const activeCount = team.filter(u => u.status === 'active').length;
        
        if (activeCount >= limit) {
            alert(`Seu plano ${tenant.plan?.toUpperCase()} permite apenas ${limit} usuário(s) ativo(s). Faça upgrade.`);
            return;
        }
    }

    if (userId === currentUser.id && newStatus === 'inactive') {
        alert("Você não pode desativar seu próprio usuário.");
        return;
    }

    const { error } = await supabase
        .from('users')
        .update({ status: newStatus })
        .eq('id', userId);

    if (error) {
        alert("Erro ao atualizar status: " + error.message);
    } else {
        setTeam(team.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    }
  };

  const handleChangeRole = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'recruiter' : 'admin';
    
    const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId);

    if (error) {
        alert("Erro ao alterar cargo: " + error.message);
    } else {
        setTeam(team.map(u => u.id === userId ? { ...u, role: newRole } : u));
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Tem certeza? O usuário perderá o acesso.")) return;
    
    if (userId === currentUser.id) {
        alert("Você não pode excluir a si mesmo.");
        return;
    }

    const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

    if (error) {
        alert("Erro ao excluir: " + error.message);
    } else {
        setTeam(team.filter(u => u.id !== userId));
    }
  };

  if (loading) return <div className="p-10 text-center">Carregando configurações...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Configurações</h1>

      <div className="flex gap-6 border-b mb-6">
        <button 
          onClick={() => setActiveTab('company')}
          className={`pb-3 px-1 flex items-center gap-2 transition ${activeTab === 'company' ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Building size={18}/> Minha Empresa
        </button>
        <button 
          onClick={() => setActiveTab('team')}
          className={`pb-3 px-1 flex items-center gap-2 transition ${activeTab === 'team' ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Users size={18}/> Gestão de Equipe
        </button>
      </div>

      {/* ABA EMPRESA */}
      {activeTab === 'company' && (
        <div className="bg-white p-6 rounded shadow border max-w-2xl">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Dados da Organização</h2>
            <form onSubmit={handleSaveCompany} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Empresa</label>
                    <input 
                        className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" 
                        value={tenant.name}
                        onChange={e => setTenant({...tenant, name: e.target.value})}
                    />
                </div>
                <div className="bg-gray-50 p-4 rounded border">
                    <p className="text-sm text-gray-600">
                        <strong>Plano Atual:</strong> <span className="uppercase font-bold text-blue-600">{tenant.plan}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        Limite de usuários ativos: <strong>{getPlanLimit(tenant.plan)}</strong>
                    </p>
                </div>
                <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2">
                    <Save size={16}/> Salvar Alterações
                </button>
            </form>
        </div>
      )}

      {/* ABA EQUIPE */}
      {activeTab === 'team' && (
        <div className="space-y-6">
            {currentUser?.role !== 'admin' && (
                <div className="bg-yellow-50 p-4 rounded border border-yellow-200 text-yellow-800 flex items-center gap-3">
                    <AlertTriangle/>
                    Você não tem permissão de administrador para gerenciar a equipe.
                </div>
            )}

            {currentUser?.role === 'admin' && (
                <div className="bg-white rounded shadow border overflow-hidden">
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                        <h2 className="font-bold text-gray-700">Membros do Time ({team.length})</h2>
                        <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">
                            {team.filter(u => u.status === 'active').length} / {getPlanLimit(tenant.plan)} licenças
                        </span>
                    </div>
                    
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-xs text-gray-500 uppercase border-b bg-gray-50">
                                <th className="p-4 font-medium">Nome</th>
                                <th className="p-4 font-medium">Email</th>
                                <th className="p-4 font-medium">Cargo</th>
                                <th className="p-4 font-medium">Status</th>
                                <th className="p-4 font-medium text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {team.map(user => (
                                <tr key={user.id} className="hover:bg-gray-50 group">
                                    <td className="p-4 font-medium text-gray-900">{user.name || 'Sem nome'}</td>
                                    <td className="p-4 text-gray-600 text-sm">{user.email}</td>
                                    <td className="p-4">
                                        <button 
                                            onClick={() => handleChangeRole(user.id, user.role)}
                                            className={`text-xs px-2 py-1 rounded border font-bold uppercase transition flex items-center gap-1 ${
                                                user.role === 'admin' 
                                                ? 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200' 
                                                : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                                            }`}
                                        >
                                            <Shield size={12}/> {user.role === 'admin' ? 'Admin' : 'Recrutador'}
                                        </button>
                                    </td>
                                    <td className="p-4">
                                        <button 
                                            onClick={() => handleToggleStatus(user.id, user.status)}
                                            className={`text-xs px-2 py-1 rounded border font-bold uppercase transition flex items-center gap-1 ${
                                                user.status === 'active' 
                                                ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' 
                                                : 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'
                                            }`}
                                        >
                                            {user.status === 'active' 
                                                ? <><CheckCircle size={12}/> Ativo</> 
                                                : <><XCircle size={12}/> Inativo</>
                                            }
                                        </button>
                                    </td>
                                    <td className="p-4 text-right">
                                        {user.id !== currentUser.id && (
                                            <button 
                                                onClick={() => handleDeleteUser(user.id)}
                                                className="text-gray-400 hover:text-red-600 transition p-1"
                                                title="Remover usuário"
                                            >
                                                <Trash2 size={16}/>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
      )}
    </div>
  );
}