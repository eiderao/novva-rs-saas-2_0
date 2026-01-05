import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { Building, Users, ArrowLeft, Shield, Plus, Trash2, Mail, Lock, AlertCircle, Briefcase, Crown, User, Save, Key } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('company'); // company, team, profile
  const [loading, setLoading] = useState(true);
  
  const [tenant, setTenant] = useState(null);
  const [team, setTeam] = useState([]);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);

  // Estados para Edição do Próprio Perfil
  const [myProfileForm, setMyProfileForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Estados para Novo Usuário da Equipe
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: '', isAdmin: false });
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

      // Preenche o formulário de perfil com os dados atuais
      setMyProfileForm(prev => ({ ...prev, name: profile.name || '', email: profile.email || session.user.email }));

      if (profile?.tenantId) {
        // 2. Busca EMPRESA
        const { data: tenantData } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', profile.tenantId)
            .single();
        setTenant(tenantData);

        // 3. Busca EQUIPE (Multi-tenant seguro)
        // Busca na tabela de junção user_tenants e faz o join com user_profiles
        // IMPORTANTE: O join 'user:user_profiles' depende da FK criada no SQL
        const { data: teamRelations, error: teamError } = await supabase
            .from('user_tenants')
            .select(`
                role,
                user_id,
                user:user_profiles (
                    id, name, email, is_admin_system
                )
            `)
            .eq('tenant_id', profile.tenantId);

        if (teamError) throw teamError;

        // Formata os dados para a estrutura que a tela espera
        const formattedTeam = [];
        if (teamRelations) {
            teamRelations.forEach(item => {
                // Defesa contra relacionamentos órfãos
                if (item.user) {
                    formattedTeam.push({
                        id: item.user.id,
                        name: item.user.name,
                        email: item.user.email,
                        is_admin_system: item.user.is_admin_system,
                        role: item.role, // O cargo específico nesta empresa
                        isAdmin: item.role === 'Administrador' || item.role === 'admin'
                    });
                }
            });
        }
        
        setTeam(formattedTeam);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- FUNÇÕES DE MEU PERFIL ---
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        let emailChanged = false;

        // 1. Atualização de Senha
        if (myProfileForm.password) {
            if (myProfileForm.password !== myProfileForm.confirmPassword) {
                throw new Error("As senhas não conferem.");
            }
            if (myProfileForm.password.length < 6) {
                throw new Error("A senha deve ter pelo menos 6 caracteres.");
            }
            const { error: passError } = await supabase.auth.updateUser({ password: myProfileForm.password });
            if (passError) throw passError;
            alert("Senha atualizada com sucesso!");
        }

        // 2. Atualização de E-mail
        if (myProfileForm.email !== user.email) {
            const { error: emailError } = await supabase.auth.updateUser({ email: myProfileForm.email });
            if (emailError) throw emailError;
            emailChanged = true;
        }

        // 3. Atualização de Perfil
        const { error: profileError } = await supabase
            .from('user_profiles')
            .update({ 
                name: myProfileForm.name,
                email: myProfileForm.email
            })
            .eq('id', user.id);

        if (profileError) throw profileError;

        let msg = "Perfil atualizado com sucesso!";
        if (emailChanged) msg += " Verifique seu novo e-mail para confirmar a alteração.";
        
        alert(msg);
        setMyProfileForm(prev => ({ ...prev, password: '', confirmPassword: '' })); // Limpa senhas
        fetchData();

    } catch (error) {
        alert("Erro ao atualizar perfil: " + error.message);
    } finally {
        setIsUpdatingProfile(false);
    }
  };

  // --- FUNÇÕES DE EQUIPE ---
  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email || !newUser.password) return alert("Preencha os campos obrigatórios.");

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
            ...newUser,
            role: newUser.role || (newUser.isAdmin ? 'Administrador' : 'Recrutador') 
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao conectar na API.");

      alert(data.message || "Usuário adicionado com sucesso!");
      setIsAddingUser(false);
      setNewUser({ name: '', email: '', password: '', role: '', isAdmin: false });
      fetchData();
      
    } catch (err) {
      console.error(err);
      alert("Erro ao criar usuário: " + err.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm("Tem certeza? O acesso deste usuário será revogado apenas para ESTA empresa.")) return;
    const { data: { session } } = await supabase.auth.getSession();
    
    try {
        const res = await fetch('/api/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ action: 'deleteUser', userId, tenantId: tenant.id })
        });

        if (res.ok) {
            alert("Acesso revogado com sucesso.");
            fetchData();
        } else {
            const err = await res.json();
            throw new Error(err.error || "Falha na API");
        }
    } catch (e) {
        alert("Erro: " + e.message);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="text-gray-500 font-medium">Carregando configurações...</div></div>;

  return (
    <div className="p-8 max-w-5xl mx-auto font-sans min-h-screen">
      <button onClick={() => navigate('/')} className="flex items-center text-gray-500 mb-6 hover:text-blue-600 transition-colors group">
        <ArrowLeft className="mr-2 group-hover:-translate-x-1 transition-transform" size={20}/> Voltar ao Dashboard
      </button>

      <div className="flex justify-between items-center mb-8">
        <div>
            <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
            <p className="text-gray-500 mt-1">Gerencie seus dados e sua organização</p>
        </div>
        {currentUserProfile?.is_admin_system && (
            <button onClick={() => navigate('/admin/super')} className="text-xs bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition shadow-sm font-medium flex items-center gap-2">
                <Shield size={14} /> Painel Super Admin
            </button>
        )}
      </div>

      <div className="flex gap-8 border-b border-gray-200 mb-8 overflow-x-auto">
        <button 
            onClick={() => setActiveTab('company')} 
            className={`pb-4 px-2 border-b-2 flex items-center gap-2 font-medium transition-all whitespace-nowrap ${activeTab === 'company' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Building size={18}/> Minha Empresa
        </button>
        <button 
            onClick={() => setActiveTab('team')} 
            className={`pb-4 px-2 border-b-2 flex items-center gap-2 font-medium transition-all whitespace-nowrap ${activeTab === 'team' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Users size={18}/> Gestão de Equipe
        </button>
        <button 
            onClick={() => setActiveTab('profile')} 
            className={`pb-4 px-2 border-b-2 flex items-center gap-2 font-medium transition-all whitespace-nowrap ${activeTab === 'profile' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <User size={18}/> Meu Perfil
        </button>
      </div>

      {/* ABA 1: EMPRESA (LEITURA) */}
      {activeTab === 'company' && tenant && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 max-w-3xl animate-in fade-in slide-in-from-left-2 duration-300">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Dados da Organização</h2>
                    <p className="text-sm text-gray-500">Informações do seu ambiente SaaS</p>
                </div>
                <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-100 uppercase tracking-wide">
                    {tenant.planId || 'Plano Básico'}
                </div>
            </div>

            <div className="grid gap-6">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Razão Social</label>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 text-gray-700 font-medium">
                        <Building size={18} className="text-gray-400" />
                        {tenant.companyName}
                        <Lock size={14} className="text-gray-400 ml-auto" title="Campo gerenciado pela Novva"/>
                    </div>
                </div>
                
                <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Identificador do Tenant (ID)</label>
                     <div className="font-mono text-sm bg-slate-100 p-3 rounded-lg text-slate-600 break-all border border-slate-200 select-all">
                         {tenant.id}
                     </div>
                </div>

                <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 mt-2">
                    <div className="flex items-start gap-4">
                        <Shield className="text-blue-600 mt-1 shrink-0" size={24} />
                        <div>
                            <h3 className="font-bold text-blue-900">Gerenciamento do Plano</h3>
                            <p className="text-sm text-blue-700 mt-2 leading-relaxed">
                                Seu plano atual é gerenciado pela equipe da <strong>Novva Desenvolvimento</strong>.
                                Para upgrades, downgrades ou alterações cadastrais (CNPJ), entre em contato com nosso suporte.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* ABA 2: EQUIPE (CRUD) */}
      {activeTab === 'team' && (
        <div className="animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Membros da Equipe</h2>
                    <p className="text-sm text-gray-500">Gerencie quem tem acesso aos dados da {tenant?.companyName}.</p>
                </div>
                {!isAddingUser && (
                    <button onClick={() => setIsAddingUser(true)} className="bg-blue-600 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-sm transition font-medium">
                        <Plus size={18}/> Adicionar Usuário
                    </button>
                )}
            </div>

            {isAddingUser && (
                <div className="bg-white p-6 rounded-xl border border-blue-100 mb-8 shadow-sm ring-4 ring-blue-50">
                    <h3 className="font-bold mb-6 text-gray-900 flex items-center gap-2 pb-4 border-b"><Plus size={18} className="text-blue-600"/> Cadastrar Novo Membro</h3>
                    <form onSubmit={handleAddUser}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">Nome Completo *</label>
                                <input required className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" 
                                    value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">E-mail Corporativo *</label>
                                <input required type="email" className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" 
                                    value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                            </div>
                            {/* NOVO CAMPO: CARGO */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">Cargo / Função</label>
                                <div className="relative">
                                    <Briefcase className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
                                    <input 
                                        className="w-full border border-gray-300 p-2.5 pl-9 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" 
                                        value={newUser.role} 
                                        onChange={e => setNewUser({...newUser, role: e.target.value})} 
                                        placeholder="Ex: Gerente de RH"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">Senha Inicial *</label>
                                <input required type="password" className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" 
                                    value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                            </div>
                            <div className="flex items-center h-full pt-1 md:col-span-2">
                                <label className={`flex items-center gap-3 cursor-pointer p-4 rounded-lg border w-full transition ${newUser.isAdmin ? 'bg-purple-50 border-purple-200 ring-1 ring-purple-200' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                                    <input type="checkbox" className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500" checked={newUser.isAdmin} onChange={e => setNewUser({...newUser, isAdmin: e.target.checked})} />
                                    <div>
                                        <span className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                            {newUser.isAdmin ? <Crown size={16} className="text-purple-600"/> : null} 
                                            Conceder acesso de Administrador?
                                        </span>
                                        <span className="text-xs text-gray-500 block mt-1">Administradores podem gerenciar configurações e remover usuários.</span>
                                    </div>
                                </label>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2 justify-end">
                            <button type="button" onClick={() => setIsAddingUser(false)} className="px-6 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 font-medium text-gray-700 transition">Cancelar</button>
                            <button type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-blue-700 shadow-md transition">Salvar Usuário</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="p-5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Nome</th>
                            <th className="p-5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Email</th>
                            <th className="p-5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Cargo</th>
                            <th className="p-5 font-semibold text-gray-600 text-xs uppercase tracking-wider">Permissão</th>
                            <th className="p-5 font-semibold text-gray-600 text-xs uppercase tracking-wider text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {team.map(user => (
                            <tr key={user.id} className="hover:bg-blue-50/50 transition-colors">
                                <td className="p-5 font-medium text-gray-900">{user.name || 'Sem nome'}</td>
                                <td className="p-5 text-gray-600 text-sm flex items-center gap-2"><Mail size={14} className="text-gray-400"/> {user.email}</td>
                                <td className="p-5 text-slate-700 font-medium text-sm">{user.role}</td>
                                <td className="p-5">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${user.isAdmin || user.role === 'admin' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                        {user.isAdmin || user.role === 'admin' ? 'Admin' : 'Membro'}
                                    </span>
                                </td>
                                <td className="p-5 text-right">
                                    {user.id !== currentUserProfile?.id ? (
                                        <button onClick={() => handleDeleteUser(user.id)} className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-all" title="Remover Usuário">
                                            <Trash2 size={18} />
                                        </button>
                                    ) : (
                                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">VOCÊ</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {team.length === 0 && (
                    <div className="p-12 text-center flex flex-col items-center">
                        <div className="bg-gray-100 p-4 rounded-full mb-3">
                            <AlertCircle className="text-gray-400" size={32} />
                        </div>
                        <p className="text-gray-900 font-medium text-lg">Nenhum membro encontrado</p>
                        <p className="text-sm text-gray-500 mt-1">Adicione usuários para colaborar nesta empresa.</p>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* ABA 3: MEU PERFIL */}
      {activeTab === 'profile' && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 max-w-2xl animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="flex items-center gap-4 mb-8 pb-6 border-b">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-2xl border-4 border-white shadow-sm">
                    {myProfileForm.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Editar Meu Perfil</h2>
                    <p className="text-sm text-gray-500">Mantenha seus dados atualizados.</p>
                </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Nome Completo</label>
                    <input 
                        required 
                        className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                        value={myProfileForm.name}
                        onChange={e => setMyProfileForm({...myProfileForm, name: e.target.value})}
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">E-mail de Acesso</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                        <input 
                            required 
                            type="email"
                            className="w-full border border-gray-300 p-3 pl-10 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                            value={myProfileForm.email}
                            onChange={e => setMyProfileForm({...myProfileForm, email: e.target.value})}
                        />
                    </div>
                    <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                        <AlertCircle size={12}/> Atenção: Alterar o e-mail exigirá confirmação na nova caixa de entrada.
                    </p>
                </div>

                <div className="pt-4 border-t border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2"><Key size={16}/> Alterar Senha</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5">Nova Senha</label>
                            <input 
                                type="password"
                                className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                                placeholder="Min. 6 caracteres"
                                value={myProfileForm.password}
                                onChange={e => setMyProfileForm({...myProfileForm, password: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5">Confirmar Nova Senha</label>
                            <input 
                                type="password"
                                className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                                placeholder="Repita a senha"
                                value={myProfileForm.confirmPassword}
                                onChange={e => setMyProfileForm({...myProfileForm, confirmPassword: e.target.value})}
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <button 
                        type="submit" 
                        disabled={isUpdatingProfile}
                        className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 shadow-lg transition flex items-center gap-2 disabled:opacity-70"
                    >
                        {isUpdatingProfile ? 'Salvando...' : <><Save size={18}/> Salvar Alterações</>}
                    </button>
                </div>
            </form>
        </div>
      )}
    </div>
  );
}