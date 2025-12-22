import React, { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { formatUrl, formatPhone } from '../utils/formatters';
import { 
    Container, Typography, Box, AppBar, Toolbar, Button, CircularProgress, 
    Alert, Paper, Grid, Divider, Tabs, Tab
} from '@mui/material';
import EvaluationForm from '../components/evaluation_v2/EvaluationForm'; // Importa o novo form

const ApplicationDetails = () => {
  const { jobId, applicationId } = useParams();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [tabValue, setTabValue] = useState(0); 
  const [myEvaluation, setMyEvaluation] = useState(null);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Sessão não encontrada.");

        // 1. Busca Detalhes da Aplicação
        // Note: Usando a API getApplicationDetails que já existia ou fazendo direto. 
        // Vamos fazer fetch direto para garantir que pegamos os parâmetros da vaga atualizados.
        const { data: appData, error: appError } = await supabase
            .from('applications')
            .select(`
                *,
                candidate:candidates(*),
                job:jobs(parameters, title)
            `)
            .eq('id', applicationId)
            .single();
        
        if (appError) throw appError;
        setApplication(appData);

        // 2. Busca Minha Avaliação Existente (Se houver)
        const { data: evalData } = await supabase
            .from('evaluations')
            .select('*')
            .eq('application_id', applicationId)
            .eq('evaluator_id', session.user.id)
            .maybeSingle();
            
        if (evalData) setMyEvaluation(evalData);

        // 3. URL do Currículo
        if (appData.resumeUrl) {
            const urlResponse = await fetch(`/api/getResumeSignedUrl?filePath=${appData.resumeUrl}`, { 
                headers: { 'Authorization': `Bearer ${session.access_token}` } 
            });
            const urlData = await urlResponse.json();
            if (urlData.signedUrl) setResumeUrl(urlData.signedUrl);
        }

      } catch (err) {
        console.error(err);
        setError(err.message || "Erro ao carregar.");
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
          {/* Coluna Esquerda: Info do Candidato */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h5" gutterBottom>{candidate.name}</Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>{candidate.email}</Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>{formatPhone(formData?.phone)}</Typography>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="subtitle2">Cidade</Typography>
              <Typography variant="body2" gutterBottom>{formData?.city || candidate.city} - {formData?.state || candidate.state}</Typography>

              {formData?.linkedinProfile && (
                  <Button sx={{mt: 1, justifyContent: 'flex-start'}} fullWidth href={formatUrl(formData.linkedinProfile)} target="_blank">LinkedIn</Button>
              )}
              
              <Box mt={3}>
                <Button variant="contained" fullWidth href={resumeUrl} target="_blank" disabled={!resumeUrl}>
                    Ver Currículo (PDF)
                </Button>
              </Box>
            </Paper>
          </Grid>

          {/* Coluna Direita: Abas de Dados e Avaliação */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ width: '100%', minHeight: '500px' }}>
                <Tabs value={tabValue} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: '#f9fafb' }}>
                    <Tab label="Dados do Formulário" />
                    <Tab label="Minha Avaliação (V2.0)" />
                </Tabs>

                {/* Aba 0: Dados do Formulário */}
                <Box p={3} hidden={tabValue !== 0}>
                    <Grid container spacing={2}>
                        {Object.entries(formData || {}).map(([key, value]) => {
                            if(key === 'linkedinProfile' || key === 'githubProfile') return null;
                            return (
                                <Grid item xs={12} sm={6} key={key}>
                                    <Typography variant="caption" display="block" color="textSecondary" sx={{textTransform:'capitalize', fontWeight: 'bold'}}>
                                        {key.replace(/([A-Z])/g, ' $1').trim()}
                                    </Typography>
                                    <Typography variant="body1" sx={{mb: 1}}>{String(value)}</Typography>
                                </Grid>
                            )
                        })}
                    </Grid>
                </Box>

                {/* Aba 1: Formulário de Avaliação */}
                <Box p={3} hidden={tabValue !== 1}>
                    <EvaluationForm 
                        applicationId={application.id}
                        jobParameters={job.parameters || {}}
                        initialData={myEvaluation}
                        onSaved={() => alert('Avaliação salva com sucesso!')} 
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
          <Button color="inherit" component={RouterLink} to={`/jobs/${jobId}`}>Voltar para Vaga</Button>
        </Toolbar>
      </AppBar>
      <Container sx={{ mt: 4, mb: 4 }}>
        {renderContent()}
      </Container>
    </Box>
  );
};

export default ApplicationDetails;