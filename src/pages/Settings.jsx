import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { Building, Users, Save, Shield, CheckCircle, XCircle, Trash2, ArrowLeft } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('company');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [tenant, setTenant] = useState({ name: '', planId: '', planName: 'Carregando...', userLimit: 1 });
  const [team, setTeam] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Tenta buscar usuário
      const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();
      
      if (!userData) {
          // Se não achar o usuário, não trava a tela, apenas avisa no console
          console.warn("Usuário não encontrado na tabela 'public.users'. Verifique o SQL.");
          setLoading(false);
          return;
      }

      setCurrentUser(userData);

      if (userData.tenantId) {
        const { data: tenantData } = await supabase.from('tenants').select('companyName, planId').eq('id', userData.tenantId).maybeSingle();
        
        if (tenantData) {
            let planInfo = { name: 'Desconhecido', limit: 1 };
            if (tenantData.planId) {
                const { data: plan } = await supabase.from('plans').select('name, user_limit').eq('id', tenantData.planId).maybeSingle();
                if(plan) planInfo = { name: plan.name, limit: plan.user_limit };
            }
            setTenant({ name: tenantData.companyName, planId: tenantData.planId, planName: planInfo.name, userLimit: planInfo.limit });
        }

        if (userData.isAdmin) {
            const { data: teamData } = await supabase.from('users').select('*').eq('tenantId', userData.tenantId).order('email');
            setTeam(teamData || []);
        }
      }
    } catch (error) {
      console.error("Erro silencioso:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-10 text-center">Carregando...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <button onClick={() => navigate('/')} className="flex items-center text-gray-500 mb-6"><ArrowLeft className="mr-2"/> Voltar</button>
      <h1 className="text-3xl font-bold mb-6">Configurações</h1>
      <div className="flex gap-6 border-b mb-6">
        <button onClick={() => setActiveTab('company')} className={`pb-3 px-1 border-b-2 ${activeTab === 'company' ? 'border-blue-600 text-blue-600' : 'border-transparent'}`}><Building className="inline mr-2"/> Minha Empresa</button>
        <button onClick={() => setActiveTab('team')} className={`pb-3 px-1 border-b-2 ${activeTab === 'team' ? 'border-blue-600 text-blue-600' : 'border-transparent'}`}><Users className="inline mr-2"/> Equipe</button>
      </div>
      
      {activeTab === 'company' && (
        <div className="bg-white p-6 rounded shadow border max-w-2xl">
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Empresa</label>
                <input className="w-full border p-2 rounded" value={tenant.name} disabled />
            </div>
            <div className="bg-blue-50 p-4 rounded border border-blue-100">
                <p className="text-sm text-blue-900"><strong>Plano:</strong> {tenant.planName}</p>
            </div>
        </div>
      )}

      {activeTab === 'team' && (
        <div>
            {!currentUser?.isAdmin ? <p className="text-red-500">Acesso restrito.</p> : (
                <div className="bg-white rounded shadow border">
                    <table className="w-full text-left">
                        <thead><tr className="border-b bg-gray-50"><th className="p-4">Nome</th><th className="p-4">Email</th></tr></thead>
                        <tbody>
                            {team.map(u => <tr key={u.id} className="border-b"><td className="p-4">{u.name}</td><td className="p-4">{u.email}</td></tr>)}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
      )}
    </div>
  );
}