import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import AreaSelect from '../AreaSelect';
import { AlertTriangle, Copy, Info } from 'lucide-react';

export default function CreateJobModal({ open, onClose, onSuccess }) {
  const [tenantId, setTenantId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [limitError, setLimitError] = useState(null);
  const [previousJobs, setPreviousJobs] = useState([]);
  const [copyFromId, setCopyFromId] = useState('');

  // Estado do formulário completo
  const [formData, setFormData] = useState({
    title: '', 
    description: '', 
    requirements: '', 
    type: 'CLT', 
    location_type: 'Híbrido', 
    company_department_id: ''
  });

  // Critérios Padrão para quando não se copia de ninguém
  const DEFAULT_CRITERIA = {
    "notas": [
      { "id": "1", "nome": "Abaixo", "valor": 0 },
      { "id": "2", "nome": "Atende", "valor": 5 },
      { "id": "3", "nome": "Supera", "valor": 10 }
    ],
    "cultura": [
      { "name": "Alinhamento com Valores", "weight": "100" }
    ],
    "tecnico": [
      { "name": "Conhecimento Específico", "weight": "100" }
    ],
    "triagem": [
      { "name": "Requisitos Básicos", "weight": "100" }
    ]
  };

  useEffect(() => {
    if (open) initialize();
  }, [open]);

  const initialize = async () => {
    setLimitError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from('user_profiles').select('tenantId').eq('id', user.id).single();
    if (!profile?.tenantId) return;
    setTenantId(profile.tenantId);

    // Verificação de Limites do Plano
    const { data: tenant } = await supabase.from('tenants').select('planId, plans(job_limit)').eq('id', profile.tenantId).single();
    const limit = tenant?.plans?.job_limit || 1; // Padrão 1 se der erro
    const isUnlimited = limit === -1;

    const { count } = await supabase.from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('tenantId', profile.tenantId)
      .eq('status', 'active');

    if (!isUnlimited && count >= limit) {
        setLimitError(`Você atingiu o limite de ${limit} vagas ativas do seu plano.`);
    }

    // Carregar vagas anteriores para o dropdown de cópia
    const { data: jobs } = await supabase.from('jobs')
      .select('id, title')
      .eq('tenantId', profile.tenantId)
      .order('created_at', { ascending: false });
    
    setPreviousJobs(jobs || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (limitError) return;
    
    setLoading(true);
    
    // Define os parâmetros (critérios)
    let parameters = {};
    if (copyFromId === 'EXAMPLE_TEMPLATE') {
        parameters = DEFAULT_CRITERIA;
    } else if (copyFromId) {
        const { data } = await supabase.from('jobs').select('parameters').eq('id', copyFromId).single();
        if (data?.parameters) parameters = data.parameters;
    } else {
        parameters = { triagem: [], cultura: [], tecnico: [], notas: [] };
    }

    try {
        // 1. Cria a Vaga
        const { data: newJob, error } = await supabase.from('jobs').insert({
          ...formData,
          tenantId: tenantId,
          status: 'active', // Vaga nasce ativa
          company_department_id: formData.company_department_id ? parseInt(formData.company_department_id) : null,
          parameters: parameters
        }).select().single();

        if (error) throw error;

        // ---------------------------------------------------------
        // --- INÍCIO DA LÓGICA DO CANDIDATO IDEAL (NOVO) ---
        // ---------------------------------------------------------
        
        // Gera um email único de sistema para identificar este benchmarking
        const benchmarkEmail = `ideal_${newJob.id}@novva.benchmark`;

        // Verifica/Cria o Candidato na tabela candidates
        // (Usamos upsert ou check para evitar duplicidade se rodar 2x)
        let { data: idealCandidate } = await supabase.from('candidates').select('id').eq('email', benchmarkEmail).single();

        if (!idealCandidate) {
            const { data: createdCand, error: candError } = await supabase.from('candidates').insert({
                name: 'PERFIL IDEAL (Benchmarking)',
                email: benchmarkEmail,
                phone: '0000000000',
                linkedin: 'https://novva.system/benchmark',
                notes: 'Este perfil serve como régua de comparação para os demais candidatos.'
            }).select().single();
            
            if (!candError) idealCandidate = createdCand;
        }

        // Cria a aplicação (vínculo) imediatamente
        if (idealCandidate) {
            await supabase.from('applications').insert({
                jobId: newJob.id,
                candidateId: idealCandidate.id,
                status: 'Triagem' // Entra na lista visível
            });
        }
        // ---------------------------------------------------------
        // --- FIM DA LÓGICA DO CANDIDATO IDEAL ---
        // ---------------------------------------------------------

        // Limpa form
        setFormData({ 
            title: '', description: '', requirements: '', 
            type: 'CLT', location_type: 'Híbrido', company_department_id: '' 
        });
        setCopyFromId('');
        
        onSuccess(); // Atualiza a lista pai
        onClose();   // Fecha modal

    } catch (err) {
        alert('Erro ao criar vaga: ' + err.message);
    } finally {
        setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 transition-opacity">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto transform transition-all">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
          <h2 className="text-xl font-bold text-gray-800">Nova Vaga</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1 rounded-full hover:bg-gray-200">
            ✕
          </button>
        </div>
        
        {limitError ? (
            <div className="p-8 text-center">
                <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200 mb-6 flex items-start gap-3 text-left shadow-sm">
                    <AlertTriangle className="w-6 h-6 shrink-0 mt-1" />
                    <div>
                        <p className="font-bold text-lg">Limite Atingido</p>
                        <p className="text-sm mt-1 leading-relaxed">{limitError}</p>
                        <p className="text-xs mt-2 text-red-500">Contate o administrador para upgrade.</p>
                    </div>
                </div>
                <button onClick={onClose} className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition w-full">
                    Entendido, fechar
                </button>
            </div>
        ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
            
            {/* Seção de Copiar Modelo */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-2">
                <label className="block text-xs font-bold text-blue-800 mb-2 flex items-center gap-2 uppercase tracking-wide">
                    <Copy size={14}/> Copiar Critérios de:
                </label>
                <div className="relative">
                    <select 
                        className="w-full border border-blue-200 p-2.5 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none text-gray-700"
                        value={copyFromId}
                        onChange={e => setCopyFromId(e.target.value)}
                    >
                        <option value="">-- Começar com critérios vazios --</option>
                        <option value="EXAMPLE_TEMPLATE" className="font-bold text-blue-600">★ Vaga Modelo (Recomendado)</option>
                        {previousJobs.length > 0 && (
                            <optgroup label="Suas Vagas Anteriores">
                                {previousJobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                            </optgroup>
                        )}
                    </select>
                    <Info className="absolute right-3 top-3 text-blue-300 pointer-events-none" size={16}/>
                </div>
            </div>

            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Título da Vaga <span className="text-red-500">*</span></label>
                <input 
                    required 
                    className="w-full border border-gray-300 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" 
                    placeholder="Ex: Analista de Marketing Pleno"
                    value={formData.title} 
                    onChange={e => setFormData({...formData, title: e.target.value})} 
                />
            </div>
            
            {/* Seletor de Departamento (Componente Externo) */}
            {tenantId && (
                <div className="pt-1">
                    <AreaSelect 
                        tenantId={tenantId} 
                        value={formData.company_department_id} 
                        onChange={val => setFormData({...formData, company_department_id: val})} 
                    />
                </div>
            )}
            
            <div className="grid grid-cols-2 gap-5">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Modelo de Trabalho</label>
                    <div className="relative">
                        <select 
                            className="w-full border border-gray-300 p-2.5 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none" 
                            value={formData.location_type} 
                            onChange={e => setFormData({...formData, location_type: e.target.value})}
                        >
                            <option>Presencial</option>
                            <option>Híbrido</option>
                            <option>Remoto</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Tipo de Contrato</label>
                    <div className="relative">
                        <select 
                            className="w-full border border-gray-300 p-2.5 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none" 
                            value={formData.type} 
                            onChange={e => setFormData({...formData, type: e.target.value})}
                        >
                            <option>CLT</option>
                            <option>PJ</option>
                            <option>Estágio</option>
                            <option>Temporário</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Descrição da Vaga</label>
                <textarea 
                    className="w-full border border-gray-300 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]" 
                    rows="3" 
                    placeholder="Breve resumo das responsabilidades..."
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})} 
                />
            </div>
            
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Requisitos Obrigatórios</label>
                <textarea 
                    className="w-full border border-gray-300 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]" 
                    rows="3" 
                    placeholder="Liste o que é essencial..."
                    value={formData.requirements} 
                    onChange={e => setFormData({...formData, requirements: e.target.value})} 
                />
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                <button 
                    type="button" 
                    onClick={onClose} 
                    className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition"
                >
                    Cancelar
                </button>
                <button 
                    type="submit" 
                    disabled={loading} 
                    className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition transform active:scale-95"
                >
                    {loading ? 'Criando Vaga...' : 'Criar Vaga'}
                </button>
            </div>
            </form>
        )}
      </div>
    </div>
  );
}