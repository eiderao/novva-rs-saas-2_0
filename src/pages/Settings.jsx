import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Users, Building, Shield } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Perfil
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setProfile(userProfile);

      if (userProfile?.tenantId) {
        // 2. Empresa
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', userProfile.tenantId)
          .single();
        setTenant(tenantData);

        // 3. Equipe
        const { data: teamData } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('tenantId', userProfile.tenantId);
        setTeam(teamData || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (tenant?.id) {
      navigator.clipboard.writeText(tenant.id);
      alert("ID da empresa copiado! Envie para sua equipe se cadastrar.");
    }
  };

  if (loading) return <div className="p-10 text-center">Carregando...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto bg-gray-50 min-h-screen">
      <button onClick={() => navigate('/')} className="flex items-center text-gray-500 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4 mr-2"/> Voltar para Dashboard
      </button>

      <h1 className="text-3xl font-bold text-gray-900 mb-8">Configurações</h1>

      {/* Cartão da Empresa */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 text-blue-600 rounded">
            <Building size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">{tenant?.companyName || 'Minha Empresa'}</h2>
            <p className="text-sm text-gray-500">Plano Basic</p>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded border flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-500 uppercase font-bold">ID da Empresa (Código de Convite)</p>
            <p className="font-mono text-gray-800 mt-1">{tenant?.id}</p>
          </div>
          <button 
            onClick={copyToClipboard}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm"
          >
            <Copy size={16} /> Copiar
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Compartilhe este código com novos usuários para que eles entrem diretamente na sua empresa ao se cadastrarem.
        </p>
      </div>

      {/* Lista da Equipe */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-gray-600"/>
            <h3 className="font-bold text-gray-700">Membros da Equipe ({team.length})</h3>
          </div>
        </div>
        
        <table className="w-full text-left text-sm">
          <thead className="border-b text-gray-500">
            <tr>
              <th className="p-4">Nome / Email</th>
              <th className="p-4">Função</th>
              <th className="p-4">Entrou em</th>
            </tr>
          </thead>
          <tbody>
            {team.map(member => (
              <tr key={member.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="p-4">
                  <p className="font-medium text-gray-900">{member.name || 'Usuário'}</p>
                  <p className="text-xs text-gray-500">{member.id}</p>
                </td>
                <td className="p-4">
                  <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold w-fit ${member.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                    {member.role === 'admin' && <Shield size={12}/>}
                    {member.role === 'admin' ? 'Admin' : 'Avaliador'}
                  </span>
                </td>
                <td className="p-4 text-gray-500">
                  {new Date(member.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}