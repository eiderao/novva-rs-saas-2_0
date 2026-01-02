import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { useNavigate } from 'react-router-dom';
import { Building, Edit, Trash2, Plus, X, Save, UserCheck, Key, Users, Check } from 'lucide-react';

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState([]);
  const [plans, setPlans] = useState([]);
  
  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false); // Modal Empresa
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false); // Modal Usuários
  
  const [editingTenant, setEditingTenant] = useState(null); 
  const [selectedTenantUsers, setSelectedTenantUsers] = useState([]); // Lista de usuários do tenant selecionado
  const [currentTenantName, setCurrentTenantName] = useState('');
  
  // Estado para Edição de Usuário
  const [editingUser, setEditingUser] = useState(null); // ID do user sendo editado
  const [userForm, setUserForm] = useState({ id: '', name: '', email: '', password: '' });

  // Formulário Empresa
  const [formData, setFormData] = useState({ 
      companyName: '', planId: 'freemium', cnpj: '',
      adminName: '', adminEmail: '', adminPassword: ''
  });

  useEffect(() => { checkPermission(); }, []);

  const checkPermission = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return navigate('/login');
    
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('is_admin_system')
        .eq('id', session.user.id)
        .single();

    if (!profile?.is_admin_system) {
        alert("Acesso restrito."); 
        return navigate('/');
    }
    fetchData(session.access_token);
  };

  const fetchData = async (token) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin?action=getTenantsAndPlans', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setTenants(data.tenants || []);
        setPlans(data.plans || []);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // --- GESTÃO DE EMPRESAS ---

  const handleSubmitTenant = async (e) => {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    const action = editingTenant ? 'updateTenant' : 'provisionTenant';
    const payload = editingTenant ? { id: editingTenant.id, companyName: formData.companyName, planId: formData.planId, cnpj: formData.cnpj } : formData;

    try {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ action, ...payload })
        });
        const data = await res.json();
        if (res.ok) {
          alert("Sucesso!");
          setIsModalOpen(false);
          setEditingTenant(null);
          resetForm();
          fetchData(session.access_token);
        } else {
          throw new Error(data.error);
        }
    } catch (err) { alert("Erro: " + err.message); }
  };

  const handleDeleteTenant = async (tenantId) => {
      if(!confirm("Tem certeza absoluta? Isso apagará TUDO desta empresa.")) return;
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: 'deleteTenant', tenantId })
      });
      fetchData(session.access_token);
  };

  // --- GESTÃO DE USUÁRIOS DO CLIENTE ---

  const openUsersModal = async (tenant) => {
      setCurrentTenantName(tenant.companyName);
      const { data: { session } } = await supabase.auth.getSession();
      
      // Busca usuários dessa empresa
      const res = await fetch(`/api/admin?action=getTenantDetails&tenantId=${tenant.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      
      if (res.ok) {
          setSelectedTenantUsers(data.users || []);
          setIsUsersModalOpen(true);
          setEditingUser(null);
      } else {
          alert("Erro ao buscar usuários: " + data.error);
      }
  };

  const handleEditUserClick = (user) => {
      setEditingUser(user.id);
      setUserForm({ id: user.id, name: user.name, email: user.email, password: '' });
  };

  const handleSaveUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!userForm.name || !userForm.email) return alert("Nome e Email são obrigatórios.");

      try {
          const res = await fetch('/api/admin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({
                  action: 'updateUserAuth',
                  userId: userForm.id,
                  name: userForm.name,
                  email: userForm.email,
                  password: userForm.password || undefined // Só envia se preenchido
              })
          });

          if (res.ok) {
              alert("Usuário atualizado com sucesso!");
              setEditingUser(null);
              // Recarrega a lista localmente
              setSelectedTenantUsers(prev => prev.map(u => u.id === userForm.id ? { ...u, name: userForm.name, email: userForm.email } : u));
          } else {
              const err = await res.json();
              throw new Error(err.error);
          }
      } catch (e) {
          alert("Erro ao atualizar: " + e.message);
      }
  };

  // --- AUXILIARES ---

  const openEditTenant = (t) => {
      setEditingTenant(t);
      setFormData({ companyName: t.companyName, planId: t.planId, cnpj: t.cnpj || '', adminName: '', adminEmail: '', adminPassword: '' });
      setIsModalOpen(true);
  };

  const openNewTenant = () => {
      setEditingTenant(null);
      resetForm();
      setIsModalOpen(true);
  };

  const resetForm = () => {
      setFormData({ companyName: '', planId: 'freemium', cnpj: '', adminName: '', adminEmail: '', adminPassword: '' });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-500">Carregando Painel...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Painel Novva</h1>
                <p className="text-slate-500">Gestão e Provisionamento de Clientes (SaaS)</p>
            </div>
            <button onClick={openNewTenant} className="bg-slate-900 text-white px-5 py-2.5 rounded-lg flex gap-2 hover:bg-slate-800 shadow-lg items-center font-medium">
                <Plus size={18}/> Novo Cliente
            </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th className="p-5 text-sm uppercase text-slate-500 font-bold">Empresa Cliente</th>
                        <th className="p-5 text-sm uppercase text-slate-500 font-bold">Plano</th>
                        <th className="p-5 text-right text-sm uppercase text-slate-500 font-bold">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {tenants.map(t => (
                        <tr key={t.id} className="hover:bg-slate-50">
                            <td className="p-5">
                                <div className="font-bold text-slate-800">{t.companyName}</div>
                                <div className="text-xs text-slate-400 font-mono">{t.cnpj || 'Sem CNPJ'}</div>
                            </td>
                            <td className="p-5">
                                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase border bg-slate-100 text-slate-600 border-slate-200">
                                  {t.plans?.name || t.planId}
                                </span>
                            </td>
                            <td className="p-5 text-right flex justify-end gap-2">
                                <button onClick={() => openUsersModal(t)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg" title="Gerenciar Usuários / Senhas">
                                    <Users size={18} />
                                </button>
                                <button onClick={() => openEditTenant(t)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Editar Empresa">
                                    <Edit size={18} />
                                </button>
                                <button onClick={() => handleDeleteTenant(t.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Excluir">
                                    <Trash2 size={18} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>

      {/* MODAL 1: EMPRESA (Criação/Edição) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="flex justify-between items-center p-6 border-b">
                    <h3 className="text-xl font-bold">{editingTenant ? 'Editar Empresa' : 'Provisionar Novo Cliente'}</h3>
                    <button onClick={() => setIsModalOpen(false)}><X/></button>
                </div>
                <form onSubmit={handleSubmitTenant} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                    {/* Campos de Empresa ... */}
                    <div className="space-y-3">
                        <label className="block text-xs font-bold uppercase">Razão Social</label>
                        <input required className="w-full border p-2.5 rounded-lg" value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} />
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold uppercase">CNPJ</label>
                                <input className="w-full border p-2.5 rounded-lg" value={formData.cnpj} onChange={e => setFormData({...formData, cnpj: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase">Plano</label>
                                <select className="w-full border p-2.5 rounded-lg bg-white" value={formData.planId} onChange={e => setFormData({...formData, planId: e.target.value})}>
                                    {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {!editingTenant && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-3">
                            <h4 className="font-bold text-sm text-blue-800 flex items-center gap-2"><UserCheck size={16}/> Admin Inicial</h4>
                            <input required placeholder="Nome Responsável" className="w-full border p-2 rounded" value={formData.adminName} onChange={e => setFormData({...formData, adminName: e.target.value})} />
                            <input required type="email" placeholder="Email Login" className="w-full border p-2 rounded" value={formData.adminEmail} onChange={e => setFormData({...formData, adminEmail: e.target.value})} />
                            <input required type="text" placeholder="Senha Temporária" className="w-full border p-2 rounded" value={formData.adminPassword} onChange={e => setFormData({...formData, adminPassword: e.target.value})} />
                        </div>
                    )}

                    <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800 flex justify-center gap-2">
                        <Save size={18}/> Salvar
                    </button>
                </form>
            </div>
        </div>
      )}

      {/* MODAL 2: GESTÃO DE USUÁRIOS (Reset de Senha/Correção) */}
      {isUsersModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                      <div>
                          <h3 className="text-lg font-bold text-slate-800">Usuários: {currentTenantName}</h3>
                          <p className="text-xs text-slate-500">Gerencie acessos e resete senhas se necessário.</p>
                      </div>
                      <button onClick={() => setIsUsersModalOpen(false)}><X className="text-slate-400 hover:text-slate-600"/></button>
                  </div>
                  
                  <div className="p-0 overflow-y-auto flex-1">
                      <table className="w-full text-left border-collapse">
                          <thead className="bg-slate-100 text-xs uppercase text-slate-500 font-semibold">
                              <tr>
                                  <th className="p-4 border-b">Nome</th>
                                  <th className="p-4 border-b">Email (Login)</th>
                                  <th className="p-4 border-b">Cargo</th>
                                  <th className="p-4 border-b text-right">Ação</th>
                              </tr>
                          </thead>
                          <tbody>
                              {selectedTenantUsers.map(u => (
                                  <tr key={u.id} className={`border-b hover:bg-slate-50 ${editingUser === u.id ? 'bg-blue-50' : ''}`}>
                                      {editingUser === u.id ? (
                                          // MODO EDIÇÃO
                                          <>
                                              <td className="p-3">
                                                  <input className="w-full border border-blue-300 p-1.5 rounded text-sm" 
                                                      value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} />
                                              </td>
                                              <td className="p-3">
                                                  <input className="w-full border border-blue-300 p-1.5 rounded text-sm" 
                                                      value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} />
                                              </td>
                                              <td className="p-3 text-sm text-slate-500">{u.role}</td>
                                              <td className="p-3 text-right">
                                                  <div className="flex flex-col gap-2 items-end">
                                                      <input type="text" placeholder="Nova Senha (Opcional)" className="w-32 border border-blue-300 p-1.5 rounded text-xs" 
                                                          value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} />
                                                      <div className="flex gap-2">
                                                          <button onClick={handleSaveUser} className="bg-blue-600 text-white p-1.5 rounded hover:bg-blue-700" title="Salvar"><Check size={16}/></button>
                                                          <button onClick={() => setEditingUser(null)} className="bg-white border text-slate-500 p-1.5 rounded hover:bg-slate-100" title="Cancelar"><X size={16}/></button>
                                                      </div>
                                                  </div>
                                              </td>
                                          </>
                                      ) : (
                                          // MODO LEITURA
                                          <>
                                              <td className="p-4 font-medium text-slate-700">{u.name}</td>
                                              <td className="p-4 text-slate-600 text-sm">{u.email}</td>
                                              <td className="p-4">
                                                  <span className={`px-2 py-1 text-xs rounded-full border ${u.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-600'}`}>
                                                      {u.role}
                                                  </span>
                                              </td>
                                              <td className="p-4 text-right">
                                                  <button onClick={() => handleEditUserClick(u)} className="text-blue-600 hover:bg-blue-50 p-2 rounded transition flex items-center gap-1 ml-auto text-sm font-medium">
                                                      <Key size={14}/> Editar Acesso
                                                  </button>
                                              </td>
                                          </>
                                      )}
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                      {selectedTenantUsers.length === 0 && <div className="p-8 text-center text-slate-400">Nenhum usuário encontrado nesta empresa.</div>}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}