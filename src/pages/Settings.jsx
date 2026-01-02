import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { Building, Users, ArrowLeft, Shield, Plus, Trash2, Mail, Lock, AlertCircle } from 'lucide-react';

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

      // 1. Pega perfil do usuário logado diretamente
      const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', session.user.id).single();
      setCurrentUserProfile(profile);

      if (profile?.tenantId) {
        // 2. Busca EMPRESA diretamente (Leitura)
        const { data: tenantData } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', profile.tenantId)
            .single();
        setTenant(tenantData);

        // 3. Busca EQUIPE diretamente (Leitura)
        const { data: teamData } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('tenantId', profile.tenantId);
        setTeam(teamData || []);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email || !newUser.password) return alert("Preencha todos os campos.");

    const { data: { session } } = await supabase.auth.getSession();
    
    // Tenta usar a API Serverless (Produção)
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
      if (!res.ok) throw new Error(data.error || "Erro ao conectar na API.");

      alert("Usuário adicionado com sucesso!");
      setIsAddingUser(false);
      setNewUser({ name: '', email: '', password: '', role: 'recruiter', isAdmin: false });
      fetchData();
      
    } catch (err) {
      console.error(err);
      alert("Erro ao criar usuário: " + err.message + "\n\nNota: Em localhost, a criação de usuários depende da Vercel Functions rodando. Se estiver testando localmente, suba para a Vercel.");
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm("Tem certeza? O acesso deste usuário será revogado imediatamente.")) return;
    const { data: { session } } = await supabase.auth.getSession();
    
    try {
        const res = await fetch('/api/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ action: 'deleteUser', userId })
        });

        if (res.ok) {
            alert("Usuário removido.");
            fetchData();
        } else {
            throw new Error("Falha na API");
        }
    } catch (e) {
        alert("Erro: " + e.message);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500">Carregando configurações...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto font-sans">
      <button onClick={() => navigate('/')} className="flex items-center text-gray-500 mb-6 hover:text-blue-600 transition-colors">
        <ArrowLeft className="mr-2" size={20}/> Voltar ao Dashboard
      </button>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Configurações</h1>
        {currentUserProfile?.is_admin_system && (
            <button onClick={() => navigate('/admin/super')} className="text-xs bg-slate-800 text-white px-3 py-1 rounded hover:bg-slate-700 transition shadow-sm">
                Acessar Painel Novva (Super Admin)
            </button>
        )}
      </div>

      <div className="flex gap-6 border-b mb-6">
        <button onClick={() => setActiveTab('company')} className={`pb-3 px-2 border-b-2 flex items-center gap-2 font-medium transition-colors ${activeTab === 'company' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <Building size={18}/> Minha Empresa
        </button>
        <button onClick={() => setActiveTab('team')} className={`pb-3 px-2 border-b-2 flex items-center gap-2 font-medium transition-colors ${activeTab === 'team' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <Users size={18}/> Gestão de Equipe
        </button>
      </div>

      {/* ABA 1: EMPRESA (LEITURA) */}
      {activeTab === 'company' && tenant && (
        <div className="bg-white p-6 rounded-lg shadow-sm border max-w-2xl animate-in fade-in slide-in-from-left-2">
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-500 mb-1">Razão Social</label>
                <div className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    {tenant.companyName} <Lock size={18} className="text-gray-400" title="Campo gerenciado pela Novva"/>
                </div>
                <div className="text-sm text-gray-400 font-mono mt-1">ID: {tenant.id}</div>
            </div>
            
            <div className="bg-slate-50 p-5 rounded-lg border border-slate-200">
                <div className="flex items-start gap-4">
                    <Shield className="text-slate-600 mt-1 shrink-0" size={24} />
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg">Plano de Assinatura</h3>
                        <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                            Seu plano atual é gerenciado pela equipe da <strong>Novva Desenvolvimento</strong>.
                            Para upgrades, downgrades ou alterações cadastrais (CNPJ), entre em contato com nosso suporte.
                        </p>
                        <div className="mt-4 flex gap-2">
                            <span className="text-xs font-semibold bg-green-100 text-green-700 px-3 py-1 rounded-full border border-green-200">
                                Status: Ativo
                            </span>
                            <span className="text-xs font-semibold bg-slate-200 text-slate-700 px-3 py-1 rounded-full border border-slate-300">
                                Plano ID: {tenant.planId || 'Standard'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* ABA 2: EQUIPE (CRUD) */}
      {activeTab === 'team' && (
        <div className="animate-in fade-in slide-in-from-right-2">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-lg font-semibold text-gray-800">Membros da Equipe</h2>
                    <p className="text-sm text-gray-500">Gerencie quem tem acesso aos dados da {tenant?.companyName}.</p>
                </div>
                {!isAddingUser && (
                    <button onClick={() => setIsAddingUser(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-sm transition">
                        <Plus size={18}/> Adicionar Usuário
                    </button>
                )}
            </div>

            {isAddingUser && (
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 mb-6 shadow-sm">
                    <h3 className="font-bold mb-4 text-blue-900 flex items-center gap-2"><Plus size={16}/> Cadastrar Novo Membro</h3>
                    <form onSubmit={handleAddUser}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                            <div>
                                <label className="block text-xs font-bold text-blue-700 mb-1">Nome Completo</label>
                                <input required className="w-full border border-blue-200 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                    value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-blue-700 mb-1">E-mail Corporativo</label>
                                <input required type="email" className="w-full border border-blue-200 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                    value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-blue-700 mb-1">Senha Inicial</label>
                                <input required type="password" className="w-full border border-blue-200 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                    value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                            </div>
                            <div className="flex items-center h-full pt-6">
                                <label className="flex items-center gap-3 cursor-pointer bg-white px-4 py-2 rounded-lg border border-blue-200 w-full hover:bg-blue-50 transition">
                                    <input type="checkbox" className="w-5 h-5 text-blue-600 rounded" checked={newUser.isAdmin} onChange={e => setNewUser({...newUser, isAdmin: e.target.checked})} />
                                    <span className="text-sm font-medium text-blue-900">Dar acesso de Administrador?</span>
                                </label>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-blue-700 shadow transition">Salvar Usuário</button>
                            <button type="button" onClick={() => setIsAddingUser(false)} className="bg-white text-gray-700 px-6 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 font-medium transition">Cancelar</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="p-5 font-semibold text-slate-600 text-sm uppercase tracking-wide">Nome</th>
                            <th className="p-5 font-semibold text-slate-600 text-sm uppercase tracking-wide">Email</th>
                            <th className="p-5 font-semibold text-slate-600 text-sm uppercase tracking-wide">Função</th>
                            <th className="p-5 font-semibold text-slate-600 text-sm uppercase tracking-wide text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {team.map(user => (
                            <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-5 font-medium text-slate-900">{user.name || 'Sem nome'}</td>
                                <td className="p-5 text-slate-600 flex items-center gap-2"><Mail size={16} className="text-slate-400"/> {user.email}</td>
                                <td className="p-5">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${user.isAdmin ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                        {user.isAdmin ? 'Admin' : 'Membro'}
                                    </span>
                                </td>
                                <td className="p-5 text-right">
                                    {user.id !== currentUserProfile?.id ? (
                                        <button onClick={() => handleDeleteUser(user.id)} className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-all" title="Remover Usuário">
                                            <Trash2 size={18} />
                                        </button>
                                    ) : (
                                        <span className="text-xs text-slate-400 italic pr-2">Você</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {team.length === 0 && (
                    <div className="p-10 text-center flex flex-col items-center">
                        <AlertCircle className="text-slate-300 mb-2" size={48} />
                        <p className="text-slate-500 font-medium">Nenhum membro encontrado.</p>
                        <p className="text-sm text-slate-400">Adicione usuários para colaborar nesta empresa.</p>
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
}