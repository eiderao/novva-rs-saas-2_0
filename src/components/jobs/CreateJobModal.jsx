import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import AreaSelect from '../AreaSelect';
import { Loader2, AlertCircle } from 'lucide-react';

const CreateJobModal = ({ open, handleClose, onJobCreated }) => {
  const initialState = {
    title: '', description: '', requirements: '', type: 'CLT',
    location_type: 'Híbrido', company_department_id: null
  };
  const [formData, setFormData] = useState(initialState);
  const [tenantId, setTenantId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      const fetchTenant = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if(user) {
            const { data } = await supabase.from('user_profiles').select('tenantId').eq('id', user.id).single();
            if(data) setTenantId(data.tenantId);
        }
      };
      fetchTenant();
    }
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!formData.title) throw new Error("Título é obrigatório.");

      // Inserção direta no Supabase
      const { error: insertError } = await supabase.from('jobs').insert({
        ...formData,
        tenantId: tenantId,
        status: 'active',
        company_department_id: formData.company_department_id || null,
        parameters: { 
            triagem: [], cultura: [], tecnico: [], 
            notas: [{id:'1',nome:'Abaixo',valor:0},{id:'2',nome:'Atende',valor:50},{id:'3',nome:'Supera',valor:100}] 
        }
      });

      if (insertError) throw insertError;

      setFormData(initialState);
      onJobCreated();
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  return (
    <Modal isOpen={open} onClose={handleClose} title="Nova Vaga">
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto px-1">
        <div><Label>Título *</Label><Input name="title" value={formData.title} onChange={handleChange} required /></div>
        {tenantId && <AreaSelect currentTenantId={tenantId} selectedAreaId={formData.company_department_id} onSelectArea={(id) => setFormData(p => ({...p, company_department_id: id}))} />}
        <div className="grid grid-cols-2 gap-4">
            <div><Label>Modelo</Label><select name="location_type" className="w-full border rounded h-10 px-2" value={formData.location_type} onChange={handleChange}><option>Presencial</option><option>Híbrido</option><option>Remoto</option></select></div>
            <div><Label>Contrato</Label><select name="type" className="w-full border rounded h-10 px-2" value={formData.type} onChange={handleChange}><option>CLT</option><option>PJ</option><option>Estágio</option></select></div>
        </div>
        <div><Label>Descrição</Label><Textarea name="description" value={formData.description} onChange={handleChange} /></div>
        <div><Label>Requisitos</Label><Textarea name="requirements" value={formData.requirements} onChange={handleChange} /></div>
        {error && <div className="text-red-500 text-sm">{error}</div>}
        <div className="flex justify-end gap-2 pt-2 border-t"><Button variant="outline" onClick={handleClose}>Cancelar</Button><Button type="submit" disabled={loading}>{loading ? <Loader2 className="animate-spin"/> : 'Criar'}</Button></div>
      </form>
    </Modal>
  );
};

export default CreateJobModal;