import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import { Modal, Box, Typography, TextField, Button, CircularProgress, Alert } from '@mui/material';
import AreaSelect from '../AreaSelect'; // Importando o novo componente

const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 450, // Aumentei um pouco a largura
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
};

const CreateJobModal = ({ open, handleClose, onJobCreated }) => {
  const [jobTitle, setJobTitle] = useState('');
  const [departmentId, setDepartmentId] = useState(null); // Novo estado
  const [tenantId, setTenantId] = useState(null); // Para passar ao AreaSelect
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Busca o tenantId ao abrir o modal para carregar as áreas corretas
  useEffect(() => {
    if (open) {
      const getSessionData = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        // Assume que o tenantId está nos metadados ou você ajusta conforme sua auth
        if (session?.user?.user_metadata?.tenantId) {
            setTenantId(session.user.user_metadata.tenantId);
        } else if (session?.user?.app_metadata?.tenantId) {
            setTenantId(session.user.app_metadata.tenantId);
        }
      };
      getSessionData();
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
        // AQUI ESTÁ A MUDANÇA: Enviando o departmentId
        body: JSON.stringify({ 
            title: jobTitle, 
            company_department_id: departmentId 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Não foi possível criar a vaga.");
      }

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
        />

        {/* Componente de Seleção de Área */}
        <AreaSelect 
            currentTenantId={tenantId}
            selectedAreaId={departmentId}
            onSelectArea={setDepartmentId}
        />

        {error && <Alert severity="error" sx={{mt: 2}}>{error}</Alert>}
        
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={handleClose}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={loading || !jobTitle}>
            {loading ? <CircularProgress size={24} /> : 'Criar Vaga'}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};

export default CreateJobModal;