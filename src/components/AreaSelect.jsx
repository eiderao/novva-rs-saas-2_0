import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Loader2, Plus, X } from 'lucide-react';

export default function AreaSelect({ currentTenantId, selectedAreaId, onSelectArea, error }) {
  const [departments, setDepartments] = useState([]);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [loading, setLoading] = useState(false);

  // Busca áreas da empresa atual
  useEffect(() => {
    if (!currentTenantId) return;

    async function fetchDepartments() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('company_departments')
          .select('id, name')
          .eq('tenantId', currentTenantId)
          .order('name', { ascending: true });

        if (error) throw error;
        setDepartments(data || []);
      } catch (error) {
        console.error('Erro ao buscar áreas:', error.message);
      } finally {
        setLoading(false);
      }
    }

    fetchDepartments();
  }, [currentTenantId]);

  // Salva nova área
  const handleSaveNew = async () => {
    if (!newDeptName.trim()) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('company_departments')
        .insert([{ 
          name: newDeptName.trim(), 
          tenantId: currentTenantId 
        }])
        .select()
        .single();

      if (error) throw error;

      setDepartments([...departments, data]);
      onSelectArea(data.id);
      setIsCreatingNew(false);
      setNewDeptName('');
    } catch (error) {
      alert('Erro ao criar área: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && departments.length === 0) {
    return <div className="text-sm text-gray-500 flex items-center"><Loader2 className="w-3 h-3 animate-spin mr-2"/> Carregando áreas...</div>;
  }

  // Modo de Criação (Input de Texto)
  if (isCreatingNew) {
    return (
      <div className="mb-4 p-4 border border-blue-100 bg-blue-50 rounded-md">
        <Label>Nome da Nova Área</Label>
        <div className="flex gap-2">
          <Input
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
            placeholder="Ex: Marketing, TI..."
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 mt-3">
            <Button 
                type="button"
                variant="ghost" 
                size="sm"
                onClick={() => setIsCreatingNew(false)}
            >
                Cancelar
            </Button>
            <Button 
                type="button"
                size="sm"
                onClick={handleSaveNew}
                disabled={!newDeptName.trim() || loading}
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Salvar'}
            </Button>
        </div>
      </div>
    );
  }

  // Modo de Seleção (Dropdown Nativo Estilizado)
  return (
    <div className="mb-4">
      <Label>Área / Departamento</Label>
      <select
        className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        value={selectedAreaId || ''}
        onChange={(e) => {
          if (e.target.value === 'NEW') setIsCreatingNew(true);
          else onSelectArea(e.target.value);
        }}
      >
        <option value="">Selecione uma área...</option>
        {departments.map((dept) => (
          <option key={dept.id} value={dept.id}>
            {dept.name}
          </option>
        ))}
        <option value="NEW" className="font-bold text-blue-600 bg-blue-50">
          + Cadastrar Nova Área
        </option>
      </select>
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  );
}