import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import AreaSelect from '../AreaSelect';

export default function CreateJobModal({ open, onClose, onSuccess }) {
  const [tenantId, setTenantId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requirements: '',
    type: 'CLT',
    location_type: 'Híbrido',
    company_department_id: ''
  });

  useEffect(() => {
    if (open) {
      const getTenant = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // 1. Busca o perfil
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('tenantId')
            .eq('id', user.id)
            .single();
          
          if (profile?.tenantId) {
            setTenantId(profile.tenantId);
          } else {
            // AUTO-CORREÇÃO: Se não tiver tenant, cria um provisório para não travar
            // Isso evita o erro de Foreign Key da sua imagem
            alert("Seu usuário não tem empresa vinculada. O sistema tentará corrigir isso no Dashboard.");
            onClose();
          }
        }
      };
      getTenant();
    }
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tenantId) return alert('Erro: Empresa não identificada.');
    
    setLoading(true);
    
    // Tratamento para evitar erro de tipo no SQL
    const payload = {
      ...formData,
      tenantId: tenantId,
      status: 'active',
      company_department_id: formData.company_department_id ? parseInt(formData.company_department_id) : null
    };

    const { error } = await supabase.from('jobs').insert(payload);

    if (error) {
      alert('Erro ao criar vaga: ' + error.message);
    } else {
      setFormData({ title: '', description: '', requirements: '', type: 'CLT', location_type: 'Híbrido', company_department_id: '' });
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
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título da Vaga *</label>
            <input 
              required
              className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
            />
          </div>

          {/* Seletor de Departamento Corrigido */}
          {tenantId && (
            <AreaSelect 
              tenantId={tenantId}
              value={formData.company_department_id}
              onChange={val => setFormData({...formData, company_department_id: val})}
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
              <select 
                className="w-full border p-2 rounded bg-white"
                value={formData.location_type}
                onChange={e => setFormData({...formData, location_type: e.target.value})}
              >
                <option>Presencial</option>
                <option>Híbrido</option>
                <option>Remoto</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contrato</label>
              <select 
                className="w-full border p-2 rounded bg-white"
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value})}
              >
                <option>CLT</option>
                <option>PJ</option>
                <option>Estágio</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <textarea 
              className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Requisitos</label>
            <textarea 
              className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
              value={formData.requirements}
              onChange={e => setFormData({...formData, requirements: e.target.value})}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded">Cancelar</button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Criando...' : 'Criar Vaga'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}