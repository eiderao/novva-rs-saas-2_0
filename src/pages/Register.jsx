import React, { useState } from 'react';
import { supabase } from '../supabase/client';
import { Link, useNavigate } from 'react-router-dom';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      let tenantIdToUse = null;

      // 1. Validação PRÉVIA do Código da Empresa
      if (companyId.trim()) {
        const { data: tenant, error: tError } = await supabase
            .from('tenants')
            .select('id, planId')
            .eq('id', companyId.trim())
            .single();
        
        if (tError || !tenant) {
            setLoading(false);
            return alert("Código da empresa inválido.");
        }

        // Busca o plano usando user_limit
        const { data: plan } = await supabase
            .from('plans')
            .select('user_limit')
            .eq('id', tenant.planId || 'freemium')
            .single();
            
        const limit = plan?.user_limit || 1;
        const isUnlimited = limit === -1;

        // Conta usuários ativos
        const { count } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact', head: true })
            .eq('tenantId', tenant.id)
            .eq('active', true);

        if (!isUnlimited && count >= limit) {
            setLoading(false);
            return alert(`Esta empresa atingiu o limite de ${limit} usuários do plano. Não é possível entrar.`);
        }
        
        tenantIdToUse = tenant.id;
      }

      // 2. Cria usuário Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
      if (authError) throw authError;

      const user = authData.user;
      if (user) {
        if (!tenantIdToUse) {
           // Cria nova empresa (Plano FREEMIUM padrão)
           const { data: newTenant } = await supabase
             .from('tenants')
             .insert({ "companyName": "Minha Nova Empresa", "planId": "freemium" })
             .select()
             .single();
           tenantIdToUse = newTenant?.id;
        }

        // 3. Cria Perfil e Vínculo de Tenant
        if (tenantIdToUse) {
           const role = companyId.trim() ? 'user' : 'admin';

           // A. Cria Perfil (Dados de Exibição e Contexto Atual)
           const { error: profileError } = await supabase.from('user_profiles').upsert({
             id: user.id,
             name: email.split('@')[0],
             "tenantId": tenantIdToUse,
             role: role,
             active: true
           });

           if (profileError) throw profileError;

           [cite_start]// B. Cria Vínculo Many-to-Many (CORREÇÃO AQUI) [cite: 399]
           const { error: linkError } = await supabase.from('user_tenants').insert({
             user_id: user.id,
             tenant_id: tenantIdToUse,
             role: role
           });

           if (linkError) throw linkError;
        }
      }

      alert("Cadastro realizado! Verifique seu email.");
      navigate('/');

    } catch (error) {
      console.error(error);
      alert("Erro: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100">
      <form onSubmit={handleRegister} className="p-8 bg-white rounded shadow-md w-96 border border-gray-200">
        <h1 className="text-2xl font-bold mb-2 text-center text-green-600">Criar Conta</h1>
        <p className="text-center text-gray-500 text-sm mb-6">Novva R&S 2.0</p>
        
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input 
              className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-green-500" 
              placeholder="seu@email.com" 
              value={email} 
              onChange={e => setEmail(e.target.value)}
              required 
            />
        </div>
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha *</label>
            <input 
              className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-green-500" 
              type="password" 
              placeholder="Min. 6 caracteres" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              required 
            />
        </div>
        
        <div className="mb-6 pt-4 border-t">
            <label className="block text-sm font-bold text-gray-700 mb-1">Código de Convite</label>
            <input 
              className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" 
              placeholder="Cole o ID da empresa (Opcional)" 
              value={companyId} 
              onChange={e => setCompanyId(e.target.value)}
            />
        </div>
        
        <button disabled={loading} className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700 transition font-medium">
          {loading ? 'Validando...' : 'Cadastrar'}
        </button>
        <div className="mt-4 text-center text-sm">
          <Link to="/login" className="text-blue-600 hover:underline">Voltar para Login</Link>
        </div>
      </form>
    </div>
  );
}