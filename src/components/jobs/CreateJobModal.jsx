import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client'; // Verifique se o caminho está correto
import { Modal, Box, Typography, TextField, Button, CircularProgress, Alert } from '@mui/material';
import AreaSelect from '../AreaSelect'; // Verifique se o caminho está correto

const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 450,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
};

const CreateJobModal = ({ open, handleClose, onJobCreated }) => {
  const [jobTitle, setJobTitle] = useState('');
  const [departmentId, setDepartmentId] = useState(null);
  const [tenantId, setTenantId] = useState(null); // O ID da Empresa
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // --- CORREÇÃO AQUI: Busca robusta do Tenant ID ---
  useEffect(() => {
    if (open) {
      const fetchTenantId = async () => {
        try {
          // 1. Pega o usuário logado
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          // 2. Busca o tenantId na tabela 'users' (Fonte da verdade)
          const { data: userData, error } = await supabase
            .from('users')
            .select('tenantId')
            .eq('id', user.id)
            .single();

          if (error) {
            console.error('Erro ao buscar perfil:', error);
            return;
          }

          if (userData?.tenantId) {
            setTenantId(userData.tenantId);
          }
        } catch (err) {
          console.error('Erro fatal ao buscar tenant:', err);
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

      // Envia para a API (que já corrigimos no passo anterior)
      const response = await fetch('/api/createJob', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
            title: jobTitle, 
            company_department_id: departmentId // Pode ser null se não selecionado
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
      open={open}
      onClose={handleClose}
      aria-labelledby="create-job-modal-title"
    >
      <Box sx={style} component="form" onSubmit={handleSubmit}>
        <Typography id="create-job-modal-title" variant="h6" component="h2" gutterBottom>
          Criar Nova Vaga
        </Typography>
        
        <TextField
          margin="normal"
          required
          fullWidth
          id="jobTitle"
          label="Nome da Vaga"
          name="jobTitle"
          autoFocus
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          disabled={loading}
        />

        {/* Passamos o tenantId recuperado do banco.
            Se tenantId for null (ainda carregando), o AreaSelect saberá lidar/esperar 
        */}
        {tenantId ? (
            <AreaSelect 
                currentTenantId={tenantId}
                selectedAreaId={departmentId}
                onSelectArea={setDepartmentId}
            />
        ) : (
            <Typography variant="caption" color="text.secondary">
                Carregando áreas...
            </Typography>
        )}

        {error && <Alert severity="error" sx={{mt: 2}}>{error}</Alert>}
        
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={handleClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={loading || !jobTitle}>
            {loading ? <CircularProgress size={24} /> : 'Criar Vaga'}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};

export default CreateJobModal;