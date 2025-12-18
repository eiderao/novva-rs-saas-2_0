// src/pages/ApplicationDetails.jsx (VERSÃO FINAL, COMPLETA E CORRIGIDA)
import EvaluationDashboardV2 from '../components/evaluation_v2/EvaluationDashboardV2';
import { useAuth } from '../context/AuthContext'; // Para pegar o usuário logado
import React, { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { supabase } from '../supabase/client';
// Importa as funções centralizadas
import { formatUrl, formatPhone, formatDate } from '../utils/formatters';
import { 
    Container, Typography, Box, AppBar, Toolbar, Button, CircularProgress, 
    Alert, Paper, Grid, Link, Divider, List, ListItem, ListItemText,
    FormControl, InputLabel, Select, MenuItem, TextField, Snackbar
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

// O componente de seção de parâmetros, que já está estável.
// NOTE: Este componente não existe neste arquivo, ele está no JobDetails.jsx
// Removendo-o daqui para evitar confusão, já que ele não é usado aqui.

// O componente de seção de avaliação, com a lógica de ID único que você sugeriu.
const EvaluationSection = ({ title, criteria = [], notes = [], evaluationData = {}, onEvaluationChange, onNotesChange }) => {
  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Typography variant="h6" sx={{textTransform: 'capitalize'}}>{title}</Typography>
      {criteria.map((criterion) => (
        <Box key={`${title}-${criterion.name}`} sx={{ mt: 2 }}>
          <FormControl fullWidth>
            <InputLabel>{criterion.name} (Peso: {criterion.weight}%)</InputLabel>
            <Select
              value={evaluationData[criterion.name] || ''}
              label={`${criterion.name} (Peso: ${criterion.weight}%)`}
              onChange={(e) => onEvaluationChange(title.toLowerCase(), criterion.name, e.target.value)}
              variant="standard"
            >
              {notes.map((note) => (
                <MenuItem key={note.id} value={note.id}>{note.nome} ({note.valor})</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      ))}
      <TextField
        label="Anotações"
        multiline
        rows={3}
        fullWidth
        variant="standard"
        sx={{ mt: 2 }}
        value={evaluationData.anotacoes || ''}
        onChange={(e) => onNotesChange(title.toLowerCase(), e.target.value)}
      />
    </Paper>
  );
};

// O componente principal, com a lógica de estado e carregamento CORRIGIDA.
const ApplicationDetails = () => {
  const { jobId, applicationId } = useParams();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [evaluation, setEvaluation] = useState(null); // Corrigido: Inicia como nulo
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'success' });
  
  useEffect(() => {
    const fetchDetails = async () => {
      if (!applicationId) { setError("ID da candidatura não encontrado."); setLoading(false); return; }
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Sessão não encontrada.");
        const appResponse = await fetch(`/api/getApplicationDetails?applicationId=${applicationId}`, { headers: { 'Authorization': `Bearer ${session.access_token}` } });
        if (!appResponse.ok) { const errorData = await appResponse.json(); throw new Error(errorData.error || "Não foi possível buscar os detalhes."); }
        const appData = await appResponse.json();
        
        if (appData.application) {
          setApplication(appData.application);

          // CORREÇÃO: Lógica robusta para carregar a avaliação salva ou criar uma estrutura vazia.
          const savedEvaluation = appData.application.evaluation;
          setEvaluation({
            triagem: savedEvaluation?.triagem || {},
            cultura: savedEvaluation?.cultura || {},
            técnico: savedEvaluation?.técnico || {},
          });

          const filePath = appData.application.resumeUrl;
          if (filePath) {
            const urlResponse = await fetch(`/api/getResumeSignedUrl?filePath=${filePath}`, { headers: { 'Authorization': `Bearer ${session.access_token}` } });
            if (!urlResponse.ok) { throw new Error("Não foi possível gerar o link do currículo."); }
            const urlData = await urlResponse.json();
            setResumeUrl(urlData.signedUrl);
          }
        } else { throw new Error("Dados da candidatura recebidos são inválidos."); }
      } catch (err) { console.error("Erro ao carregar detalhes:", err); setError(err.message); } 
      finally { setLoading(false); }
    };
    fetchDetails();
  }, [applicationId]);
  
  const handleEvaluationChange = (section, criterionName, noteId) => {
    setEvaluation(prevEval => ({ ...prevEval, [section]: { ...prevEval[section], [criterionName]: noteId } }));
  };
  const handleNotesChange = (section, text) => {
    setEvaluation(prevEval => ({ ...prevEval, [section]: { ...prevEval[section], anotacoes: text } }));
  };
  const handleCloseFeedback = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setFeedback({ open: false, message: '' });
  };

  const handleSaveEvaluation = async () => {
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Você não está autenticado.");
      const response = await fetch('/api/saveEvaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ applicationId: applicationId, evaluation: evaluation }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Não foi possível salvar a avaliação.");
      }
      setFeedback({ open: true, message: 'Avaliação salva com sucesso!', severity: 'success' });
    } catch (err) {
      console.error("Erro ao salvar avaliação:", err);
      setFeedback({ open: true, message: err.message, severity: 'error' });
    } finally {
      setIsSaving(false);
    }
  };
  
  const renderContent = () => {
    if (loading) { return <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}><CircularProgress /></Box>; }
    if (error) { return <Alert severity="error">{error}</Alert>; }
    if (application && evaluation) {
      const { candidate, job, formData } = application;
      const displayFields = [
        { key: 'preferredName', label: 'Como prefere ser chamado(a)?' }, { key: 'birthDate', label: 'Data de Nascimento', format: formatDate },
        { key: 'state', label: 'Estado' }, { key: 'city', label: 'Cidade' },
        { key: 'hasGraduated', label: 'Concluiu curso superior?', format: (val) => val === 'sim' ? 'Sim, já concluí' : 'Não, estou cursando' },
        { key: 'studyPeriod', label: 'Período que estuda' }, { key: 'course', label: 'Curso' },
        { key: 'institution', label: 'Instituição' }, { key: 'completionYear', label: 'Ano de Conclusão' },
        { key: 'englishLevel', label: 'Nível de Inglês' }, { key: 'spanishLevel', label: 'Nível de Espanhol' },
        { key: 'source', label: 'Como soube da vaga?' }, { key: 'motivation', label: 'Motivação' },
      ];

      return (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Typography variant="h5" gutterBottom>{candidate.name}</Typography>
              <Typography variant="body1" sx={{ wordBreak: 'break-all' }}><strong>E-mail:</strong> {candidate.email}</Typography>
              <Typography variant="body1"><strong>Telefone:</strong> {formatPhone(formData.phone)}</Typography>
              <Divider sx={{ my: 2 }} />
              {formData.linkedinProfile && <Link href={formatUrl(formData.linkedinProfile)} target="_blank" rel="noopener" display="block">Perfil no LinkedIn</Link>}
              {formData.githubProfile && <Link href={formatUrl(formData.githubProfile)} target="_blank" rel="noopener" display="block">Perfil no GitHub</Link>}
              <Box mt={2}><Button variant="contained" href={resumeUrl} target="_blank" disabled={!resumeUrl}> Ver Currículo </Button></Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Typography variant="h6" gutterBottom>Respostas do Formulário</Typography>
              <Grid container spacing={2}>
                {displayFields.map((field) => {
                  const value = formData[field.key];
                  if (value) {
                    return (
                      <Grid item xs={12} sm={6} key={field.key}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{field.label}</Typography>
                        <Typography variant="body1">{field.format ? field.format(value) : (value || 'Não informado')}</Typography>
                      </Grid>
                    );
                  }
                  return null;
                })}
              </Grid>
            </Paper>
          </Grid>
          <Grid item xs={12}>
             <Paper sx={{ p: 2, mt: 2 }}>
                <Typography variant="h5" gutterBottom>Avaliação</Typography>
                <EvaluationSection title="Triagem" criteria={job.parameters.triagem} notes={job.parameters.notas} evaluationData={evaluation.triagem} onEvaluationChange={handleEvaluationChange} onNotesChange={handleNotesChange} />
                <EvaluationSection title="Cultura" criteria={job.parameters.cultura} notes={job.parameters.notas} evaluationData={evaluation.cultura} onEvaluationChange={handleEvaluationChange} onNotesChange={handleNotesChange} />
                <EvaluationSection title="Técnico" criteria={job.parameters.técnico} notes={job.parameters.notas} evaluationData={evaluation.técnico} onEvaluationChange={handleEvaluationChange} onNotesChange={handleNotesChange} />
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button variant="contained" size="large" onClick={handleSaveEvaluation} disabled={isSaving}>
                    {isSaving ? <CircularProgress size={24} color="inherit"/> : 'Salvar Avaliação'}
                  </Button>
                </Box>
              </Paper>
           </Grid>
        </Grid>
      );
    }
    return null;
  };
  
  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {application ? `Candidato: ${application.candidate.name}` : 'Carregando Candidatura...'}
          </Typography>
          <Button color="inherit" component={RouterLink} to={`/vaga/${jobId}`}> Voltar para a Vaga </Button>
        </Toolbar>
      </AppBar>
      <Container sx={{ mt: 4 }}>
        {renderContent()}
      </Container>
      <Snackbar open={feedback.open} autoHideDuration={4000} onClose={handleCloseFeedback}>
        <Alert onClose={handleCloseFeedback} severity={feedback.severity} sx={{ width: '100%' }}>
          {feedback.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ApplicationDetails;