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
      // 1. Cria usuário Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      const user = authData.user;
      if (user) {
        let tenantIdToUse = null;

        // 2. Lógica de Empresa
        if (companyId.trim()) {
          // A. Entrar em empresa existente
          const { data: existingTenant, error: tError } = await supabase
            .from('tenants')
            .select('id')
            .eq('id', companyId.trim())
            .single();
          
          if (tError || !existingTenant) {
            alert("ID da empresa inválido. Criaremos uma nova para você.");
            // Fallback: cria nova (será tratada no passo B)
          } else {
            tenantIdToUse = existingTenant.id;
          }
        }

        if (!tenantIdToUse) {
           // B. Criar nova empresa
           const { data: newTenant } = await supabase
             .from('tenants')
             .insert({ "companyName": "Minha Nova Empresa" })
             .select()
             .single();
           tenantIdToUse = newTenant?.id;
        }

        // 3. Cria Perfil vinculado
        if (tenantIdToUse) {
           await supabase.from('user_profiles').upsert({
             id: user.id,
             name: email.split('@')[0],
             "tenantId": tenantIdToUse,
             role: companyId.trim() ? 'user' : 'admin' // Se entrou com código, é user. Se criou, é admin.
           });
        }
      }

      alert("Cadastro realizado com sucesso!");
      navigate('/');

    } catch (error) {
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
            <label className="block text-sm font-bold text-gray-700 mb-1">Tem um Código de Convite?</label>
            <input 
              className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" 
              placeholder="Cole o ID da empresa aqui (Opcional)" 
              value={companyId} 
              onChange={e => setCompanyId(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">Deixe em branco para criar uma nova empresa.</p>
        </div>
        
        <button disabled={loading} className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700 transition font-medium">
          {loading ? 'Processando...' : 'Cadastrar e Entrar'}
        </button>

        <div className="mt-4 text-center text-sm">
          <Link to="/login" className="text-blue-600 hover:underline">Voltar para Login</Link>
        </div>
      </form>
    </div>
  );
}