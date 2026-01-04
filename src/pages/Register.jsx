import React, { useState } from 'react';
import { supabase } from '../supabase/client';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, UserPlus } from 'lucide-react';

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

        // 3. Cria Perfil
        if (tenantIdToUse) {
           await supabase.from('user_profiles').upsert({
             id: user.id,
             name: email.split('@')[0],
             "tenantId": tenantIdToUse,
             role: companyId.trim() ? 'recruiter' : 'admin',
             active: true
           });
           
           // 4. (NOVO) Vincula na tabela many-to-many user_tenants
           await supabase.from('user_tenants').insert({
               user_id: user.id,
               tenant_id: tenantIdToUse,
               role: companyId.trim() ? 'recruiter' : 'admin'
           });
        }
      }

      alert("Cadastro realizado!");
      navigate('/');

    } catch (error) {
      alert("Erro: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100 px-4">
      <form onSubmit={handleRegister} className="p-8 bg-white rounded shadow-md w-96 border border-gray-200 space-y-6">
        <div className="text-center">
             <div className="mx-auto h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600 mb-4">
                <UserPlus size={24} />
             </div>
            <h1 className="text-2xl font-bold mb-2 text-center text-green-600">Criar Conta</h1>
            <p className="text-center text-gray-500 text-sm mb-6">Novva R&S 2.0</p>
        </div>
        
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input 
                  className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-green-500 border-gray-300" 
                  placeholder="seu@email.com" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)}
                  required 
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha *</label>
                <input 
                  className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-green-500 border-gray-300" 
                  type="password" 
                  placeholder="Min. 6 caracteres" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)}
                  required 
                />
            </div>
            
            <div className="pt-2 border-t">
                <label className="block text-sm font-bold text-gray-700 mb-1">Código de Convite</label>
                <input 
                  className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 border-gray-300" 
                  placeholder="Cole o ID da empresa (Opcional)" 
                  value={companyId} 
                  onChange={e => setCompanyId(e.target.value)}
                />
            </div>
        </div>
        
        <button disabled={loading} className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700 transition font-medium flex justify-center items-center">
          {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : 'Cadastrar'}
        </button>
        <div className="mt-4 text-center text-sm">
          <Link to="/login" className="text-blue-600 hover:underline">Voltar para Login</Link>
        </div>
      </form>
    </div>
  );
}