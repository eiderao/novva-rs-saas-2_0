import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { Building, Users, Save, Shield, CheckCircle, XCircle, Trash2, AlertTriangle, ArrowLeft, Terminal } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('company');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  
  const [tenant, setTenant] = useState({ name: '', plan: '' });
  const [team, setTeam] = useState([]);
  
  // Debug
  const [debugInfo, setDebugInfo] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
        setLoading(false);
        return;
    }

    // 1. Busca Usuário Atual
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
    
    setCurrentUser(userData);

    let tenantRaw = null;

    if (userData?.tenantId) {
        // 2. Busca Empresa
        const { data: tData } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', userData.tenantId)
            .single();
        
        tenantRaw = tData;
        
        if (tData) {
            setTenant({
                name: tData.companyName || tData.name || '', 
                plan: tData.plan || 'free'
            });
        }

        // 3. Busca Equipe (Se for Admin BOOLEANO)
        // Note: Verificamos explicitamente userData.isAdmin
        if (userData && userData.isAdmin) {
            const { data: tmData, error: teamError } = await supabase
                .from('users')
                .select('*')
                .eq('tenantId', userData.tenantId)
                .order('created_at', { ascending: true });
            
            if (teamError) console.error("Erro ao buscar time:", teamError);
            setTeam(tmData || []);
        }
    }

    setDebugInfo({
        authUserId: user.id,
        userData: userData,
        userError: userError,
        isAdmin: userData?.isAdmin
    });

    setLoading(false);
  };

  // --- AÇÕES DA EMPRESA ---
  const handleSaveCompany = async (e) => {
    e.preventDefault();
    if (!currentUser?.tenantId) return;

    const { error } = await supabase
        .from('tenants')
        .update({ companyName: tenant.name }) 
        .eq('id', currentUser.tenantId);

    if (error) alert("Erro: " + error.message);
    else alert("Salvo com sucesso!");
  };

  const getPlanLimit = (plan) => {
    const p = (plan || 'free').toLowerCase();
    if (p === 'enterprise') return 999;
    if (p === 'pro') return 5;
    return 1; 
  };

  // --- AÇÕES DA EQUIPE ---

  const handleToggleStatus = async (userId, currentStatus) => {
    // Se status for nulo, assume inactive
    const safeStatus = currentStatus || 'inactive';
    const newStatus = safeStatus === 'active' ? 'inactive' : 'active';
    
    if (newStatus === 'active') {
        const limit = getPlanLimit(tenant.plan);
        const activeCount = team.filter(u => u.status === 'active').length;
        if (activeCount >= limit) {
             alert(`Limite do plano atingido (${limit}).`);
             return;
        }
    }

    if (userId === currentUser.id && newStatus === 'inactive') {
        return alert("Você não pode desativar seu próprio usuário.");
    }

    const { error } = await supabase.from('users').update({ status: newStatus }).eq('id', userId);
    
    if (error) alert(error.message);
    else setTeam(team.map(u => u.id === userId ? { ...u, status: newStatus } : u));
  };

  const handleToggleAdmin = async (userId, currentIsAdmin) => {
    // Inverte o booleano
    const newIsAdmin = !currentIsAdmin;
    
    // Impede remover o próprio admin se for o único (lógica simples por enquanto: impede remover o próprio)
    if (userId === currentUser.id && !newIsAdmin) {
        if (!window.confirm("Você está removendo seus próprios privilégios de Admin. Tem certeza?")) return;
    }

    const { error } = await supabase.from('users').update({ isAdmin: newIsAdmin }).eq('id', userId);
    
    if (error) alert(error.message);
    else setTeam(team.map(u => u.id === userId ? { ...u, isAdmin: newIsAdmin } : u));
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Confirmar exclusão?")) return;
    if (userId === currentUser.id) return alert("Não pode excluir a si mesmo.");

    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) alert(error.message);
    else setTeam(team.filter(u => u.id !== userId));
  };

  if (loading) return <div className="p-10 text-center">Carregando...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <button onClick={() => navigate('/')} className="flex items-center text-gray-500 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4 mr-2"/> Voltar para Dashboard
      </button>

      {/* DEBUG PANEL (Pode remover depois) */}
      <div className="bg-gray-900 text-green-400 p-3 rounded mb-6 text-xs font-mono border border-gray-700">
         <div className="flex justify-between">
            <span><strong>User:</strong> {debugInfo?.userData?.name}</span>
            <span><strong>IsAdmin (DB):</strong> {debugInfo?.userData?.isAdmin ? 'TRUE' : 'FALSE'}</span>
            <span><strong>Tenant:</strong> {debugInfo?.userData?.tenantId}</span>
         </div>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-6">Configurações</h1>

      <div className="flex gap-6 border-b mb-6">
        <button onClick={() => setActiveTab('company')} className={`pb-3 px-1 border-b-2 transition ${activeTab === 'company' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-gray-500'}`}>
          <Building size={18} className="inline mr-2"/> Minha Empresa
        </button>
        <button onClick={() => setActiveTab('team')} className={`pb-3 px-1 border-b-2 transition ${activeTab === 'team' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-gray-500'}`}>
          <Users size={18} className="inline mr-2"/> Gestão de Equipe
        </button>
      </div>

      {/* ABA EMPRESA */}
      {activeTab === 'company' && (
        <div className="bg-white p-6 rounded shadow border max-w-2xl">
            <form onSubmit={handleSaveCompany} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Empresa</label>
                    <input className="w-full border p-2 rounded" value={tenant.name} onChange={e => setTenant({...tenant, name: e.target.value})} />
                </div>
                <div className="bg-gray-50 p-4 rounded border">
                    <p className="text-sm text-gray-600"><strong>Plano:</strong> <span className="uppercase font-bold text-blue-600">{tenant.plan}</span></p>
                    <p className="text-xs text-gray-500 mt-1">Limite: <strong>{getPlanLimit(tenant.plan)}</strong> usuários ativos</p>
                </div>
                <button className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"><Save size={16}/> Salvar</button>
            </form>
        </div>
      )}

      {/* ABA EQUIPE */}
      {activeTab === 'team' && (
        <div className="space-y-6">
            {!currentUser?.isAdmin && (
                <div className="bg-yellow-100 p-4 rounded text-yellow-800 border border-yellow-200">
                    <AlertTriangle className="inline mr-2" size={18}/>
                    Acesso restrito. Você não possui privilégios de Administrador.
                </div>
            )}
            
            {currentUser?.isAdmin && (
                <div className="bg-white rounded shadow border overflow-hidden">
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                        <h2 className="font-bold text-gray-700">Equipe ({team.length})</h2>
                        <span className="text-xs bg-white px-2 py-1 rounded border">
                            {team.filter(u => u.status === 'active').length} / {getPlanLimit(tenant.plan)} ativos
                        </span>
                    </div>
                    
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase">
                                <th className="p-4">Nome / Email</th>
                                <th className="p-4">Permissão</th>
                                <th className="p-4">Status</th>
                                <th className="p-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {team.map(u => (
                                <tr key={u.id} className="hover:bg-gray-50">
                                    <td className="p-4">
                                        <div className="font-medium text-gray-900">{u.name || 'Sem nome'}</div>
                                        <div className="text-sm text-gray-500">{u.email}</div>
                                    </td>
                                    
                                    {/* Toggle Admin */}
                                    <td className="p-4">
                                        <button 
                                            onClick={() => handleToggleAdmin(u.id, u.isAdmin)}
                                            className={`text-xs px-2 py-1 rounded border font-bold uppercase transition flex items-center gap-1 ${
                                                u.isAdmin 
                                                ? 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200' 
                                                : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                                            }`}
                                        >
                                            <Shield size={12}/> {u.isAdmin ? 'Admin' : 'Colaborador'}
                                        </button>
                                    </td>

                                    {/* Toggle Status */}
                                    <td className="p-4">
                                        <button 
                                            onClick={() => handleToggleStatus(u.id, u.status)}
                                            className={`text-xs px-2 py-1 rounded border font-bold uppercase transition flex items-center gap-1 ${
                                                u.status === 'active' 
                                                ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' 
                                                : 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'
                                            }`}
                                        >
                                            {u.status === 'active' 
                                                ? <><CheckCircle size={12}/> Ativo</> 
                                                : <><XCircle size={12}/> Inativo</>
                                            }
                                        </button>
                                    </td>

                                    {/* Ações */}
                                    <td className="p-4 text-right">
                                        {u.id !== currentUser.id && (
                                            <button onClick={() => handleDeleteUser(u.id)} title="Excluir Usuário">
                                                <Trash2 size={16} className="text-gray-400 hover:text-red-600"/>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    {team.length === 0 && (
                        <div className="p-8 text-center text-gray-500 italic">Nenhum outro membro encontrado nesta empresa.</div>
                    )}
                </div>
            )}
        </div>
      )}
    </div>
  );
}