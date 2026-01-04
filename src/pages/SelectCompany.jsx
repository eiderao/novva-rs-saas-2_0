import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { Building, ArrowRight, LogOut, Loader2 } from 'lucide-react';

export default function SelectCompany() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(null);

  useEffect(() => {
    const fetchUserTenants = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate('/login');

      // Busca empresas na tabela de ligação
      const { data, error } = await supabase
        .from('user_tenants')
        .select(`
            tenant_id,
            role,
            tenant:tenants ( id, companyName, planId )
        `)
        .eq('user_id', user.id);

      if (error) {
        console.error('Erro ao buscar empresas:', error);
      } else {
        // Mapeia para um formato limpo
        const formatted = data.map(d => ({
            id: d.tenant.id,
            companyName: d.tenant.companyName,
            planId: d.tenant.planId,
            role: d.role
        }));
        setTenants(formatted);
      }
      setLoading(false);
    };

    fetchUserTenants();
  }, []);

  const handleSelect = async (tenant) => {
    setSwitching(tenant.id);
    const { data: { user } } = await supabase.auth.getUser();

    // --- CONTEXT SWITCHING ---
    // Atualiza o perfil principal para refletir a empresa escolhida.
    // Assim, todas as outras telas (Dashboard, Vagas) carregarão dados desta empresa.
    const { error } = await supabase
        .from('user_profiles')
        .update({ 
            tenantId: tenant.id,
            role: tenant.role // Atualiza também o cargo para o contexto atual
        }) 
        .eq('id', user.id);

    if (error) {
        alert("Erro ao entrar na empresa: " + error.message);
        setSwitching(null);
    } else {
        navigate('/');
    }
  };

  const handleLogout = async () => {
      await supabase.auth.signOut();
      navigate('/login');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-blue-600"/></div>;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Selecionar Empresa</h1>
            <p className="text-gray-500 mt-2">Você tem acesso a {tenants.length} organizações. Onde deseja atuar agora?</p>
        </div>

        <div className="space-y-4">
            {tenants.map((t) => (
                <button
                    key={t.id}
                    onClick={() => handleSelect(t)}
                    disabled={switching}
                    className="w-full bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-blue-500 hover:shadow-md transition-all flex items-center justify-between group text-left relative overflow-hidden"
                >
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="bg-blue-50 p-3 rounded-full text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <Building size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 text-lg group-hover:text-blue-700 transition-colors">{t.companyName}</h3>
                            <div className="flex items-center gap-2">
                                <span className="text-xs uppercase font-bold text-gray-400 tracking-wider border px-1.5 rounded">{t.planId || 'Standard'}</span>
                                <span className="text-xs text-gray-500 capitalize">• {t.role}</span>
                            </div>
                        </div>
                    </div>
                    {switching === t.id ? <Loader2 className="animate-spin text-blue-600"/> : <ArrowRight className="text-gray-300 group-hover:text-blue-600 transition-colors"/>}
                </button>
            ))}
        </div>

        <div className="mt-8 text-center">
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-600 text-sm flex items-center justify-center gap-2 w-full transition-colors">
                <LogOut size={16}/> Sair da conta
            </button>
        </div>
      </div>
    </div>
  );
}