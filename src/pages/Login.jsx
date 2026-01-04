import React, { useState } from 'react';
import { supabase } from '../supabase/client';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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
      // 1. Login no Supabase Auth
      const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // 2. Verifica quantos Tenants o usuário tem
      const { count, error: countError } = await supabase
        .from('user_tenants')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (countError) {
          console.error("Erro ao verificar tenants:", countError);
          // Fallback: se der erro, tenta ir pro dashboard direto
          navigate('/'); 
          return;
      }

      // 3. Redirecionamento Inteligente
      if (count > 1) {
          // Se tiver mais de uma empresa, vai para a seleção
          navigate('/select-company');
      } else {
          // Se tiver 0 ou 1, vai direto para o Dashboard (o sistema assume a única ou cria nova no fluxo de registro)
          navigate('/');
      }

    } catch (error) {
      setError('E-mail ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-sm border">
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
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                required
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

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Entrar'}
          </Button>

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