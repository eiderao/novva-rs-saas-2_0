// src/pages/AdminPage.jsx (Versão com Link para /admin/tenant/:tenantId)
import React, { useState, useEffect, forwardRef } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { 
    Container, Typography, Box, AppBar, Toolbar, Button, CircularProgress, 
    Alert, Paper, Table, TableHead, TableRow, TableCell, TableBody, Tabs, Tab,
    Modal, FormControl, InputLabel, Select, MenuItem, Snackbar, TextField,
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Grid
} from '@mui/material';
import { IMaskInput } from 'react-imask';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

// Máscara CNPJ (sem alterações)
const CnpjMask = forwardRef(function CnpjMask(props, ref) {
  const { onChange, ...other } = props;
  return (
    <IMaskInput
      {...other}
      mask="00.000.000/0000-00"
      definitions={{
        '#': /[1-9]/,
      }}
      inputRef={ref}
      onAccept={(value) => onChange({ target: { name: props.name, value } })}
      overwrite
    />
  );
});

// Estilo Modal (sem alterações)
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

// Componente do Formulário de Plano (sem alterações)
const PlanFormModal = ({ open, onClose, plan, onSave }) => {
  const [formData, setFormData] = useState({ id: '', name: '', user_limit: 1, job_limit: 1, candidate_limit: 1, price: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const isEditMode = Boolean(plan);
  useEffect(() => { if (plan) { setFormData(plan); } else { setFormData({ id: '', name: '', user_limit: 1, job_limit: 1, candidate_limit: 1, price: 0 }); } }, [plan, open]);
  const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
  const handleNumericChange = (e) => { const { name, value } = e.target; const numValue = value === '-1' ? -1 : parseInt(value, 10) || 0; setFormData(prev => ({ ...prev, [name]: numValue })); };
  const handleSubmit = async () => {
    setIsSaving(true);
    setError('');
    try {
      const action = isEditMode ? 'updatePlan' : 'createPlan';
      const body = isEditMode ? { planId: plan.id, planData: formData } : { planData: formData };
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não encontrada.");
      const response = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ action, ...body })
      });
      if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || "Ocorreu um erro."); }
      const data = await response.json();
      onSave(isEditMode ? data.updatedPlan : data.newPlan);
      onClose();
    } catch (err) { setError(err.message); } 
    finally { setIsSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={modalStyle}>
        <Typography variant="h6" gutterBottom>{isEditMode ? 'Editar Plano' : 'Criar Novo Plano'}</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}><TextField name="id" label="ID do Plano (ex: 'basico')" value={formData.id} onChange={handleChange} fullWidth margin="normal" required disabled={isEditMode} /></Grid>
          <Grid item xs={12}><TextField name="name" label="Nome do Plano (ex: 'Plano Básico')" value={formData.name} onChange={handleChange} fullWidth margin="normal" required /></Grid>
          <Grid item xs={12}><TextField name="price" label="Preço (ex: 99.00)" type="number" value={formData.price} onChange={handleChange} fullWidth margin="normal" required /></Grid>
          <Grid item xs={12} sm={4}><TextField name="user_limit" label="Limite de Usuários" type="number" value={formData.user_limit} onChange={handleNumericChange} fullWidth margin="normal" helperText="-1 para ilimitado" /></Grid>
          <Grid item xs={12} sm={4}><TextField name="job_limit" label="Limite de Vagas" type="number" value={formData.job_limit} onChange={handleNumericChange} fullWidth margin="normal" helperText="-1 para ilimitado" /></Grid>
          <Grid item xs={12} sm={4}><TextField name="candidate_limit" label="Limite de Candidatos/Vaga" type="number" value={formData.candidate_limit} onChange={handleNumericChange} fullWidth margin="normal" helperText="-1 para ilimitado" /></Grid>
        </Grid>
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

// Tabela de Planos (sem alterações)
const PlansTable = ({ plans, onAdd, onEdit, onDelete }) => (
  <>
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', my: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd}>
            Criar Novo Plano
        </Button>
    </Box>
    <Paper>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 'bold' }}>ID do Plano</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Nome</TableCell>
            <TableCell align="center" sx={{ fontWeight: 'bold' }}>Usuários</TableCell>
            <TableCell align="center" sx={{ fontWeight: 'bold' }}>Vagas</TableCell>
            <TableCell align="center" sx={{ fontWeight: 'bold' }}>Candidatos/Vaga</TableCell>
            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Preço</TableCell>
            <TableCell align="center" sx={{ fontWeight: 'bold' }}>Ações</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {plans.map((plan) => (
            <TableRow hover key={plan.id}>
              <TableCell>{plan.id}</TableCell>
              <TableCell>{plan.name}</TableCell>
              <TableCell align="center">{plan.user_limit === -1 ? 'Ilimitado' : plan.user_limit}</TableCell>
              <TableCell align="center">{plan.job_limit === -1 ? 'Ilimitado' : plan.job_limit}</TableCell>
              <TableCell align="center">{plan.candidate_limit === -1 ? 'Ilimitado' : plan.candidate_limit}</TableCell>
              <TableCell align="right">R$ {plan.price.toFixed(2)}</TableCell>
              <TableCell align="center">
                <IconButton size="small" onClick={() => onEdit(plan)}><EditIcon /></IconButton>
                <IconButton size="small" onClick={() => onDelete(plan)}><DeleteIcon color="error" /></IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  </>
);

// Tabela de Tenants (AQUI ESTÁ A MUDANÇA)
const TenantsTable = ({ tenants, plans, onTenantUpdated, onTenantCreated, onTenantDeleted }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [formData, setFormData] = useState({ companyName: '', planId: '', cnpj: '' });
  
  const handleOpenModal = (tenant = null) => {
    setSelectedTenant(tenant);
    if (tenant) { setFormData({ companyName: tenant.companyName, planId: tenant.planId, cnpj: tenant.cnpj || '' }); }
    else { setFormData({ companyName: '', planId: '', cnpj: '' }); }
    setModalOpen(true);
  };
  const handleOpenDialog = (tenant) => { setSelectedTenant(tenant); setDialogOpen(true); };
  const handleClose = () => { setModalOpen(false); setDialogOpen(false); setSelectedTenant(null); };
  const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
  const callApi = async (action, body) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Sessão não encontrada.");
    const response = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ action, ...body })
    });
    if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || "Ocorreu um erro."); }
    return await response.json();
  };
  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      if (selectedTenant) { const data = await callApi('updateTenant', { id: selectedTenant.id, ...formData }); onTenantUpdated(data.updatedTenant); }
      else { const data = await callApi('createTenant', formData); onTenantCreated(data.newTenant); }
      handleClose();
    } catch (err) { console.error("Erro ao salvar empresa:", err); } 
    finally { setIsSaving(false); }
  };
  const handleDelete = async () => {
    setIsSaving(true);
    try {
      await callApi('deleteTenant', { tenantId: selectedTenant.id });
      onTenantDeleted(selectedTenant.id);
      handleClose();
    } catch (err) { console.error("Erro ao excluir empresa:", err); } 
    finally { setIsSaving(false); }
  };

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', my: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenModal()}>
            Criar Nova Empresa
        </Button>
      </Box>
      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Nome da Empresa</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>CNPJ</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Plano Atual</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tenants.map((tenant) => (
              <TableRow hover key={tenant.id}>
                <TableCell>{tenant.companyName}</TableCell>
                <TableCell>{tenant.cnpj}</TableCell>
                <TableCell>{tenant.plans ? tenant.plans.name : tenant.planId}</TableCell>
                <TableCell align="right">
                    {/* AQUI ESTÁ A MUDANÇA: O botão agora é um Link */}
                    <Button size="small" component={RouterLink} to={`/admin/tenant/${tenant.id}`}>
                      Gerenciar Usuários
                    </Button>
                    <IconButton size="small" onClick={() => handleOpenModal(tenant)}><EditIcon /></IconButton>
                    <IconButton size="small" onClick={() => handleOpenDialog(tenant)}><DeleteIcon color="error" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
      <Modal open={modalOpen} onClose={handleClose}>
        <Box sx={modalStyle}>
          <Typography variant="h6" gutterBottom>{selectedTenant ? 'Editar Empresa' : 'Criar Nova Empresa'}</Typography>
          <TextField name="companyName" label="Nome da Empresa" value={formData.companyName} onChange={handleChange} fullWidth margin="normal" required />
          <TextField name="cnpj" label="CNPJ" value={formData.cnpj} onChange={handleChange} fullWidth margin="normal" InputProps={{ inputComponent: CnpjMask }} />
          <FormControl fullWidth margin="normal" required>
            <InputLabel id="plan-select-label">Plano</InputLabel>
            <Select name="planId" labelId="plan-select-label" value={formData.planId} label="Plano" onChange={handleChange}>
              {plans.map(plan => (
                <MenuItem key={plan.id} value={plan.id}>{plan.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={handleClose} disabled={isSaving}>Cancelar</Button>
            <Button variant="contained" onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? <CircularProgress size={24} /> : 'Salvar'}
            </Button>
          </Box>
        </Box>
      </Modal>
      <Dialog open={dialogOpen} onClose={handleClose}>
        <DialogTitle>Confirmar Exclusão</DialogTitle>
        <DialogContent><DialogContentText>Você tem certeza que deseja excluir a empresa <strong>{selectedTenant?.companyName}</strong>? Esta ação é irreversível.</DialogContentText></DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleDelete} color="error" disabled={isSaving}>
            {isSaving ? <CircularProgress size={24} /> : 'Excluir'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Componente Principal da Página
const AdminPage = () => {
    const [tenants, setTenants] = useState([]);
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [tabValue, setTabValue] = useState(0);
    const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'success' });
    const [planModalOpen, setPlanModalOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [planDialogOpen, setPlanDialogOpen] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Sessão não encontrada.");
            const response = await fetch('/api/admin?action=getTenantsAndPlans', {
                headers: { 'Authorization': `Bearer ${session.access_token}` },
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Não foi possível buscar os dados.");
            }
            const data = await response.json();
            setTenants(data.tenants || []);
            setPlans(data.plans || []);
        } catch (err) {
            console.error("Erro ao buscar dados de admin:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleTabChange = (event, newValue) => { setTabValue(newValue); };

    const handleTenantUpdated = (updatedTenant) => {
      setTenants(prevTenants => prevTenants.map(t => 
        t.id === updatedTenant.id ? { ...t, ...updatedTenant, plans: plans.find(p => p.id === updatedTenant.planId) } : t
      ));
      setFeedback({ open: true, message: 'Empresa atualizada!', severity: 'success' });
    };
    const handleTenantCreated = (newTenant) => {
      setTenants(prevTenants => [
        ...prevTenants, 
        { ...newTenant, plans: plans.find(p => p.id === newTenant.planId) }
      ]);
      setFeedback({ open: true, message: 'Empresa criada!', severity: 'success' });
    };
    const handleTenantDeleted = (deletedTenantId) => {
      setTenants(prevTenants => prevTenants.filter(t => t.id !== deletedTenantId));
      setFeedback({ open: true, message: 'Empresa excluída!', severity: 'success' });
    };
    const handleOpenPlanModal = (plan = null) => {
      setSelectedPlan(plan);
      setPlanModalOpen(true);
    };
    const handleClosePlanModal = () => {
      setSelectedPlan(null);
      setPlanModalOpen(false);
    };
    const handleSavePlan = (savedPlan) => {
      if (selectedPlan) {
        setPlans(prev => prev.map(p => p.id === savedPlan.id ? savedPlan : p));
      } else {
        setPlans(prev => [...prev, savedPlan]);
      }
      setFeedback({ open: true, message: 'Plano salvo!', severity: 'success' });
    };
    const handleOpenPlanDialog = (plan) => {
      setSelectedPlan(plan);
      setPlanDialogOpen(true);
    };
    const handleClosePlanDialog = () => {
      setSelectedPlan(null);
      setPlanDialogOpen(false);
    };
    const handleDeletePlan = async () => {
      if (!selectedPlan) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Sessão não encontrada.");
        const response = await fetch('/api/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ action: 'deletePlan', planId: selectedPlan.id })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Erro ao excluir.");
        }
        setPlans(prev => prev.filter(p => p.id !== selectedPlan.id));
        setFeedback({ open: true, message: 'Plano excluído!', severity: 'success' });
        handleClosePlanDialog();
      } catch (err) {
        console.error("Erro ao excluir plano:", err);
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
        return (
            <Box>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs value={tabValue} onChange={handleTabChange}>
                        <Tab label="Empresas (Tenants)" />
                        <Tab label="Planos" />
                    </Tabs>
                </Box>
                <Box hidden={tabValue !== 0}>
                    <TenantsTable 
                      tenants={tenants} 
                      plans={plans} 
                      onTenantUpdated={handleTenantUpdated}
                      onTenantCreated={handleTenantCreated}
                      onTenantDeleted={handleTenantDeleted}
                    />
                </Box>
                <Box hidden={tabValue !== 1}>
                    <PlansTable 
                      plans={plans} 
                      onAdd={() => handleOpenPlanModal()}
                      onEdit={(plan) => handleOpenPlanModal(plan)}
                      onDelete={(plan) => handleOpenPlanDialog(plan)}
                    />
                </Box>
            </Box>
        );
    };

    return (
        <Box>
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        Painel de Administração
                    </Typography>
                    <Button color="inherit" component={RouterLink} to="/">
                        Voltar para o App
                    </Button>
                </Toolbar>
            </AppBar>
            <Container sx={{ mt: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    Gerenciamento do Sistema
                </Typography>
                {renderContent()}
            </Container>
            <PlanFormModal
              open={planModalOpen}
              onClose={handleClosePlanModal}
              plan={selectedPlan}
              onSave={handleSavePlan}
            />
            <Dialog open={planDialogOpen} onClose={handleClosePlanDialog}>
              <DialogTitle>Confirmar Exclusão</DialogTitle>
              <DialogContent>
                <DialogContentText>
                  Você tem certeza que deseja excluir o plano <strong>{selectedPlan?.name}</strong>? Esta ação não pode ser desfeita.
                </DialogContentText>
              </DialogContent>
              <DialogActions>
                <Button onClick={handleClosePlanDialog}>Cancelar</Button>
                <Button onClick={handleDeletePlan} color="error">Excluir</Button>
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

export default AdminPage;