import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import AreaSelect from '../AreaSelect';
import { Loader2, AlertCircle } from 'lucide-react';

const CreateJobModal = ({ open, handleClose, onJobCreated }) => {
  const [jobTitle, setJobTitle] = useState('');
  const [departmentId, setDepartmentId] = useState(null);
  const [tenantId, setTenantId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Busca robusta do Tenant ID
  useEffect(() => {
    if (open) {
      const fetchTenantId = async () => {
        try {
          const { data: { user } } = await supabase.auth.getSession();
          if (!user) return;

          const { data: userData, error } = await supabase
            .from('users')
            .select('tenantId')
            .eq('id', user.id)
            .single();

          if (error) throw error;
          if (userData?.tenantId) setTenantId(userData.tenantId);
          
        } catch (err) {
          console.error('Erro ao buscar tenant:', err);
        }
      };
      
      fetchTenantId();
    }
  }, [open]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Você não está autenticado.");

      const response = await fetch('/api/createJob', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
            title: jobTitle, 
            company_department_id: departmentId 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Não foi possível criar a vaga.");
      }

      // Sucesso
      setJobTitle('');
      setDepartmentId(null);
      onJobCreated(); 
      handleClose();

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={handleClose}
      title="Criar Nova Vaga"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        
        <div>
          <Label htmlFor="jobTitle">Título da Vaga</Label>
          <Input
            id="jobTitle"
            required
            autoFocus
            placeholder="Ex: Desenvolvedor Senior"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            disabled={loading}
          />
        </div>

        {tenantId ? (
            <AreaSelect 
                currentTenantId={tenantId}
                selectedAreaId={departmentId}
                onSelectArea={setDepartmentId}
            />
        ) : (
            <div className="text-sm text-gray-500 py-2">Carregando permissões...</div>
        )}

        {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-sm text-red-700">
                <AlertCircle className="w-4 h-4" />
                {error}
            </div>
        )}
        
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading || !jobTitle}>
            {loading ? (
                <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> 
                    Criando...
                </>
            ) : 'Criar Vaga'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateJobModal;