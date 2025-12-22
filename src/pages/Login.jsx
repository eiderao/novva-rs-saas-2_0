import React, { useState } from 'react';
import { supabase } from '../supabase/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    setLoading(false);
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100">
      <form onSubmit={handleLogin} className="p-8 bg-white rounded shadow-md w-96 border border-gray-200">
        <h1 className="text-2xl font-bold mb-6 text-center text-blue-600">Novva R&S 2.0</h1>
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
              placeholder="seu@email.com" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
            />
        </div>
        <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input 
              className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
              type="password" 
              placeholder="********" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
            />
        </div>
        <button disabled={loading} className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition">
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}