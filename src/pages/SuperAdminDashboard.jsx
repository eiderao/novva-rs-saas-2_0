import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { useNavigate } from 'react-router-dom';
import { Building, Edit, Trash2, Plus, X, Save, AlertTriangle } from 'lucide-react';

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState([]);
  const [plans, setPlans] = useState([]);
  
  // Estados do Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [formData, setFormData] = useState({ companyName: '', planId: 'freemium', cnpj: '' });

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return navigate('/login');

    // Verifica se é Admin de Sistema (Super User)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin_system')
      .eq('id', session.user.id)
      .single();

    if (!profile?.is_admin_system) {
      alert("Acesso Negado: Apenas para administradores da Novva.");
      return navigate('/');
    }

    fetchData(session.access_token);
  };

  const fetchData = async (token) => {
    setLoading(true);
    try {
      // Reutiliza sua API existente que já busca tenants e planos
      const res = await fetch('/api/admin?action=getTenantsAndPlans', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setTenants(data.tenants || []);
        setPlans(data.plans || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    
    // Decide se é Criação ou Atualização baseado no estado
    const action = editingTenant ? 'updateTenant' : 'createTenant';
    const payload = editingTenant ? { ...formData, id: editingTenant.id } : formData;

    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ action, ...payload })
    });

    if (res.ok) {
      alert(editingTenant ? "Cliente atualizado com sucesso!" : "Cliente criado com sucesso!");
      setIsModalOpen(false);
      setEditingTenant(null);
      setFormData({ companyName: '', planId: 'freemium', cnpj: '' });
      fetchData(session.access_token);
    } else {
      const err = await res.json();
      alert("Erro: " + err.error);
    }
  };

  const handleDelete = async (tenantId) => {
    if (!confirm("PERIGO: Isso excluirá a empresa e TODOS os dados vinculados. Continuar?")) return;
    
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ action: 'deleteTenant', tenantId })
    });

    if (res.ok) {
      alert("Empresa excluída.");
      fetchData(session.access_token);
    } else {
      alert("Erro ao excluir.");
    }
  };

  const openEdit = (tenant) => {
    setEditingTenant(tenant);
    setFormData({ 
      companyName: tenant.companyName, 
      planId: tenant.planId || 'freemium', 
      cnpj: tenant.cnpj || '' 
    });
    setIsModalOpen(true);
  };

  if (loading) return <div className="p-10 text-center">Carregando Painel Administrativo...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Painel Novva (Super Admin)</h1>
            <p className="text-slate-500">Gestão de Carteira de Clientes</p>
          </div>
          <button 
            onClick={() => { setEditingTenant(null); setFormData({companyName:'', planId:'freemium', cnpj:''}); setIsModalOpen(true); }}
            className="bg-slate-900 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-slate-800 shadow"
          >
            <Plus size={18}/> Novo Cliente
          </button>
        </div>

        <div className="bg-white rounded-lg shadow border overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-4 font-semibold text-slate-600">Empresa Cliente</th>
                <th className="p-4 font-semibold text-slate-600">CNPJ</th>
                <th className="p-4 font-semibold text-slate-600">Plano Atual</th>
                <th className="p-4 font-semibold text-slate-600 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tenants.map(t => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="p-4 font-medium">{t.companyName}</td>
                  <td className="p-4 text-slate-500 text-sm">{t.cnpj || 'N/A'}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                      t.planId === 'pro' ? 'bg-purple-100 text-purple-700' : 
                      t.planId === 'enterprise' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {t.plans?.name || t.planId}
                    </span>
                  </td>
                  <td className="p-4 text-right flex justify-end gap-2">
                    <button onClick={() => openEdit(t)} className="p-2 text-blue-600 hover:bg-blue-50 rounded" title="Editar / Migrar Plano">
                      <Edit size={18} />
                    </button>
                    <button onClick={() => handleDelete(t.id)} className="p-2 text-red-600 hover:bg-red-50 rounded" title="Cancelar Contrato">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="text-xl font-bold text-slate-800">{editingTenant ? 'Manutenção de Cliente' : 'Novo Cliente'}</h3>
              <button onClick={() => setIsModalOpen(false)}><X className="text-slate-400 hover:text-slate-600"/></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nome da Empresa</label>
                <input required className="w-full border p-2 rounded" value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">CNPJ</label>
                <input className="w-full border p-2 rounded" value={formData.cnpj} onChange={e => setFormData({...formData, cnpj: e.target.value})} />
              </div>
              <div className="bg-blue-50 p-3 rounded border border-blue-100">
                <label className="block text-sm font-bold text-blue-800 mb-1">Plano de Assinatura</label>
                <select className="w-full border p-2 rounded bg-white" value={formData.planId} onChange={e => setFormData({...formData, planId: e.target.value})}>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.user_limit === -1 ? 'Infinitos' : p.user_limit} usuários)
                    </option>
                  ))}
                </select>
                <p className="text-xs text-blue-600 mt-1">Alterar isso afeta imediatamente os limites do cliente.</p>
              </div>
              
              <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded font-bold hover:bg-blue-700 flex justify-center items-center gap-2">
                <Save size={18}/> {editingTenant ? 'Salvar Alterações' : 'Criar Empresa'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}