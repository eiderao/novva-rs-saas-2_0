import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import AreaSelect from '../AreaSelect';
import { AlertTriangle, Copy } from 'lucide-react';

export default function CreateJobModal({ open, onClose, onSuccess }) {
  const [tenantId, setTenantId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [limitError, setLimitError] = useState(null);
  const [previousJobs, setPreviousJobs] = useState([]); // Lista de vagas para cópia
  const [copyFromId, setCopyFromId] = useState(''); // ID da vaga selecionada para cópia

  const [formData, setFormData] = useState({
    title: '', description: '', requirements: '', type: 'CLT', location_type: 'Híbrido', company_department_id: ''
  });

  useEffect(() => {
    if (open) {
      initialize();
    }
  }, [open]);

  const initialize = async () => {
    setLimitError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Pega Tenant
    const { data: profile } = await supabase.from('user_profiles').select('tenantId').eq('id', user.id).single();
    if (!profile?.tenantId) return;
    setTenantId(profile.tenantId);

    // 2. Verifica Limites
    const { data: tenant } = await supabase.from('tenants').select('planId').eq('id', profile.tenantId).single();
    const { data: plan } = await supabase.from('plans').select('job_limit').eq('id', tenant.planId || 'freemium').single();
    
    const limit = plan?.job_limit || 2;
    const isUnlimited = limit === -1;

    const { count } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('tenantId', profile.tenantId)
        .eq('status', 'active');

    if (!isUnlimited && count >= limit) {
        setLimitError(`Limite de vagas ativas atingido (${limit}).`);
    }

    // 3. Busca vagas anteriores para permitir cópia de critérios
    const { data: jobs } = await supabase
        .from('jobs')
        .select('id, title')
        .eq('tenantId', profile.tenantId)
        .order('created_at', { ascending: false });
    setPreviousJobs(jobs || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (limitError) return;
    
    setLoading(true);
    
    let parameters = {}; // Padrão vazio

    // Se escolheu copiar, busca os parâmetros da vaga origem
    if (copyFromId) {
        const { data } = await supabase.from('jobs').select('parameters').eq('id', copyFromId).single();
        if (data?.parameters) {
            parameters = data.parameters;
        }
    } else {
        // Parâmetros Default
        parameters = {
            triagem: [], cultura: [], tecnico: [],
            notas: [{id:'1',nome:'Abaixo',valor:0}, {id:'2',nome:'Atende',valor:50}, {id:'3',nome:'Supera',valor:100}]
        };
    }

    const payload = {
      ...formData,
      tenantId: tenantId,
      status: 'active',
      company_department_id: formData.company_department_id ? parseInt(formData.company_department_id) : null,
      parameters: parameters // Salva os critérios copiados ou padrão
    };

    const { error } = await supabase.from('jobs').insert(payload);

    if (error) alert('Erro: ' + error.message);
    else {
      setFormData({ title: '', description: '', requirements: '', type: 'CLT', location_type: 'Híbrido', company_department_id: '' });
      setCopyFromId('');
      onSuccess();
      onClose();
    }
    setLoading(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">Nova Vaga</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        
        {limitError ? (
            <div className="p-6 text-center">
                <div className="bg-red-50 text-red-700 p-4 rounded border border-red-200 mb-4 flex items-start gap-3 text-left">
                    <AlertTriangle className="w-6 h-6 shrink-0" />
                    <div>
                        <p className="font-bold">Limite Atingido</p>
                        <p className="text-sm mt-1">{limitError}</p>
                    </div>
                </div>
                <button onClick={onClose} className="bg-gray-200 px-4 py-2 rounded">Fechar</button>
            </div>
        ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
            
            {/* Seletor de Cópia - NOVIDADE */}
            {previousJobs.length > 0 && (
                <div className="bg-blue-50 p-3 rounded border border-blue-100 mb-4">
                    <label className="block text-xs font-bold text-blue-800 mb-1 flex items-center gap-1">
                        <Copy size={12}/> Copiar critérios de avaliação de:
                    </label>
                    <select 
                        className="w-full border p-2 rounded text-sm bg-white"
                        value={copyFromId}
                        onChange={e => setCopyFromId(e.target.value)}
                    >
                        <option value="">-- Começar do Zero --</option>
                        {previousJobs.map(j => (
                            <option key={j.id} value={j.id}>{j.title}</option>
                        ))}
                    </select>
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título da Vaga *</label>
                <input required className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            </div>

            {tenantId && <AreaSelect tenantId={tenantId} value={formData.company_department_id} onChange={val => setFormData({...formData, company_department_id: val})} />}

            <div className="grid grid-cols-2 gap-4">
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
                <select className="w-full border p-2 rounded bg-white" value={formData.location_type} onChange={e => setFormData({...formData, location_type: e.target.value})}>
                    <option>Presencial</option><option>Híbrido</option><option>Remoto</option>
                </select>
                </div>
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contrato</label>
                <select className="w-full border p-2 rounded bg-white" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                    <option>CLT</option><option>PJ</option><option>Estágio</option>
                </select>
                </div>
            </div>

            <div><label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label><textarea className="w-full border p-2 rounded outline-none" rows="3" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Requisitos</label><textarea className="w-full border p-2 rounded outline-none" rows="3" value={formData.requirements} onChange={e => setFormData({...formData, requirements: e.target.value})} /></div>

            <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded">Cancelar</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{loading ? 'Criando...' : 'Criar Vaga'}</button>
            </div>
            </form>
        )}
      </div>
    </div>
  );
}