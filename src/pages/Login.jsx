import React, { useState } from 'react';
import { supabase } from '../supabase/client';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, LayoutDashboard } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Autenticação no Supabase
      const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // 2. Verifica a quantidade de empresas vinculadas (Lógica de Consultoria)
      const { count, error: countError } = await supabase
        .from('user_tenants')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (countError) {
          console.warn("Erro ao verificar user_tenants. Redirecionando para padrão.", countError);
          navigate('/'); // Fallback de segurança
          return;
      }

      // 3. Roteamento Inteligente
      if (count > 1) {
          // Consultora (Emília) ou Dono de várias empresas -> Tela de Seleção
          navigate('/select-company');
      } else {
          // Usuário comum (1 empresa) -> Dashboard direto
          // Garantimos que o profile esteja com o tenantId correto (caso tenha apenas 1)
          if (count === 1) {
              const { data: link } = await supabase.from('user_tenants').select('tenant_id').eq('user_id', user.id).single();
              if (link) {
                  await supabase.from('user_profiles').update({ tenantId: link.tenant_id }).eq('id', user.id);
              }
          }
          navigate('/');
      }

    } catch (error) {
      console.error(error);
      setError('E-mail ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-sm border border-gray-200">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-4">
            <LayoutDashboard size={24} />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900">Novva R&S</h2>
          <p className="mt-2 text-sm text-gray-600">Acesse sua conta</p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                required
                className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none border-gray-300"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">Senha</label>
              <input
                id="password"
                type="password"
                required
                className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none border-gray-300"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition flex justify-center items-center font-medium disabled:opacity-70"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Entrar'}
          </button>

          <div className="text-center text-sm">
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
              Criar conta gratuita
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}