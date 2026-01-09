import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { useNavigate } from 'react-router-dom';
import { Shield, Building, Users, CreditCard, Edit, Trash2, Plus, Save, X, ArrowLeft, Mail, Crown, Briefcase } from 'lucide-react';

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tenants'); // 'tenants' | 'plans'
  
  // Dados Globais
  const [tenants, setTenants] = useState([]);
  const [plans, setPlans] = useState([]);

  // Estados de Edição de Plano
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const initialPlanState = { 
      id: '', name: '', price: 0, 
      user_limit: 1, job_limit: 1, candidate_limit: -1, 
      plan_billing_period: 'monthly' 
  };
  const [planForm, setPlanForm] = useState(initialPlanState);

  // --- ESTADOS DE EDIÇÃO DE EMPRESA (TENANT) ---
  const [isEditingTenant, setIsEditingTenant] = useState(false);
  const [tenantModalTab, setTenantModalTab] = useState('info'); // 'info' ou 'team'
  const [tenantForm, setTenantForm] = useState({ id: '', companyName: '', planId: '', cnpj: '' });
  
  // Estado da Equipe do Tenant sendo editado
  const [tenantUsers, setTenantUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // Novo Usuário para o Tenant
  const [newTenantUser, setNewTenantUser] = useState({ name: '', email: '', password: '', role: 'admin' });
  const [isAddingUser, setIsAddingUser] = useState(false);

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

  // --- GESTÃO DE PLANOS (MANTIDO IGUAL) ---
  const handleNewPlan = () => { setPlanForm(initialPlanState); setIsEditingPlan(true); };
  const handleEditPlan = (plan) => { setPlanForm({ ...plan }); setIsEditingPlan(true); };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
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

        if (!res.ok) throw new Error('Erro ao salvar.');
        alert(`Plano ${isUpdating ? 'atualizado' : 'criado'} com sucesso!`);
        setIsEditingPlan(false);
        fetchData();
    } catch (err) { alert("Erro: " + err.message); }
  };

  const handleDeletePlan = async (planId) => {
    if (!confirm("Tem certeza?")) return;
    const { data: { session } } = await supabase.auth.getSession();
    try {
        const res = await fetch('/api/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ action: 'deletePlan', planId })
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
        alert("Plano excluído.");
        fetchData();
    } catch (err) { alert("Erro: " + err.message); }
  };

  // --- GESTÃO DE TENANTS E EQUIPE ---
  
  const fetchTenantDetails = async (tenantId) => {
      setLoadingUsers(true);
      const { data: { session } } = await supabase.auth.getSession();
      try {
          // Usa a API existente que traz detalhes + usuários
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
      // Reseta estados da modal
      setTenantModalTab('info');
      setTenantUsers([]); 
      setIsAddingUser(false);
      
      // Abre modal e busca usuários
      setIsEditingTenant(true);
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
          fetchData(); // Atualiza lista de fundo
      } catch (err) { alert("Erro: " + err.message); }
  };

  const handleAddUserToTenant = async (e) => {
      e.preventDefault();
      const { data: { session } } = await supabase.auth.getSession();
      try {
          const res = await fetch('/api/admin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ 
                  action: 'createUser',
                  tenantId: tenantForm.id, // ID da empresa sendo editada
                  name: newTenantUser.name,
                  email: newTenantUser.email,
                  password: newTenantUser.password,
                  role: newTenantUser.role === 'admin' ? 'Administrador' : 'Recrutador',
                  isAdmin: newTenantUser.role === 'admin' // Flag auxiliar
              })
          });
          
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Erro ao criar usuário.');

          alert("Usuário adicionado à empresa!");
          setIsAddingUser(false);
          setNewTenantUser({ name: '', email: '', password: '', role: 'admin' });
          fetchTenantDetails(tenantForm.id); // Recarrega lista
      } catch (err) {
          alert("Erro: " + err.message);
      }
  };

  const handleRemoveUserFromTenant = async (userId) => {
      if(!confirm("Remover este usuário desta empresa?")) return;
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

        {/* TAB 2: PLANOS (CONTEÚDO MANTIDO SIMPLIFICADO PARA FOCO NO PROBLEMA) */}
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
                                <h3 className="font-bold text-lg text-slate-900">{plan.name}</h3>
                                <div className="text-sm text-slate-500 mt-1">ID: {plan.id} | {Number(plan.price).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleEditPlan(plan)} className="p-2 text-slate-400 hover:text-blue-600"><Edit size={18}/></button>
                                <button onClick={() => handleDeletePlan(plan.id)} className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={18}/></button>
                            </div>
                        </div>
                    ))}
                </div>
                 {/* Formulário de Plano (Simplificado visualmente, lógica mantida no topo) */}
                 {isEditingPlan && (
                    <div className="bg-white p-6 rounded-xl shadow-xl border border-blue-100">
                        <div className="flex justify-between mb-4"><h3 className="font-bold">Editor de Plano</h3><button onClick={()=>setIsEditingPlan(false)}><X size={20}/></button></div>
                        <form onSubmit={handleSavePlan} className="space-y-4">
                            <div><label className="text-xs font-bold">ID</label><input className="w-full border p-2 rounded" value={planForm.id} onChange={e=>setPlanForm({...planForm, id: e.target.value})} disabled={plans.some(p=>p.id===planForm.id)} /></div>
                            <div><label className="text-xs font-bold">Nome</label><input className="w-full border p-2 rounded" value={planForm.name} onChange={e=>setPlanForm({...planForm, name: e.target.value})} /></div>
                            <button className="w-full bg-blue-600 text-white py-2 rounded font-bold">Salvar</button>
                        </form>
                    </div>
                 )}
             </div>
        )}

        {/* --- MODAL DE GERENCIAMENTO DE EMPRESA (TENANT) --- */}
        {isEditingTenant && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    
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

                    <div className="p-6 overflow-y-auto">
                        
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

                        {/* ABA: EQUIPE (NOVIDADE) */}
                        {tenantModalTab === 'team' && (
                            <div className="space-y-6">
                                {/* Formulário de Adição */}
                                {!isAddingUser ? (
                                    <button onClick={() => setIsAddingUser(true)} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 font-bold hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition flex items-center justify-center gap-2">
                                        <Plus size={20}/> Adicionar Administrador/Membro
                                    </button>
                                ) : (
                                    <form onSubmit={handleAddUserToTenant} className="bg-blue-50 p-4 rounded-lg border border-blue-100 animate-in fade-in">
                                        <h4 className="font-bold text-blue-900 mb-3 text-sm">Novo Usuário para {tenantForm.companyName}</h4>
                                        <div className="grid grid-cols-2 gap-3 mb-3">
                                            <input required placeholder="Nome" className="border p-2 rounded text-sm" value={newTenantUser.name} onChange={e => setNewTenantUser({...newTenantUser, name: e.target.value})} />
                                            <input required type="email" placeholder="Email" className="border p-2 rounded text-sm" value={newTenantUser.email} onChange={e => setNewTenantUser({...newTenantUser, email: e.target.value})} />
                                            <input required type="password" placeholder="Senha Provisória" className="border p-2 rounded text-sm" value={newTenantUser.password} onChange={e => setNewTenantUser({...newTenantUser, password: e.target.value})} />
                                            <select className="border p-2 rounded text-sm bg-white" value={newTenantUser.role} onChange={e => setNewTenantUser({...newTenantUser, role: e.target.value})}>
                                                <option value="admin">Administrador</option>
                                                <option value="recruiter">Recrutador</option>
                                            </select>
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button type="button" onClick={() => setIsAddingUser(false)} className="text-gray-500 text-sm hover:underline">Cancelar</button>
                                            <button type="submit" className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-bold shadow-sm">Adicionar</button>
                                        </div>
                                    </form>
                                )}

                                {/* Lista de Usuários */}
                                {loadingUsers ? <div className="text-center py-4 text-gray-500">Carregando equipe...</div> : (
                                    <div className="border rounded-lg overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-50 text-gray-500">
                                                <tr>
                                                    <th className="p-3">Usuário</th>
                                                    <th className="p-3">Função</th>
                                                    <th className="p-3 text-right">Ação</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {tenantUsers.length === 0 ? (
                                                    <tr><td colSpan="3" className="p-4 text-center text-gray-400">Nenhum usuário encontrado nesta empresa.</td></tr>
                                                ) : (
                                                    tenantUsers.map(u => (
                                                        <tr key={u.id} className="hover:bg-gray-50">
                                                            <td className="p-3">
                                                                <div className="font-medium text-gray-900">{u.name}</div>
                                                                <div className="text-xs text-gray-500">{u.email}</div>
                                                            </td>
                                                            <td className="p-3">
                                                                <span className={`px-2 py-0.5 rounded text-xs border ${u.role === 'admin' || u.role === 'Administrador' ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                                                    {u.role}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 text-right">
                                                                <button onClick={() => handleRemoveUserFromTenant(u.id)} className="text-gray-400 hover:text-red-600 p-1">
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