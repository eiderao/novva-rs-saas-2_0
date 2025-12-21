import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Verificação inicial para ver se as chaves carregaram
  useEffect(() => {
    console.log("URL do Supabase:", import.meta.env.VITE_SUPABASE_URL);
    if (!import.meta.env.VITE_SUPABASE_URL) {
      alert("ERRO CRÍTICO: A URL do Supabase não foi encontrada. Verifique as Variáveis de Ambiente na Vercel!");
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Tentativa de Login
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // 2. Se o Supabase retornou erro (Senha errada, Email não confirmado, etc)
      if (error) {
        alert(`ERRO DO SUPABASE: ${error.message}`);
        throw error;
      }

      // 3. Se chegou aqui, o login foi aceito. Verificamos a sessão.
      if (data?.user) {
        alert("LOGIN SUCESSO! O usuário foi autenticado. Redirecionando para /dashboard...");
        navigate('/dashboard');
      } else {
        alert("ALERTA: Login pareceu funcionar, mas nenhum usuário foi retornado.");
      }
      
    } catch (error) {
      console.error('Erro detalhado:', error);
      // O alert já foi disparado acima no bloco 'if (error)'
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white p-8 rounded shadow space-y-6">
        <h2 className="text-center text-3xl font-extrabold text-gray-900">
          Acesso Recrutador
        </h2>
        
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <input
                type="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <input
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Processando...' : 'Entrar'}
            </button>
          </div>
        </form>

        <div className="text-center">
          <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
            Criar conta
          </Link>
        </div>
      </div>
    </div>
  );
}