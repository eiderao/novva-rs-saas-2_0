import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';

export default function AreaSelect({ tenantId, value, onChange }) {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (tenantId) fetchDepts();
  }, [tenantId]);

  const fetchDepts = async () => {
    const { data } = await supabase
      .from('company_departments')
      .select('*')
      .eq('tenantId', tenantId)
      .order('name');
    setDepartments(data || []);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    // Insere direto na tabela criada no SQL anterior
    const { data, error } = await supabase
      .from('company_departments')
      .insert({ name: newName, tenantId })
      .select()
      .single();
    
    if (!error && data) {
      setDepartments([...departments, data]);
      onChange(data.id); // Seleciona o novo
      setIsCreating(false);
      setNewName('');
    } else {
      alert('Erro ao criar departamento.');
    }
    setLoading(false);
  };

  if (isCreating) {
    return (
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Nova Área</label>
          <input 
            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Ex: Financeiro"
            autoFocus
          />
        </div>
        <button 
          type="button"
          onClick={handleCreate} 
          disabled={loading}
          className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 h-[42px]"
        >
          {loading ? '...' : 'Salvar'}
        </button>
        <button 
          type="button"
          onClick={() => setIsCreating(false)} 
          className="bg-gray-200 text-gray-700 px-3 py-2 rounded hover:bg-gray-300 h-[42px]"
        >
          X
        </button>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Departamento / Área</label>
      <select 
        className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white"
        value={value || ''}
        onChange={e => {
          if (e.target.value === 'NEW') setIsCreating(true);
          else onChange(e.target.value);
        }}
      >
        <option value="">Selecione...</option>
        {departments.map(d => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
        <option value="NEW" className="font-bold text-blue-600">+ Criar Nova Área</option>
      </select>
    </div>
  );
}