import React, { useState } from 'react';
import { supabase } from '../supabase/client';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, UserPlus, CheckCircle } from 'lucide-react';

export default function Register() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', companyId: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Prepara metadados para a Trigger do Banco
      const metaData = {
          name: formData.name,
      };

      // Se tiver código de convite, adiciona ao metadata
      // A trigger vai ler isso e colocar o usuário na empresa certa
      if (formData.companyId.trim()) {
          // Validação rápida se o tenant existe (opcional, mas boa prática)
          const { data: tenant, error: tError } = await supabase
              .from('tenants')
              .select('id')
              .eq('id', formData.companyId.trim())
              .single();
          
          if (tError || !tenant) throw new Error("Código da empresa inválido.");
          
          metaData.tenant_id = tenant.id;
          metaData.role = 'recruiter'; // Entra como recrutador por padrão via convite simples
      }

      // O CADASTRO SIMPLIFICADO
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
            data: metaData // Envia nome e possível tenant_id
        }
      });

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);

    } catch (error) {
      alert("Erro: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
      return (
        <div className="flex h-screen items-center justify-center bg-gray-50 px-4">
             <div className="text-center bg-white p-8 rounded shadow-lg">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4"/>
                <h2 className="text-2xl font-bold text-gray-800">Cadastro Realizado!</h2>
                <p className="text-gray-600 mt-2">Sua conta e empresa foram configuradas.</p>
                <p className="text-sm text-gray-400 mt-4">Redirecionando para login...</p>
             </div>
        </div>
      );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100 px-4">
      <form onSubmit={handleRegister} className="p-8 bg-white rounded shadow-md w-96 border border-gray-200 space-y-5">
        <div className="text-center">
             <div className="mx-auto h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600 mb-4">
                <UserPlus size={24} />
             </div>
            <h1 className="text-2xl font-bold mb-2 text-center text-green-600">Criar Conta</h1>
            <p className="text-center text-gray-500 text-sm">Crie sua empresa Freemium ou entre em uma existente.</p>
        </div>
        
        <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Nome Completo *</label>
            <input className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-green-500" 
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
        </div>

        <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Email *</label>
            <input className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-green-500" 
              value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
        </div>

        <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Senha *</label>
            <input type="password" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-green-500" 
              placeholder="Min. 6 caracteres" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
        </div>
        
        <div className="pt-2 border-t">
            <label className="block text-xs font-bold text-gray-500 mb-1">Código de Convite (Opcional)</label>
            <input className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" 
              placeholder="ID da empresa" value={formData.companyId} onChange={e => setFormData({...formData, companyId: e.target.value})} />
        </div>
        
        <button disabled={loading} className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700 transition font-medium flex justify-center items-center">
          {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : 'Criar Conta'}
        </button>
        <div className="mt-4 text-center text-sm">
          <Link to="/login" className="text-blue-600 hover:underline">Já tenho conta</Link>
        </div>
      </form>
    </div>
  );
}