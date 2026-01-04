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

      // Busca as empresas vinculadas a este usuário
      const { data, error } = await supabase
        .from('user_tenants')
        .select(`
            tenant_id,
            role,
            tenant:tenants ( id, "companyName", "planId" )
        `)
        .eq('user_id', user.id);

      if (error) {
        console.error('Erro ao buscar empresas:', error);
      } else {
        // Se só tiver uma, seleciona automaticamente (segurança extra caso acessem a rota direto)
        if (data.length === 1) {
            handleSelect(data[0].tenant);
        } else {
            setTenants(data.map(d => ({ ...d.tenant, role: d.role })));
        }
      }
      setLoading(false);
    };

    fetchUserTenants();
  }, []);

  const handleSelect = async (tenant) => {
    setSwitching(tenant.id);
    const { data: { user } } = await supabase.auth.getUser();

    // A MÁGICA: Atualiza o user_profiles com o tenantId escolhido.
    // Isso faz com que todo o resto do sistema (Dashboard, Vagas) carregue os dados dessa empresa.
    const { error } = await supabase
        .from('user_profiles')
        .update({ "tenantId": tenant.id }) // Aspas importantes se a coluna for camelCase no banco
        .eq('id', user.id);

    if (error) {
        alert("Erro ao trocar de empresa: " + error.message);
        setSwitching(null);
    } else {
        navigate('/'); // Vai para o Dashboard com o contexto novo
    }
  };

  const handleLogout = async () => {
      await supabase.auth.signOut();
      navigate('/login');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-blue-600"/></div>;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Selecione a Empresa</h1>
            <p className="text-gray-500 mt-2">Você tem acesso a {tenants.length} organizações. Onde deseja atuar agora?</p>
        </div>

        <div className="space-y-4">
            {tenants.map((t) => (
                <button
                    key={t.id}
                    onClick={() => handleSelect(t)}
                    disabled={switching}
                    className="w-full bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-blue-500 hover:shadow-md transition-all flex items-center justify-between group text-left"
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-100 p-3 rounded-full text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <Building size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 text-lg">{t.companyName}</h3>
                            <span className="text-xs uppercase font-semibold text-gray-400 tracking-wider">{t.planId || 'Standard'}</span>
                        </div>
                    </div>
                    {switching === t.id ? <Loader2 className="animate-spin text-blue-600"/> : <ArrowRight className="text-gray-300 group-hover:text-blue-600"/>}
                </button>
            ))}
        </div>

        <div className="mt-8 text-center">
            <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 text-sm flex items-center justify-center gap-2 w-full">
                <LogOut size={16}/> Sair da conta
            </button>
        </div>
      </div>
    </div>
  );
}