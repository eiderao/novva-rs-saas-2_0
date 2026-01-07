import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { useNavigate } from 'react-router-dom';
import { Shield, Building, Users, CreditCard, Edit, Trash2, Plus, Save, X, DollarSign, ArrowLeft, Calendar, FileText, CheckCircle } from 'lucide-react';

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tenants'); // 'tenants' | 'plans'
  
  // Dados
  const [tenants, setTenants] = useState([]);
  const [plans, setPlans] = useState([]);

  // Estados de Formulário
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [isEditingTenant, setIsEditingTenant] = useState(false); // Novo: Edição de Empresa
  
  // Objeto Modelo do Plano
  const initialPlanState = { 
      id: '', name: '', price: 0, 
      user_limit: 1, job_limit: 1, candidate_limit: -1, 
      plan_billing_period: 'monthly' 
  };
  const [planForm, setPlanForm] = useState(initialPlanState);

  // Objeto Modelo do Tenant
  const [tenantForm, setTenantForm] = useState({ id: '', companyName: '', planId: '', cnpj: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return navigate('/login');

    try {
        // Chamada única para buscar tudo (conforme sua API getTenantsAndPlans)
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

  // --- GESTÃO DE PLANOS ---

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
    
    // Determina se é CRIAÇÃO ou ATUALIZAÇÃO baseado se o plano já existe na lista
    // (Ou poderíamos usar um flag isNew, mas checar o ID na lista atual é seguro)
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

  // --- GESTÃO DE TENANTS (Edição Rápida) ---
  
  const handleEditTenant = (tenant) => {
      setTenantForm({
          id: tenant.id,
          companyName: tenant.companyName,
          planId: tenant.planId,
          cnpj: tenant.cnpj || ''
      });
      setIsEditingTenant(true);
  };

  const handleSaveTenant = async (e) => {
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

          if (!res.ok) throw new Error('Falha ao atualizar empresa.');
          
          alert("Empresa atualizada!");
          setIsEditingTenant(false);
          fetchData();
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
        {/* Navegação */}
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
                                        <Edit size={14}/> Editar
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {/* TAB 2: PLANOS */}
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
                                    <button onClick={() => handleEditPlan(plan)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit size={18}/></button>
                                    <button onClick={() => handleDeletePlan(plan.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={18}/></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* MODAL/SIDEBAR DE EDIÇÃO DE PLANO */}
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

                {/* MODAL DE EDIÇÃO DE TENANT */}
                {isEditingTenant && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                            <h3 className="text-lg font-bold mb-4">Editar Empresa</h3>
                            <form onSubmit={handleSaveTenant} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Nome da Empresa</label>
                                    <input className="w-full border p-2 rounded" value={tenantForm.companyName} onChange={e => setTenantForm({...tenantForm, companyName: e.target.value})} required />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">CNPJ</label>
                                    <input className="w-full border p-2 rounded" value={tenantForm.cnpj} onChange={e => setTenantForm({...tenantForm, cnpj: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Plano Atribuído</label>
                                    <select className="w-full border p-2 rounded bg-white" value={tenantForm.planId} onChange={e => setTenantForm({...tenantForm, planId: e.target.value})}>
                                        {plans.map(p => <option key={p.id} value={p.id}>{p.name} ({p.plan_billing_period})</option>)}
                                    </select>
                                </div>
                                <div className="flex justify-end gap-2 pt-4">
                                    <button type="button" onClick={() => setIsEditingTenant(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700">Salvar Alterações</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
}