import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { useNavigate } from 'react-router-dom';
import { Shield, Building, Users, CreditCard, Edit, Trash2, Plus, Save, X, ArrowLeft, Mail, Crown, Briefcase, Check, Search, FileText } from 'lucide-react';

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tenants'); // 'tenants' | 'plans'
  
  // Dados Globais
  const [tenants, setTenants] = useState([]);
  const [plans, setPlans] = useState([]);

  // --- ESTADOS DE GESTÃO DE PLANOS ---
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const initialPlanState = { 
      id: '', name: '', price: 0, 
      user_limit: 1, job_limit: 1, candidate_limit: -1, 
      plan_billing_period: 'monthly' 
  };
  const [planForm, setPlanForm] = useState(initialPlanState);

  // --- ESTADOS DE GESTÃO DE EMPRESA (TENANT) ---
  const [isEditingTenant, setIsEditingTenant] = useState(false);
  const [tenantModalTab, setTenantModalTab] = useState('info'); // 'info' ou 'team'
  const [tenantForm, setTenantForm] = useState({ id: '', companyName: '', planId: '', cnpj: '' });
  
  // Estado da Equipe do Tenant sendo editado
  const [tenantUsers, setTenantUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // Estado para Adicionar/Editar Usuário no Tenant
  const [userForm, setUserForm] = useState({ id: null, name: '', email: '', password: '', role: 'avaliador' });
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return navigate('/login');

    try {
        const res = await fetch('/api/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ action: 'getTenantsAndPlans' })
        });
        
        if (!res.ok) throw new Error('Falha ao carregar dados.');
        
        const data = await res.json();
        setTenants(data.tenants || []);
        setPlans(data.plans || []);
    } catch (error) {
        console.error(error);
        alert("Erro ao carregar painel: " + error.message);
    } finally {
        setLoading(false);
    }
  };

  // --- LÓGICA DE PLANOS (COMPLETA) ---

  const handleNewPlan = () => {
    setPlanForm(initialPlanState);
    setIsEditingPlan(true);
  };

  const handleEditPlan = (plan) => {
    setPlanForm({ ...plan });
    setIsEditingPlan(true);
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    
    // Verifica se é atualização ou criação
    const isUpdating = plans.some(p => p.id === planForm.id);
    const action = isUpdating ? 'updatePlan' : 'createPlan';

    try {
        const payload = { 
            action, 
            planData: {
                id: planForm.id,
                name: planForm.name,
                price: parseFloat(planForm.price),
                user_limit: parseInt(planForm.user_limit),
                job_limit: parseInt(planForm.job_limit),
                candidate_limit: parseInt(planForm.candidate_limit),
                plan_billing_period: planForm.plan_billing_period
            }
        };

        if (isUpdating) payload.planId = planForm.id;

        const res = await fetch('/api/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Erro ao salvar.');
        }

        alert(`Plano ${isUpdating ? 'atualizado' : 'criado'} com sucesso!`);
        setIsEditingPlan(false);
        fetchData(); // Recarrega a lista
    } catch (err) {
        alert("Erro: " + err.message);
    }
  };

  const handleDeletePlan = async (planId) => {
    if (!confirm("Tem certeza que deseja excluir este plano?")) return;
    const { data: { session } } = await supabase.auth.getSession();

    try {
        const res = await fetch('/api/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ action: 'deletePlan', planId })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error);
        }
        
        alert("Plano excluído.");
        fetchData();
    } catch (err) {
        alert("Erro: " + err.message);
    }
  };

  // --- LÓGICA DE TENANTS E EQUIPE ---
  
  const fetchTenantDetails = async (tenantId) => {
      setLoadingUsers(true);
      const { data: { session } } = await supabase.auth.getSession();
      try {
          const res = await fetch(`/api/admin?action=getTenantDetails&tenantId=${tenantId}`, {
              method: 'GET',
              headers: { Authorization: `Bearer ${session.access_token}` }
          });
          const data = await res.json();
          if(data.users) setTenantUsers(data.users);
      } catch (err) {
          console.error("Erro ao buscar equipe:", err);
      } finally {
          setLoadingUsers(false);
      }
  };

  const handleEditTenant = (tenant) => {
      setTenantForm({
          id: tenant.id,
          companyName: tenant.companyName,
          planId: tenant.planId,
          cnpj: tenant.cnpj || ''
      });
      // Reseta estados do modal
      setTenantModalTab('info');
      setTenantUsers([]); 
      setIsUserModalOpen(false);
      setIsEditingTenant(true);
      
      // Busca dados atualizados da equipe
      fetchTenantDetails(tenant.id);
  };

  const handleSaveTenantInfo = async (e) => {
      e.preventDefault();
      const { data: { session } } = await supabase.auth.getSession();
      try {
          const res = await fetch('/api/admin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ 
                  action: 'updateTenant', 
                  id: tenantForm.id,
                  companyName: tenantForm.companyName,
                  planId: tenantForm.planId,
                  cnpj: tenantForm.cnpj
              })
          });

          if (!res.ok) throw new Error('Falha ao atualizar.');
          
          alert("Empresa atualizada!");
          fetchData(); // Atualiza lista principal
      } catch (err) {
          alert("Erro: " + err.message);
      }
  };

  // --- CRUD DE USUÁRIOS DO TENANT ---

  const openNewUserModal = () => {
      setUserForm({ id: null, name: '', email: '', password: '', role: 'avaliador' });
      setIsEditingUser(false);
      setIsUserModalOpen(true);
  };

  const openEditUserModal = (user) => {
      // Converte o role do banco para o estado do form ('admin' ou 'avaliador')
      // Se for 'admin' ou 'Administrador', vira 'admin'. Se for 'recruiter', 'member' ou 'Avaliador', vira 'avaliador'.
      const role = (user.role === 'admin' || user.role === 'Administrador') ? 'admin' : 'avaliador';
      
      setUserForm({ 
          id: user.id, 
          name: user.name, 
          email: user.email, 
          password: '', 
          role: role 
      });
      setIsEditingUser(true);
      setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e) => {
      e.preventDefault();
      const { data: { session } } = await supabase.auth.getSession();
      
      // Define o label correto para salvar no banco
      const roleLabel = userForm.role === 'admin' ? 'Administrador' : 'Avaliador';
      
      try {
          const action = isEditingUser ? 'updateUser' : 'createUser';
          const payload = {
              action,
              tenantId: tenantForm.id, // ID da empresa sendo editada
              userId: userForm.id, // Apenas para update
              name: userForm.name,
              email: userForm.email,
              role: roleLabel,
              isAdmin: userForm.role === 'admin'
          };

          // Senha só é enviada na criação ou se houver alteração (lógica de updateAuth pode ser necessária para senha, aqui focamos no role/nome)
          if (!isEditingUser) payload.password = userForm.password;

          const res = await fetch('/api/admin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify(payload)
          });
          
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Erro ao processar usuário.');

          alert(isEditingUser ? "Usuário atualizado!" : "Usuário adicionado à empresa!");
          setIsUserModalOpen(false);
          fetchTenantDetails(tenantForm.id); // Recarrega lista
      } catch (err) {
          alert("Erro: " + err.message);
      }
  };

  const handleRemoveUserFromTenant = async (userId) => {
      if(!confirm("Tem certeza que deseja remover este usuário desta empresa?")) return;
      const { data: { session } } = await supabase.auth.getSession();
      try {
          const res = await fetch('/api/admin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ 
                  action: 'deleteUser',
                  userId: userId,
                  tenantId: tenantForm.id
              })
          });
          if (!res.ok) throw new Error('Erro ao remover.');
          
          alert("Acesso revogado.");
          fetchTenantDetails(tenantForm.id);
      } catch (err) {
          alert("Erro: " + err.message);
      }
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50 text-slate-500">Carregando Sistema...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto mb-8 flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                <Shield className="text-red-600" size={32} /> Painel Super Admin
            </h1>
            <p className="text-slate-500 mt-1 ml-11">Gestão Centralizada do SaaS</p>
        </div>
        <button onClick={() => navigate('/settings')} className="flex items-center text-slate-600 hover:text-blue-600 font-medium transition">
            <ArrowLeft size={18} className="mr-2"/> Voltar
        </button>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Navegação Principal */}
        <div className="bg-white p-1 rounded-lg border border-slate-200 inline-flex mb-8 shadow-sm">
            <button onClick={() => setActiveTab('tenants')} className={`px-6 py-2.5 rounded-md font-bold text-sm flex items-center gap-2 transition ${activeTab === 'tenants' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>
                <Building size={16}/> Empresas ({tenants.length})
            </button>
            <button onClick={() => setActiveTab('plans')} className={`px-6 py-2.5 rounded-md font-bold text-sm flex items-center gap-2 transition ${activeTab === 'plans' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>
                <CreditCard size={16}/> Planos ({plans.length})
            </button>
        </div>

        {/* TAB 1: EMPRESAS */}
        {activeTab === 'tenants' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                        <tr>
                            <th className="p-4 pl-6">Empresa</th>
                            <th className="p-4">CNPJ</th>
                            <th className="p-4">Plano Atual</th>
                            <th className="p-4 text-right pr-6">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {tenants.map(t => (
                            <tr key={t.id} className="hover:bg-slate-50">
                                <td className="p-4 pl-6">
                                    <div className="font-bold text-slate-800">{t.companyName}</div>
                                    <div className="text-xs text-slate-400 font-mono mt-0.5">{t.id}</div>
                                </td>
                                <td className="p-4 text-sm text-slate-600">{t.cnpj || '-'}</td>
                                <td className="p-4">
                                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold uppercase border border-blue-200">
                                        {t.plans?.name || t.planId || 'Free'}
                                    </span>
                                </td>
                                <td className="p-4 text-right pr-6">
                                    <button onClick={() => handleEditTenant(t)} className="text-blue-600 font-bold text-sm hover:underline flex items-center justify-end gap-1 w-full">
                                        <Edit size={14}/> Gerenciar
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {/* TAB 2: PLANOS (CONTEÚDO COMPLETO) */}
        {activeTab === 'plans' && (
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex justify-between items-center mb-2">
                         <h2 className="font-bold text-lg text-slate-800">Planos Disponíveis</h2>
                         <button onClick={handleNewPlan} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-green-700 shadow-sm transition"><Plus size={16}/> Novo Plano</button>
                    </div>
                    {plans.map(plan => (
                        <div key={plan.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center group hover:border-blue-300 transition">
                            <div>
                                <div className="flex items-center gap-3">
                                    <h3 className="font-bold text-lg text-slate-900">{plan.name}</h3>
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${plan.plan_billing_period === 'yearly' ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                        {plan.plan_billing_period === 'yearly' ? 'Anual' : 'Mensal'}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500">
                                    <span className="flex items-center gap-1.5"><Users size={14}/> <strong>{plan.user_limit === -1 ? '∞' : plan.user_limit}</strong> Users</span>
                                    <span className="flex items-center gap-1.5"><Building size={14}/> <strong>{plan.job_limit === -1 ? '∞' : plan.job_limit}</strong> Vagas</span>
                                    <span className="flex items-center gap-1.5"><FileText size={14}/> <strong>{plan.candidate_limit === -1 ? '∞' : plan.candidate_limit}</strong> Cands.</span>
                                </div>
                            </div>
                            <div className="text-right flex items-center gap-4">
                                <div className="text-xl font-bold text-green-700 bg-green-50 px-3 py-1 rounded-lg border border-green-100">
                                    {Number(plan.price).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => handleEditPlan(plan)} className="p-2 text-slate-400 hover:text-blue-600"><Edit size={18}/></button>
                                    <button onClick={() => handleDeletePlan(plan.id)} className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={18}/></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* SIDEBAR DE EDIÇÃO DE PLANO */}
                {isEditingPlan && (
                    <div className="lg:col-span-1 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="bg-white p-6 rounded-xl shadow-xl border border-blue-100 sticky top-8 ring-4 ring-blue-50">
                            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                                    {plans.some(p => p.id === planForm.id) ? 'Editar Plano' : 'Novo Plano'}
                                </h3>
                                <button onClick={() => setIsEditingPlan(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                            </div>

                            <form onSubmit={handleSavePlan} className="space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">ID (Slug Único)</label>
                                    <input 
                                        className="w-full border p-2.5 rounded-lg bg-slate-50 font-mono text-sm disabled:opacity-60" 
                                        value={planForm.id} 
                                        onChange={e => setPlanForm({...planForm, id: e.target.value})}
                                        disabled={plans.some(p => p.id === planForm.id)} // Trava ID na edição
                                        placeholder="ex: pro-mensal"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nome do Plano</label>
                                    <input className="w-full border p-2.5 rounded-lg text-sm" value={planForm.name} onChange={e => setPlanForm({...planForm, name: e.target.value})} required />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Preço (R$)</label>
                                        <input type="number" step="0.01" className="w-full border p-2.5 rounded-lg text-sm" value={planForm.price} onChange={e => setPlanForm({...planForm, price: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Ciclo</label>
                                        <select className="w-full border p-2.5 rounded-lg text-sm bg-white" value={planForm.plan_billing_period} onChange={e => setPlanForm({...planForm, plan_billing_period: e.target.value})}>
                                            <option value="monthly">Mensal</option>
                                            <option value="yearly">Anual</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-3 pt-2 border-t border-dashed border-slate-200">
                                    <div className="flex items-center gap-4">
                                        <label className="w-20 text-xs font-bold text-slate-500">Usuários</label>
                                        <input type="number" className="flex-1 border p-2 rounded text-sm" value={planForm.user_limit} onChange={e => setPlanForm({...planForm, user_limit: e.target.value})} />
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <label className="w-20 text-xs font-bold text-slate-500">Vagas</label>
                                        <input type="number" className="flex-1 border p-2 rounded text-sm" value={planForm.job_limit} onChange={e => setPlanForm({...planForm, job_limit: e.target.value})} />
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <label className="w-20 text-xs font-bold text-slate-500">Candidatos</label>
                                        <input type="number" className="flex-1 border p-2 rounded text-sm" value={planForm.candidate_limit} onChange={e => setPlanForm({...planForm, candidate_limit: e.target.value})} />
                                    </div>
                                    <p className="text-[10px] text-center text-slate-400">-1 para Ilimitado</p>
                                </div>
                                <button type="submit" className="w-full py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg flex justify-center items-center gap-2">
                                    <Save size={18}/> Salvar Plano
                                </button>
                            </form>
                        </div>
                    </div>
                )}
             </div>
        )}

        {/* --- MODAL DE GERENCIAMENTO DE EMPRESA (TENANT) --- */}
        {isEditingTenant && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                    
                    {/* Header do Modal */}
                    <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Gerenciar Empresa</h3>
                            <p className="text-xs text-gray-500">{tenantForm.companyName} ({tenantForm.id})</p>
                        </div>
                        <button onClick={() => setIsEditingTenant(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
                    </div>

                    {/* Abas Internas */}
                    <div className="flex border-b border-gray-200 px-6">
                        <button 
                            onClick={() => setTenantModalTab('info')}
                            className={`py-3 px-4 text-sm font-bold border-b-2 transition ${tenantModalTab === 'info' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            Dados Cadastrais
                        </button>
                        <button 
                            onClick={() => setTenantModalTab('team')}
                            className={`py-3 px-4 text-sm font-bold border-b-2 transition ${tenantModalTab === 'team' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            Gestão da Equipe
                        </button>
                    </div>

                    <div className="p-6 overflow-y-auto bg-slate-50/50">
                        
                        {/* ABA: DADOS DA EMPRESA */}
                        {tenantModalTab === 'info' && (
                            <form onSubmit={handleSaveTenantInfo} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Nome da Empresa</label>
                                        <input className="w-full border p-2.5 rounded-lg" value={tenantForm.companyName} onChange={e => setTenantForm({...tenantForm, companyName: e.target.value})} required />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">CNPJ</label>
                                        <input className="w-full border p-2.5 rounded-lg" value={tenantForm.cnpj} onChange={e => setTenantForm({...tenantForm, cnpj: e.target.value})} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Plano Atribuído</label>
                                    <select className="w-full border p-2.5 rounded-lg bg-white" value={tenantForm.planId} onChange={e => setTenantForm({...tenantForm, planId: e.target.value})}>
                                        {plans.map(p => <option key={p.id} value={p.id}>{p.name} ({p.plan_billing_period})</option>)}
                                    </select>
                                </div>
                                <div className="pt-2 flex justify-end">
                                    <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow">Salvar Alterações</button>
                                </div>
                            </form>
                        )}

                        {/* ABA: EQUIPE (IMPLEMENTADA AGORA) */}
                        {tenantModalTab === 'team' && (
                            <div className="space-y-4">
                                {/* Botão de Adicionar (Se não estiver editando) */}
                                {!isUserModalOpen && (
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-bold text-gray-700">Membros ({tenantUsers.length})</h4>
                                        <button onClick={openNewUserModal} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded flex items-center gap-1 hover:bg-blue-700 font-bold shadow-sm">
                                            <Plus size={14}/> Adicionar Usuário
                                        </button>
                                    </div>
                                )}

                                {/* Lista de Usuários */}
                                {loadingUsers ? <div className="text-center py-4 text-gray-500">Carregando equipe...</div> : (
                                    <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-100 text-gray-500">
                                                <tr>
                                                    <th className="p-3">Usuário</th>
                                                    <th className="p-3">Nível de Acesso</th>
                                                    <th className="p-3 text-right">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {tenantUsers.length === 0 ? (
                                                    <tr><td colSpan="3" className="p-4 text-center text-gray-400">Nenhum usuário encontrado nesta empresa.</td></tr>
                                                ) : (
                                                    tenantUsers.map(u => (
                                                        <tr key={u.id} className="hover:bg-gray-50">
                                                            <td className="p-3">
                                                                <div className="font-medium text-gray-900">{u.name || 'Sem nome'}</div>
                                                                <div className="text-xs text-gray-500">{u.email}</div>
                                                            </td>
                                                            <td className="p-3">
                                                                {/* EXIBIÇÃO CORRIGIDA DE ROLE */}
                                                                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                                                                    u.role === 'Administrador' || u.role === 'admin' 
                                                                    ? 'bg-purple-50 text-purple-700 border-purple-200' 
                                                                    : 'bg-green-50 text-green-700 border-green-200'
                                                                }`}>
                                                                    {u.role === 'admin' ? 'Administrador' : u.role}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 text-right flex justify-end gap-2">
                                                                <button onClick={() => openEditUserModal(u)} className="text-gray-400 hover:text-blue-600 p-1.5 rounded transition" title="Editar Usuário">
                                                                    <Edit size={16}/>
                                                                </button>
                                                                <button onClick={() => handleRemoveUserFromTenant(u.id)} className="text-gray-400 hover:text-red-600 p-1.5 rounded transition" title="Remover Acesso">
                                                                    <Trash2 size={16}/>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                
                                {/* FORMULÁRIO DE USUÁRIO (NOVO/EDITAR) */}
                                {isUserModalOpen && (
                                    <div className="bg-white p-5 rounded-lg border border-blue-200 shadow-md mt-4 animate-in slide-in-from-top-2 relative">
                                        <button onClick={() => setIsUserModalOpen(false)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"><X size={18}/></button>
                                        <h4 className="font-bold text-blue-900 mb-4 text-sm flex items-center gap-2">
                                            {isEditingUser ? <Edit size={16}/> : <Plus size={16}/>} 
                                            {isEditingUser ? 'Editar Membro' : 'Novo Membro'}
                                        </h4>
                                        <form onSubmit={handleSaveUser} className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="block text-xs font-bold text-gray-500 mb-1">Nome Completo</label>
                                                <input required className="w-full border p-2 rounded text-sm outline-none focus:border-blue-500" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} />
                                            </div>
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="block text-xs font-bold text-gray-500 mb-1">E-mail Corporativo</label>
                                                <input required type="email" disabled={isEditingUser} className="w-full border p-2 rounded text-sm outline-none focus:border-blue-500 disabled:bg-gray-100" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} />
                                            </div>
                                            {!isEditingUser && (
                                                <div className="col-span-2 md:col-span-1">
                                                    <label className="block text-xs font-bold text-gray-500 mb-1">Senha Inicial</label>
                                                    <input required type="password" className="w-full border p-2 rounded text-sm outline-none focus:border-blue-500" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} />
                                                </div>
                                            )}
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="block text-xs font-bold text-gray-500 mb-1">Nível de Acesso</label>
                                                <select className="w-full border p-2 rounded text-sm bg-white outline-none focus:border-blue-500" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}>
                                                    <option value="avaliador">Avaliador (Padrão)</option>
                                                    <option value="admin">Administrador</option>
                                                </select>
                                            </div>
                                            <div className="col-span-2 flex justify-end gap-2 mt-2 pt-2 border-t border-dashed border-gray-200">
                                                <button type="button" onClick={() => setIsUserModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded font-medium">Cancelar</button>
                                                <button type="submit" className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded hover:bg-blue-700 shadow-sm">Salvar Usuário</button>
                                            </div>
                                        </form>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}