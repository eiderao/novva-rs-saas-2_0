// src/pages/AdminTenantPage.jsx (VERSÃO FINAL E CORRIGIDA)
import React, { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { 
    Container, Typography, Box, AppBar, Toolbar, Button, CircularProgress, 
    Alert, Paper, Table, TableHead, TableRow, TableCell, TableBody,
    Modal, TextField, Checkbox, FormControlLabel, Snackbar,
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

// Estilo para o Modal
const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 500,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
};

// Componente do Formulário de Usuário
const UserFormModal = ({ open, onClose, user, tenantId, onSave }) => {
  const [formData, setFormData] = useState({ email: '', password: '', name: '', role: 'rh', isAdmin: false });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const isEditMode = Boolean(user);

  useEffect(() => {
    if (user) {
      setFormData({ 
        name: user.name, 
        role: user.role, 
        isAdmin: user.isAdmin,
        email: user.email || '', // O email não pode ser editado
      });
    } else {
      setFormData({ email: '', password: '', name: '', role: 'rh', isAdmin: false });
    }
  }, [user, open]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    setError('');
    try {
      const action = isEditMode ? 'updateUser' : 'createUser';
      // No modo de edição, não enviamos email/senha/tenantId
      const body = isEditMode 
        ? { action, userId: user.id, name: formData.name, role: formData.role, isAdmin: formData.isAdmin }
        : { action, ...formData, tenantId: tenantId };
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não encontrada.");
      
      const response = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify(body)
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Ocorreu um erro.");
      }
      const data = await response.json();
      onSave(isEditMode ? data.updatedUser : data.newUser);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={modalStyle}>
        <Typography variant="h6" gutterBottom>{isEditMode ? 'Editar Usuário' : 'Criar Novo Usuário'}</Typography>
        <TextField name="email" label="Email do Usuário" value={formData.email} onChange={handleChange} fullWidth margin="normal" required disabled={isEditMode} />
        {!isEditMode && (
          <TextField name="password" label="Senha Provisória" type="password" value={formData.password} onChange={handleChange} fullWidth margin="normal" required />
        )}
        <TextField name="name" label="Nome Completo" value={formData.name} onChange={handleChange} fullWidth margin="normal" required />
        <TextField name="role" label="Função (ex: rh, gestor)" value={formData.role} onChange={handleChange} fullWidth margin="normal" required />
        <FormControlLabel
          control={<Checkbox name="isAdmin" checked={formData.isAdmin} onChange={handleChange} />}
          label="Este usuário é Administrador?"
        />
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? <CircularProgress size={24} /> : 'Salvar'}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};


const AdminTenantPage = () => {
    const { tenantId } = useParams();
    const [tenant, setTenant] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'success' });

    const fetchTenantDetails = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Sessão não encontrada.");
            const response = await fetch(`/api/admin?action=getTenantDetails&tenantId=${tenantId}`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` },
            });
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || "Não foi possível buscar os dados."); }
            const data = await response.json();
            setTenant(data.tenant || null);
            setUsers(data.users || []);
        } catch (err) {
            console.error("Erro ao buscar detalhes do tenant:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTenantDetails();
    }, [tenantId]);

    const handleOpenModal = (user = null) => {
      setSelectedUser(user);
      setModalOpen(true);
    };
    const handleCloseModal = () => {
      setSelectedUser(null);
      setModalOpen(false);
    };
    const handleOpenDialog = (user) => {
      setSelectedUser(user);
      setDialogOpen(true);
    };
    const handleCloseDialog = () => {
      setSelectedUser(null);
      setDialogOpen(false);
    };

    const handleSaveUser = (savedUser) => {
      if (selectedUser) {
        setUsers(prev => prev.map(u => u.id === savedUser.id ? savedUser : u));
      } else {
        setUsers(prev => [...prev, savedUser]);
      }
      setFeedback({ open: true, message: 'Usuário salvo!', severity: 'success' });
    };

    const handleDeleteUser = async () => {
      if (!selectedUser) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Sessão não encontrada.");
        
        const response = await fetch('/api/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ action: 'deleteUser', userId: selectedUser.id })
        });
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || "Erro ao excluir."); }
        
        setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
        setFeedback({ open: true, message: 'Usuário excluído!', severity: 'success' });
        handleCloseDialog();
      } catch (err) {
        console.error("Erro ao excluir usuário:", err);
        setFeedback({ open: true, message: err.message, severity: 'error' });
      }
    };

    const renderContent = () => {
        if (loading) {
            return <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}><CircularProgress /></Box>;
        }
        if (error) {
            return <Alert severity="error">{error}</Alert>;
        }
        if (!tenant) {
             return <Alert severity="warning">Empresa não encontrada.</Alert>;
        }
        return (
            <Paper sx={{ mt: 3 }}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Nome do Usuário</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Função</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 'bold' }}>É Admin?</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Ações</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow hover key={user.id}>
                                <TableCell>{user.name}</TableCell>
                                <TableCell>{user.role}</TableCell>
                                <TableCell align="center">{user.isAdmin ? 'Sim' : 'Não'}</TableCell>
                                <TableCell align="right">
                                    <IconButton size="small" onClick={() => handleOpenModal(user)}><EditIcon /></IconButton>
                                    <IconButton size="small" onClick={() => handleOpenDialog(user)}><DeleteIcon color="error" /></IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>
        );
    };

    return (
        <Box>
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        {tenant ? `Gerenciar: ${tenant.companyName}` : 'Carregando Empresa...'}
                    </Typography>
                    <Button color="inherit" component={RouterLink} to="/admin">
                        Voltar para Admin
                    </Button>
                </Toolbar>
            </AppBar>
            <Container sx={{ mt: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h4" component="h1" gutterBottom>
                        Gerenciamento de Usuários
                    </Typography>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenModal()}>
                        Criar Usuário
                    </Button>
                </Box>
                {renderContent()}
            </Container>
            <UserFormModal
                open={modalOpen}
                onClose={handleCloseModal}
                user={selectedUser}
                tenantId={tenantId}
                onSave={handleSaveUser}
            />
            <Dialog open={dialogOpen} onClose={handleCloseDialog}>
                <DialogTitle>Confirmar Exclusão</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Você tem certeza que deseja excluir o usuário <strong>{selectedUser?.name}</strong>? Esta ação é irreversível.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Cancelar</Button>
                    <Button onClick={handleDeleteUser} color="error">Excluir</Button>
                </DialogActions>
            </Dialog>
            <Snackbar open={feedback.open} autoHideDuration={4000} onClose={() => setFeedback({open: false, message: ''})}>
                <Alert onClose={() => setFeedback({open: false, message: ''})} severity={feedback.severity || 'success'} sx={{ width: '100%' }}>
                  {feedback.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default AdminTenantPage;