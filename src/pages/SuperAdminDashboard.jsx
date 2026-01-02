import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { useNavigate } from 'react-router-dom';
import { Building, Edit, Trash2, Plus, X, Save, UserCheck, CheckCircle, AlertTriangle } from 'lucide-react';

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState([]);
  const [plans, setPlans] = useState([]);
  
  // Controle de Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null); // Se null, é modo CRIAÇÃO (Provisionamento)
  
  // Estado Unificado do Formulário
  const [formData, setFormData] = useState({ 
      companyName: '', 
      planId: 'freemium', 
      cnpj: '',
      // Campos exclusivos para Provisionamento (Criação)
      adminName: '', 
      adminEmail: '', 
      adminPassword: ''
  });

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return navigate('/login');
    
    // Validação Robusta: É Super Admin?
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('is_admin_system')
        .eq('id', session.user.id)
        .single();

    if (!profile?.is_admin_system) {
        alert("Acesso restrito: Área exclusiva para administração da Novva."); 
        return navigate('/');
    }
    fetchData(session.access_token);
  };

  const fetchData = async (token) => {
    setLoading(true);
    try {
      // Reutiliza a API admin existente
      const res = await fetch('/api/admin?action=getTenantsAndPlans', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setTenants(data.tenants || []);
        setPlans(data.plans || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    
    // LÓGICA DO FLUXO:
    // Se tem editingTenant -> updateTenant (Só muda dados da empresa)
    // Se NÃO tem -> provisionTenant (Cria Empresa + Usuário Admin do Cliente)
    const action = editingTenant ? 'updateTenant' : 'provisionTenant';
    const payload = editingTenant ? { 
        id: editingTenant.id, 
        companyName: formData.companyName, 
        planId: formData.planId, 
        cnpj: formData.cnpj 
    } : formData;

    try {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            Authorization: `Bearer ${session.access_token}` 
          },
          body: JSON.stringify({ action, ...payload })
        });

        const data = await res.json();

        if (res.ok) {
          alert(editingTenant ? "Dados da empresa atualizados!" : "Cliente provisionado com sucesso! Envie as credenciais para o responsável.");
          setIsModalOpen(false);
          resetForm();
          fetchData(session.access_token);
        } else {
          throw new Error(data.error || "Erro desconhecido");
        }
    } catch (err) {
        alert("Erro: " + err.message);
    }
  };

  const handleDelete = async (tenantId) => {
      if(!confirm("PERIGO EXTREMO:\nIsso excluirá a empresa, todos os usuários, vagas e candidatos vinculados.\n\nDeseja realmente continuar?")) return;
      
      const { data: { session } } = await supabase.auth.getSession();
      try {
          const res = await fetch('/api/admin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ action: 'deleteTenant', tenantId })
          });
          
          if(res.ok) {
              alert("Empresa excluída.");
              fetchData(session.access_token);
          } else {
              alert("Erro ao excluir.");
          }
      } catch (e) { console.error(e); alert("Erro de conexão."); }
  };

  const openEdit = (t) => {
      setEditingTenant(t);
      // Preenche apenas dados da empresa, pois não editamos o admin aqui
      setFormData({ 
          companyName: t.companyName, 
          planId: t.planId, 
          cnpj: t.cnpj || '', 
          adminName: '', adminEmail: '', adminPassword: '' // Resetados pois não são usados no update
      });
      setIsModalOpen(true);
  };

  const openNew = () => {
      setEditingTenant(null);
      resetForm();
      setIsModalOpen(true);
  };

  const resetForm = () => {
      setFormData({ companyName: '', planId: 'freemium', cnpj: '', adminName: '', adminEmail: '', adminPassword: '' });
      setEditingTenant(null);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-500">Carregando Painel Novva...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Painel Novva</h1>
                <p className="text-slate-500">Gestão e Provisionamento de Clientes (SaaS)</p>
            </div>
            <button onClick={openNew} className="bg-slate-900 text-white px-5 py-2.5 rounded-lg flex gap-2 hover:bg-slate-800 shadow-lg transition-all items-center font-medium">
                <Plus size={18}/> Novo Cliente
            </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th className="p-5 font-semibold text-slate-600 text-sm uppercase tracking-wider">Empresa Cliente</th>
                        <th className="p-5 font-semibold text-slate-600 text-sm uppercase tracking-wider">CNPJ</th>
                        <th className="p-5 font-semibold text-slate-600 text-sm uppercase tracking-wider">Plano Atual</th>
                        <th className="p-5 font-semibold text-slate-600 text-sm uppercase tracking-wider text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {tenants.map(t => (
                        <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-5">
                                <div className="font-bold text-slate-800">{t.companyName}</div>
                                <div className="text-xs text-slate-400 font-mono mt-0.5">{t.id}</div>
                            </td>
                            <td className="p-5 text-slate-500 text-sm">{t.cnpj || '-'}</td>
                            <td className="p-5">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
                                  t.planId === 'pro' ? 'bg-purple-50 text-purple-700 border-purple-200' : 
                                  t.planId === 'enterprise' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-green-50 text-green-700 border-green-200'
                                }`}>
                                  {t.plans?.name || t.planId}
                                </span>
                            </td>
                            <td className="p-5 text-right flex justify-end gap-2">
                                <button onClick={() => openEdit(t)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar / Migrar Plano">
                                    <Edit size={18} />
                                </button>
                                <button onClick={() => handleDelete(t.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Cancelar Contrato e Excluir">
                                    <Trash2 size={18} />
                                </button>
                            </td>
                        </tr>
                    ))}
                    {tenants.length === 0 && (
                        <tr>
                            <td colSpan="4" className="p-10 text-center text-slate-400">Nenhum cliente cadastrado ainda.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-0 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-6 border-b border-slate-100">
                    <h3 className="text-xl font-bold text-slate-800">{editingTenant ? 'Editar Contrato' : 'Provisionar Novo Cliente'}</h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X/></button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
                    
                    {/* Bloco 1: Dados da Empresa */}
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <h4 className="font-bold text-sm text-slate-700 mb-4 flex items-center gap-2">
                            <Building size={16} className="text-slate-500"/> Dados da Empresa
                        </h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Razão Social</label>
                                <input required className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                    value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CNPJ</label>
                                    <input className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                        value={formData.cnpj} onChange={e => setFormData({...formData, cnpj: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Plano</label>
                                    <select className="w-full border border-slate-300 p-2.5 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none" 
                                        value={formData.planId} onChange={e => setFormData({...formData, planId: e.target.value})}>
                                        {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bloco 2: Provisionamento do Dono (Aparece só na criação) */}
                    {!editingTenant && (
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                            <h4 className="font-bold text-sm text-blue-800 mb-4 flex items-center gap-2">
                                <UserCheck size={16}/> Acesso Inicial (Admin do Cliente)
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-blue-700/70 uppercase mb-1">Nome do Responsável</label>
                                    <input required className="w-full border border-blue-200 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                        placeholder="Ex: João da Silva" value={formData.adminName} onChange={e => setFormData({...formData, adminName: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-blue-700/70 uppercase mb-1">E-mail de Login</label>
                                    <input required type="email" className="w-full border border-blue-200 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                        placeholder="joao@empresa.com" value={formData.adminEmail} onChange={e => setFormData({...formData, adminEmail: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-blue-700/70 uppercase mb-1">Senha Temporária</label>
                                    <input required type="text" className="w-full border border-blue-200 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono" 
                                        placeholder="Ex: Mudar123" value={formData.adminPassword} onChange={e => setFormData({...formData, adminPassword: e.target.value})} />
                                    <div className="flex items-start gap-2 mt-2 text-xs text-blue-600">
                                        <CheckCircle size={12} className="mt-0.5"/>
                                        <p>Este usuário será criado automaticamente como <strong>Admin</strong> da nova empresa.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div className="pt-2">
                        <button type="submit" className="w-full bg-slate-900 text-white py-3.5 rounded-lg font-bold hover:bg-slate-800 flex justify-center items-center gap-2 shadow-lg hover:shadow-xl transition-all">
                            <Save size={18}/> {editingTenant ? 'Salvar Alterações de Contrato' : 'Confirmar Provisionamento'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}