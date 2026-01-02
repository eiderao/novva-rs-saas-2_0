import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { Building, Users, ArrowLeft, Shield, Plus, Trash2, Mail, Lock } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('company');
  const [loading, setLoading] = useState(true);
  
  const [tenant, setTenant] = useState(null);
  const [team, setTeam] = useState([]);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);

  // Estados para Novo Usuário
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'recruiter', isAdmin: false });
  const [isAddingUser, setIsAddingUser] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate('/login');

      // 1. Pega perfil do usuário logado
      const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', session.user.id).single();
      setCurrentUserProfile(profile);

      if (profile?.tenantId) {
        // 2. Busca dados da empresa e equipe via API Segura
        const res = await fetch(`/api/admin?action=getTenantDetails&tenantId=${profile.tenantId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        const data = await res.json();
        
        if (res.ok) {
          setTenant(data.tenant);
          setTeam(data.users || []);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
            action: 'createUser',
            tenantId: tenant.id,
            ...newUser
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert("Usuário adicionado à equipe!");
      setIsAddingUser(false);
      setNewUser({ name: '', email: '', password: '', role: 'recruiter', isAdmin: false });
      fetchData(); // Atualiza lista
    } catch (err) {
      alert("Erro: " + err.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm("Tem certeza? O usuário perderá o acesso imediatamente.")) return;
    const { data: { session } } = await supabase.auth.getSession();
    
    const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'deleteUser', userId })
    });

    if (res.ok) {
        alert("Usuário removido.");
        fetchData();
    } else {
        alert("Erro ao remover usuário.");
    }
  };

  if (loading) return <div className="p-10 text-center">Carregando...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <button onClick={() => navigate('/')} className="flex items-center text-gray-500 mb-6 hover:text-blue-600">
        <ArrowLeft className="mr-2" size={20}/> Voltar ao Dashboard
      </button>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Configurações</h1>
        {/* Link Secreto para Super Admin (Só aparece se tiver permissão) */}
        {currentUserProfile?.is_admin_system && (
            <button onClick={() => navigate('/admin/super')} className="text-xs bg-slate-800 text-white px-3 py-1 rounded hover:bg-slate-700 transition">
                Ir para Painel Novva (Super Admin)
            </button>
        )}
      </div>

      <div className="flex gap-6 border-b mb-6">
        <button onClick={() => setActiveTab('company')} className={`pb-3 px-2 border-b-2 flex items-center gap-2 font-medium ${activeTab === 'company' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
          <Building size={18}/> Minha Empresa
        </button>
        <button onClick={() => setActiveTab('team')} className={`pb-3 px-2 border-b-2 flex items-center gap-2 font-medium ${activeTab === 'team' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
          <Users size={18}/> Gestão de Equipe
        </button>
      </div>

      {/* ABA 1: EMPRESA (READ ONLY) */}
      {activeTab === 'company' && tenant && (
        <div className="bg-white p-6 rounded-lg shadow-sm border max-w-2xl animate-in fade-in">
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-500 mb-1">Razão Social</label>
                <div className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    {tenant.companyName} <Lock size={16} className="text-gray-400" title="Gerenciado pela Novva"/>
                </div>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex items-start gap-3">
                    <Shield className="text-slate-600 mt-1" size={24} />
                    <div>
                        <h3 className="font-bold text-slate-800">Plano de Assinatura</h3>
                        <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                            Alterações de plano, dados cadastrais e faturamento são gerenciados exclusivamente pela equipe de suporte da <strong>Novva</strong>.
                        </p>
                        <div className="mt-3">
                            <span className="text-xs font-semibold bg-slate-200 text-slate-700 px-2 py-1 rounded">
                                Status: Ativo
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* ABA 2: EQUIPE (CRUD) */}
      {activeTab === 'team' && (
        <div className="animate-in fade-in">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Membros da Equipe</h2>
                {!isAddingUser && (
                    <button onClick={() => setIsAddingUser(true)} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700 shadow-sm transition">
                        <Plus size={18}/> Adicionar Usuário
                    </button>
                )}
            </div>

            {isAddingUser && (
                <div className="bg-blue-50 p-5 rounded-lg border border-blue-100 mb-6">
                    <h3 className="font-bold mb-4 text-blue-900">Cadastrar Novo Membro</h3>
                    <form onSubmit={handleAddUser}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <input required placeholder="Nome Completo" className="border p-2 rounded" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                            <input required type="email" placeholder="E-mail Corporativo" className="border p-2 rounded" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                            <input required type="password" placeholder="Senha Inicial" className="border p-2 rounded" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                            <div className="flex items-center gap-2 bg-white px-3 border rounded">
                                <input type="checkbox" id="adminCheck" checked={newUser.isAdmin} onChange={e => setNewUser({...newUser, isAdmin: e.target.checked})} />
                                <label htmlFor="adminCheck" className="text-sm cursor-pointer select-none">Acesso Admin (Pode gerenciar equipe)</label>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700">Salvar</button>
                            <button type="button" onClick={() => setIsAddingUser(false)} className="bg-white text-gray-700 px-6 py-2 rounded border hover:bg-gray-50">Cancelar</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-lg shadow border overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="p-4 font-medium text-gray-600">Nome</th>
                            <th className="p-4 font-medium text-gray-600">Email</th>
                            <th className="p-4 font-medium text-gray-600">Perfil</th>
                            <th className="p-4 font-medium text-gray-600 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {team.map(user => (
                            <tr key={user.id} className="hover:bg-gray-50">
                                <td className="p-4 font-medium text-gray-900">{user.name}</td>
                                <td className="p-4 text-gray-600 flex items-center gap-2"><Mail size={14}/> {user.email}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${user.isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                                        {user.isAdmin ? 'Admin' : 'Membro'}
                                    </span>
                                </td>
                                <td className="p-4 text-right">
                                    {user.id !== currentUserProfile?.id && (
                                        <button onClick={() => handleDeleteUser(user.id)} className="text-gray-400 hover:text-red-600 p-2 rounded transition" title="Remover Usuário">
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {team.length === 0 && <div className="p-8 text-center text-gray-500">Nenhum membro encontrado.</div>}
            </div>
        </div>
      )}
    </div>
  );
}