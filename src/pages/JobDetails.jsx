// src/pages/JobDetails.jsx (VERSÃO FINAL com Status Traduzido)
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { format, parseISO } from 'date-fns';
import { 
    Container, Typography, Box, AppBar, Toolbar, Button, CircularProgress, 
    Alert, Paper, Tabs, Tab, TextField, IconButton, Snackbar, InputAdornment,
    List, ListItem, ListItemText, Divider, Grid,
    Table, TableHead, TableRow, TableCell, TableBody, Checkbox,
    FormControl, InputLabel, Select, MenuItem, Modal,
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import ClassificationChart from '../components/charts/ClassificationChart';
import { formatStatus } from '../utils/formatters'; // IMPORTA NOSSO TRADUTOR

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

const CopyParametersModal = ({ open, onClose, currentJobId, onCopy }) => {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [loading, setLoading] = useState(true);
  const [isCopying, setIsCopying] = useState(false);

  useEffect(() => {
    if (open) {
      const fetchJobsList = async () => {
        setLoading(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error("Sessão não encontrada.");
          const response = await fetch('/api/jobs', { headers: { 'Authorization': `Bearer ${session.access_token}` } });
          const data = await response.json();
          const copyableJobs = (data.jobs || []).filter(
            (job) => job.id.toString() !== currentJobId && job.status === 'active'
          );
          setJobs(copyableJobs);
        } catch (err) {
          console.error("Erro ao buscar lista de vagas:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchJobsList();
    }
  }, [open, currentJobId]);

  const handleConfirmCopy = async () => {
    if (!selectedJobId) return;
    setIsCopying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não encontrada.");
      const response = await fetch(`/api/jobs?id=${selectedJobId}`, { headers: { 'Authorization': `Bearer ${session.access_token}` } });
      const data = await response.json();
      if (data.job && data.job.parameters) {
        onCopy(data.job.parameters);
      }
      onClose();
    } catch (err) {
      console.error("Erro ao copiar parâmetros:", err);
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={modalStyle}>
        <Typography variant="h6" gutterBottom>Copiar Parâmetros de outra Vaga</Typography>
        <Typography variant="body2" gutterBottom>
          Selecione uma vaga ativa para copiar todos os seus parâmetros (Triagem, Cultura, Técnico e Notas) para esta vaga.
        </Typography>
        {loading ? (
          <CircularProgress />
        ) : (
          <FormControl fullWidth margin="normal" required>
            <InputLabel id="copy-job-label">Selecionar Vaga</InputLabel>
            <Select
              labelId="copy-job-label"
              value={selectedJobId}
              label="Selecionar Vaga"
              onChange={(e) => setSelectedJobId(e.target.value)}
            >
              {jobs.length > 0 ? (
                jobs.map(job => (
                  <MenuItem key={job.id} value={job.id}>{job.title}</MenuItem>
                ))
              ) : (
                <MenuItem disabled>Nenhuma outra vaga ativa encontrada.</MenuItem>
              )}
            </Select>
          </FormControl>
        )}
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={onClose} disabled={isCopying}>Cancelar</Button>
          <Button variant="contained" onClick={handleConfirmCopy} disabled={loading || isCopying || !selectedJobId}>
            {isCopying ? <CircularProgress size={24} /> : 'Copiar'}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};

const ParametersSection = ({ criteria = [], onCriteriaChange }) => {
  const handleItemChange = (index, field, value) => { const newCriteria = [...criteria]; const numericValue = field === 'weight' ? Number(value) || 0 : value; newCriteria[index] = { ...newCriteria[index], [field]: numericValue }; onCriteriaChange(newCriteria); };
  const addCriterion = () => { if (criteria.length < 10) { onCriteriaChange([...criteria, { name: '', weight: 0 }]); } };
  const removeCriterion = (index) => { const newCriteria = criteria.filter((_, i) => i !== index); onCriteriaChange(newCriteria); };
  const totalWeight = criteria.reduce((sum, item) => sum + (item.weight || 0), 0);
  return (
    <Box sx={{ mt: 2 }}>
      {criteria.map((item, index) => (
        <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <TextField label={`Critério ${index + 1}`} value={item.name} onChange={(e) => handleItemChange(index, 'name', e.target.value)} fullWidth variant="standard" />
          <TextField label="Peso (%)" type="number" value={item.weight} onChange={(e) => handleItemChange(index, 'weight', e.target.value)} sx={{ width: '120px' }} variant="standard" />
          <IconButton onClick={() => removeCriterion(index)} color="error"><DeleteIcon /></IconButton>
        </Box>
      ))}
      <Button startIcon={<AddCircleOutlineIcon />} onClick={addCriterion} disabled={criteria.length >= 10} sx={{ mt: 2 }}>Adicionar Critério</Button>
      <Typography variant="h6" sx={{ mt: 3, p: 1, borderRadius: 1, bgcolor: totalWeight === 100 ? '#e8f5e9' : '#ffebee', color: totalWeight === 100 ? 'green' : 'red' }}> Soma dos Pesos: {totalWeight}% </Typography>
    </Box>
  );
};

const JobDetails = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [parameters, setParameters] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'success' });
  const [applicantData, setApplicantData] = useState({ loading: true, data: [], error: null });
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchJobDetails = async () => {
      if (!jobId) { setLoading(false); setError("ID da vaga não encontrado."); return; }
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Sessão não encontrada.");
        const response = await fetch(`/api/jobs?id=${jobId}`, { headers: { 'Authorization': `Bearer ${session.access_token}` } });
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || "Não foi possível buscar os detalhes da vaga."); }
        const data = await response.json();
        if (data.job && data.job.parameters) { setJob(data.job); setParameters(data.job.parameters); } 
        else { throw new Error("Os dados da vaga recebidos são inválidos."); }
      } catch (err) { console.error("Erro ao buscar detalhes da vaga:", err); setError(err.message); } 
      finally { setLoading(false); }
    };
    fetchJobDetails();
  }, [jobId]);

  useEffect(() => {
    const fetchApplicants = async () => {
      if (!jobId) return;
      setApplicantData({ loading: true, data: [], error: null });
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Sessão não encontrada.");
        const response = await fetch(`/api/getApplicantsForJob?jobId=${jobId}`, { headers: { 'Authorization': `Bearer ${session.access_token}` } });
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || "Não foi possível buscar os candidatos."); }
        const data = await response.json();
        setApplicantData({ loading: false, data: data.applicants || [], error: null });
      } catch (err) { console.error("Erro ao buscar candidatos:", err); setApplicantData({ loading: false, data: [], error: err.message }); }
    };
    fetchApplicants();
  }, [jobId]);

  const classifiedApplicants = useMemo(() => {
    if (!applicantData.data) return [];
    return [...applicantData.data].sort((a, b) => b.notaGeral - a.notaGeral);
  }, [applicantData.data]);
  
  const handleHiredToggle = async (applicationId, currentStatus) => {
    const newStatus = !currentStatus;
    setApplicantData(prev => ({
      ...prev,
      data: prev.data.map(app => 
        app.applicationId === applicationId ? { ...app, isHired: newStatus } : app
      ),
    }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não encontrada.");
      await fetch('/api/updateHiredStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ applicationId, isHired: newStatus }),
      });
    } catch (err) {
      setFeedback({ open: true, message: 'Erro ao atualizar status.', severity: 'error' });
      setApplicantData(prev => ({
        ...prev,
        data: prev.data.map(app => 
          app.applicationId === applicationId ? { ...app, isHired: currentStatus } : app
        ),
      }));
    }
  };

  const handleTabChange = (event, newValue) => { setTabValue(newValue); };
  const handleParametersChange = (section, newCriteria) => { setParameters(prevParams => ({ ...prevParams, [section]: newCriteria })); };
  const handleNoteChange = (index, field, value) => {
    const newNotes = [...parameters.notas];
    const numericValue = field === 'valor' ? Number(value) || 0 : value;
    newNotes[index] = { ...newNotes[index], [field]: numericValue };
    setParameters(prevParams => ({ ...prevParams, notas: newNotes }));
  };
  const handleSaveParameters = async () => {
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Você não está autenticado.");
      const response = await fetch('/api/updateJobParameters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ jobId: jobId, parameters: parameters }),
      });
      if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || "Não foi possível salvar os parâmetros."); }
      setFeedback({ open: true, message: 'Parâmetros salvos com sucesso!', severity: 'success' });
    } catch (err) {
      setFeedback({ open: true, message: err.message, severity: 'error' });
    } finally {
      setIsSaving(false);
    }
  };
  const handleCloseFeedback = () => { setFeedback({ open: false, message: '' }); };
  const applicationUrl = `${window.location.origin}/vaga/${jobId}/apply`;
  const handleCopyLink = () => { navigator.clipboard.writeText(applicationUrl); setFeedback({ open: true, message: 'Link copiado!', severity: 'info' }); };
  const handleParametersCopied = (newParameters) => {
    setParameters(newParameters);
    setFeedback({ open: true, message: 'Parâmetros copiados! Clique em "Salvar Parâmetros" para confirmar.', severity: 'info' });
  };
  
  const handleStatusChange = async (event) => {
    const newStatus = event.target.value;
    const oldStatus = job.status;
    setJob(prev => ({ ...prev, status: newStatus }));
    setIsSaving(true);
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Sessão não encontrada.");
        const response = await fetch('/api/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ action: 'updateJobStatus', jobId: jobId, newStatus: newStatus })
        });
        if (!response.ok) throw new Error("Não foi possível atualizar o status.");
        setFeedback({ open: true, message: 'Status atualizado!', severity: 'success' });
    } catch (err) {
        console.error(err);
        setFeedback({ open: true, message: 'Erro ao atualizar status.', severity: 'error' });
        setJob(prev => ({ ...prev, status: oldStatus })); 
    } finally {
        setIsSaving(false);
    }
  };

  const handleDeleteJob = async () => {
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não encontrada.");
      const response = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: 'deleteJob', jobId: jobId })
      });
      if (!response.ok) throw new Error("Não foi possível excluir a vaga.");
      setOpenDeleteDialog(false);
      navigate('/');
    } catch (err) {
      console.error(err);
      setFeedback({ open: true, message: 'Erro ao excluir vaga.', severity: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };
  
  const renderContent = () => {
    if (loading) { return <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}><CircularProgress /></Box>; }
    if (error) { return <Alert severity="error">{error}</Alert>; }
    if (job && parameters) {
      return (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
                <Typography variant="h4">{job.title}</Typography>
                {/* CORREÇÃO APLICADA AQUI */}
                <Typography variant="subtitle1" color="text.secondary" gutterBottom sx={{ textTransform: 'capitalize' }}>
                  Status: {formatStatus(job.status)}
                </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <FormControl sx={{ minWidth: 150 }} size="small">
                  <InputLabel id="status-select-label">Alterar Status</InputLabel>
                  <Select
                    labelId="status-select-label"
                    value={job.status}
                    label="Alterar Status"
                    onChange={handleStatusChange}
                    disabled={isSaving}
                  >
                    {/* CORREÇÃO APLICADA AQUI */}
                    <MenuItem value="active">Ativa</MenuItem>
                    <MenuItem value="inactive">Inativa</MenuItem>
                    <MenuItem value="filled">Preenchida</MenuItem>
                  </Select>
                </FormControl>
                <Button 
                  variant="outlined" 
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => setOpenDeleteDialog(true)}
                  disabled={isDeleting}
                >
                  Excluir Vaga
                </Button>
            </Box>
          </Box>
          
          <Box sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h6" gutterBottom>Link Público de Candidatura</Typography>
            <TextField fullWidth variant="outlined" value={applicationUrl} InputProps={{ readOnly: true, endAdornment: ( <InputAdornment position="end"><IconButton onClick={handleCopyLink}><ContentCopyIcon /></IconButton></InputAdornment> )}}/>
          </Box>
          
          <Paper sx={{ width: '100%' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={handleTabChange}>
                <Tab label="Candidatos" />
                <Tab label="Parâmetros" />
                <Tab label="Classificação" />
              </Tabs>
            </Box>
            <Box p={3} hidden={tabValue !== 0}>
              <Typography variant="h5" gutterBottom>Candidatos Inscritos</Typography>
              {applicantData.loading ? <CircularProgress /> : applicantData.error ? <Alert severity="error">{applicantData.error}</Alert> : (
                <List>
                  {applicantData.data.length > 0 ? applicantData.data.map((app, index) => (
                    <React.Fragment key={app.applicationId}>
                      <ListItem button component={RouterLink} to={`/vaga/${jobId}/candidato/${app.applicationId}`}>
                        <ListItemText primary={app.candidateName} secondary={app.candidateEmail} />
                      </ListItem>
                      {index < applicantData.data.length - 1 && <Divider />}
                    </React.Fragment>
                  )) : ( <Typography>Nenhum candidato inscrito para esta vaga ainda.</Typography> )}
                </List>
              )}
            </Box>
            <Box p={3} hidden={tabValue !== 1}>
               <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <Typography variant="h5" gutterBottom>Parâmetros de Avaliação</Typography>
                 <Button
                    variant="outlined"
                    startIcon={<FileCopyIcon />}
                    onClick={() => setIsCopyModalOpen(true)}
                 >
                    Copiar Parâmetros
                 </Button>
               </Box>
               <Paper variant="outlined" sx={{ p: 2, mt: 2 }}><Typography>Critérios de Triagem</Typography><ParametersSection criteria={parameters.triagem} onCriteriaChange={(newCriteria) => handleParametersChange('triagem', newCriteria)} /></Paper>
               <Paper variant="outlined" sx={{ p: 2, mt: 2 }}><Typography>Cultura</Typography><ParametersSection criteria={parameters.cultura} onCriteriaChange={(newCriteria) => handleParametersChange('cultura', newCriteria)} /></Paper>
               <Paper variant="outlined" sx={{ p: 2, mt: 2 }}><Typography>Técnico</Typography><ParametersSection criteria={parameters.técnico} onCriteriaChange={(newCriteria) => handleParametersChange('técnico', newCriteria)} /></Paper>
               <Paper variant="outlined" sx={{ p: 2, mt: 3 }}><Typography variant="h6" gutterBottom sx={{p: 1}}>Definição de Notas</Typography><Grid container spacing={2} sx={{p: 2}}>{parameters.notas && parameters.notas.map((nota, index) => ( <React.Fragment key={index}><Grid item xs={6}><TextField label={`Nome da Nota ${index + 1}`} value={nota.nome} onChange={(e) => handleNoteChange(index, 'nome', e.target.value)} fullWidth variant="standard" disabled={nota.fixed} /></Grid><Grid item xs={6}><TextField label={`Valor da Nota ${index + 1}`} type="number" value={nota.valor} onChange={(e) => handleNoteChange(index, 'valor', e.target.value)} fullWidth variant="standard" disabled={nota.fixed} /></Grid></React.Fragment> ))}</Grid></Paper>
               <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}><Button variant="contained" size="large" onClick={handleSaveParameters} disabled={isSaving}>{isSaving ? <CircularProgress size={24} /> : 'Salvar Parâmetros'}</Button></Box>
            </Box>
            <Box p={3} hidden={tabValue !== 2}>
              <Typography variant="h5" gutterBottom>Classificação dos Candidatos</Typography>
              {tabValue === 2 && !applicantData.loading && applicantData.data.length > 0 && (
                <ClassificationChart data={classifiedApplicants} />
              )}
              {applicantData.loading ? <CircularProgress sx={{mt: 4}} /> : applicantData.error ? <Alert severity="error">{applicantData.error}</Alert> : (
                <Table sx={{ mt: 4 }}>
                  <TableHead><TableRow><TableCell sx={{ fontWeight: 'bold' }}>Nome</TableCell><TableCell sx={{ fontWeight: 'bold' }}>Data da Inscrição</TableCell><TableCell align="right" sx={{ fontWeight: 'bold' }}>Nota Triagem</TableCell><TableCell align="right" sx={{ fontWeight: 'bold' }}>Nota Cultura</TableCell><TableCell align="right" sx={{ fontWeight: 'bold' }}>Nota Técnico</TableCell><TableCell align="right" sx={{ fontWeight: 'bold' }}>Nota Geral</TableCell><TableCell align="center" sx={{ fontWeight: 'bold' }}>Contratado?</TableCell></TableRow></TableHead>
                  <TableBody>
                    {classifiedApplicants.map(applicant => (
                      <TableRow hover key={applicant.applicationId} sx={{ backgroundColor: applicant.isHired ? '#e8f5e9' : 'transparent' }}>
                        <TableCell>{applicant.candidateName}</TableCell>
                        <TableCell>{format(parseISO(applicant.submissionDate), 'dd/MM/yyyy')}</TableCell>
                        <TableCell align="right">{applicant.notaTriagem.toFixed(1)}</TableCell>
                        <TableCell align="right">{applicant.notaCultura.toFixed(1)}</TableCell>
                        <TableCell align="right">{applicant.notaTecnico.toFixed(1)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{applicant.notaGeral.toFixed(1)}</TableCell>
                        <TableCell align="center">
                          <Checkbox
                            checked={applicant.isHired || false}
                            onChange={() => handleHiredToggle(applicant.applicationId, applicant.isHired)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
          </Paper>
        </>
      );
    }
    return null;
  };

  return (
    <Box>
      <AppBar position="static"><Toolbar><Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>{job ? `Vaga: ${job.title}` : 'Carregando Vaga...'}</Typography><Button color="inherit" component={RouterLink} to="/">Voltar para o Painel</Button></Toolbar></AppBar>
      <Container sx={{ mt: 4 }}>
        {renderContent()}
      </Container>
      
      <CopyParametersModal 
        open={isCopyModalOpen}
        onClose={() => setIsCopyModalOpen(false)}
        currentJobId={jobId}
        onCopy={handleParametersCopied}
      />
      
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
        <DialogTitle>Confirmar Exclusão</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Você tem certeza que deseja excluir a vaga <strong>"{job?.title}"</strong>? Esta ação é irreversível e excluirá todas as candidaturas e avaliações associadas.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)} disabled={isDeleting}>Cancelar</Button>
          <Button onClick={handleDeleteJob} color="error" disabled={isDeleting}>
            {isDeleting ? <CircularProgress size={24} /> : 'Excluir'}
          </Button>
        </DialogActions>
      </Dialog>
      
      <Snackbar open={feedback.open} autoHideDuration={4000} onClose={handleCloseFeedback}><Alert onClose={handleCloseFeedback} severity={feedback.severity} sx={{ width: '100%' }}>{feedback.message}</Alert></Snackbar>
    </Box>
  );
};

export default JobDetails;