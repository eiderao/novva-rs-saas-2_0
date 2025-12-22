import React, { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { formatUrl, formatPhone, formatDate } from '../utils/formatters';
import { 
    Container, Typography, Box, AppBar, Toolbar, Button, CircularProgress, 
    Alert, Paper, Grid, Divider, Snackbar, Tabs, Tab
} from '@mui/material';
import EvaluationForm from '../components/evaluation_v2/EvaluationForm'; // O novo componente

const ApplicationDetails = () => {
  const { jobId, applicationId } = useParams();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [tabValue, setTabValue] = useState(0); // Controle de Abas (Dados vs Avaliação)
  
  // Estado da avaliação do usuário logado
  const [myEvaluation, setMyEvaluation] = useState(null);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Sessão não encontrada.");

        // 1. Busca Detalhes da Aplicação
        const appResponse = await fetch(`/api/getApplicationDetails?applicationId=${applicationId}`, { 
            headers: { 'Authorization': `Bearer ${session.access_token}` } 
        });
        
        const appData = await appResponse.json();
        if (!appResponse.ok) throw new Error(appData.error || "Erro ao buscar detalhes.");
        
        setApplication(appData.application);

        // 2. Busca Minha Avaliação Existente (Se houver)
        const { data: evalData } = await supabase
            .from('evaluations')
            .select('*')
            .eq('application_id', applicationId)
            .eq('evaluator_id', session.user.id)
            .maybeSingle(); // maybeSingle não dá erro se não achar
            
        if (evalData) setMyEvaluation(evalData);

        // 3. URL do Currículo
        if (appData.application?.resumeUrl) {
            const urlResponse = await fetch(`/api/getResumeSignedUrl?filePath=${appData.application.resumeUrl}`, { 
                headers: { 'Authorization': `Bearer ${session.access_token}` } 
            });
            const urlData = await urlResponse.json();
            if (urlData.signedUrl) setResumeUrl(urlData.signedUrl);
        }

      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [applicationId]);

  const handleTabChange = (event, newValue) => setTabValue(newValue);

  const renderContent = () => {
    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}><CircularProgress /></Box>;
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!application) return null;

    const { candidate, job, formData } = application;

    return (
        <Grid container spacing={3}>
          {/* Coluna Esquerda: Dados do Candidato */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h5" gutterBottom>{candidate.name}</Typography>
              <Typography variant="body2" color="textSecondary">{candidate.email}</Typography>
              <Typography variant="body2" color="textSecondary">{formatPhone(formData?.phone)}</Typography>
              <Divider sx={{ my: 2 }} />
              <Button variant="outlined" fullWidth href={resumeUrl} target="_blank" disabled={!resumeUrl}>
                Ver Currículo
              </Button>
            </Paper>
          </Grid>

          {/* Coluna Direita: Abas */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ width: '100%' }}>
                <Tabs value={tabValue} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tab label="Dados do Formulário" />
                    <Tab label="Minha Avaliação" />
                </Tabs>

                {/* Aba 0: Dados */}
                <Box p={3} hidden={tabValue !== 0}>
                    <Grid container spacing={2}>
                        {Object.entries(formData || {}).map(([key, value]) => (
                            <Grid item xs={6} key={key}>
                                <Typography variant="caption" display="block" color="textSecondary" sx={{textTransform:'capitalize'}}>
                                    {key.replace(/([A-Z])/g, ' $1').trim()}
                                </Typography>
                                <Typography variant="body1">{String(value)}</Typography>
                            </Grid>
                        ))}
                    </Grid>
                </Box>

                {/* Aba 1: Avaliação V2 (Novo Componente) */}
                <Box p={3} hidden={tabValue !== 1}>
                    <EvaluationForm 
                        applicationId={application.id}
                        jobParameters={job.parameters || {}}
                        initialData={myEvaluation}
                        onSaved={() => alert('Avaliação salva com sucesso!')} // Pode melhorar com Snackbar depois
                    />
                </Box>
            </Paper>
          </Grid>
        </Grid>
    );
  };
  
  return (
    <Box>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Avaliação de Candidato
          </Typography>
          <Button color="inherit" component={RouterLink} to={`/vaga/${jobId}`}>Voltar</Button>
        </Toolbar>
      </AppBar>
      <Container sx={{ mt: 4 }}>
        {renderContent()}
      </Container>
    </Box>
  );
};

export default ApplicationDetails;