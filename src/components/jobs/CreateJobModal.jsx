// src/components/jobs/CreateJobModal.jsx (Versão Final)
import React, { useState } from 'react';
import { supabase } from '../../supabase/client';
import { Modal, Box, Typography, TextField, Button, CircularProgress, Alert } from '@mui/material';

// Estilo para a caixa do modal
const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
};

// Adicionamos a prop 'onJobCreated' para avisar o Dashboard que uma nova vaga foi criada
const CreateJobModal = ({ open, handleClose, onJobCreated }) => {
  const [jobTitle, setJobTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Você não está autenticado.");

      // ESTA É A LÓGICA CORRETA: Chamar a nossa API de backend
      const response = await fetch('/api/createJob', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ title: jobTitle }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Não foi possível criar a vaga.");
      }

      // Limpa o formulário, avisa o componente pai e fecha o modal
      setJobTitle('');
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
        <Typography id="create-job-modal-title" variant="h6" component="h2">
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
        {error && <Alert severity="error" sx={{mt: 2}}>{error}</Alert>}
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
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