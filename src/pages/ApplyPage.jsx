// src/pages/ApplyPage.jsx (VERSÃO FINAL E CORRIGIDA, COM LÓGICA FREEMIUM)
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
    Container, Box, Typography, TextField, Button, CircularProgress, Alert,
    Select, MenuItem, InputLabel, FormControl, RadioGroup, FormControlLabel, Radio, FormLabel
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { estados } from '../data/brazil-locations';

const ApplyPage = () => {
  const { jobId } = useParams();
  const [jobTitle, setJobTitle] = useState('');
  // ESTADOS RESTAURADOS
  const [isVagaClosed, setIsVagaClosed] = useState(false);
  const [loadingPage, setLoadingPage] = useState(true);
  const [errorPage, setErrorPage] = useState('');

  const [formState, setFormState] = useState({
    name: '', preferredName: '', email: '', phone: '', birthDate: null,
    state: '', city: '', hasGraduated: '', studyPeriod: '', course: '',
    institution: '', completionYear: '', englishLevel: '', spanishLevel: '',
    source: '', motivation: '', linkedinProfile: '', githubProfile: ''
  });
  const [resumeFile, setResumeFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // LÓGICA DO USEEFFECT RESTAURADA E CORRIGIDA
  useEffect(() => {
    const fetchJobData = async () => {
      if (!jobId) {
        setErrorPage('ID da vaga não especificado na URL.');
        setLoadingPage(false);
        return;
      }
      try {
        const response = await fetch(`/api/getPublicJobData?id=${jobId}`);
        if (!response.ok) throw new Error('Vaga não encontrada ou ocorreu um erro no servidor.');
        const data = await response.json();
        
        if (data.job) {
          if (data.job.planId === 'freemium' && data.job.candidateCount >= 3) {
            setIsVagaClosed(true);
          }
          setJobTitle(data.job.title);
        } else {
            throw new Error('Dados da vaga não encontrados.');
        }
      } catch (error) {
        setErrorPage(error.message);
        console.error(error);
      } finally {
        setLoadingPage(false);
      }
    };
    fetchJobData();
  }, [jobId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormState(prevState => ({ ...prevState, [name]: value }));
  };
  const handleDateChange = (newDate) => { setFormState(prevState => ({ ...prevState, birthDate: newDate })); };
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setResumeFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback({ type: '', message: '' });

    if (!resumeFile) {
      setFeedback({ type: 'error', message: 'Por favor, anexe seu currículo.' });
      setIsSubmitting(false);
      return;
    }

    const formData = new FormData();
    formData.append('jobId', jobId);
    for (const key in formState) {
      if (formState[key]) {
        if (key === 'birthDate') { formData.append(key, formState[key].toISOString()); } 
        else { formData.append(key, formState[key]); }
      }
    }
    formData.append('resume', resumeFile);

    try {
      const response = await fetch('/api/apply', { method: 'POST', body: formData });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ocorreu um erro ao enviar sua candidatura.');
      }
      setFeedback({ type: 'success', message: 'Candidatura enviada com sucesso! Agradecemos o seu interesse.' });
    } catch (error) {
      console.error("Erro na submissão:", error);
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // RENDERIZAÇÃO CONDICIONAL RESTAURADA
  if (loadingPage) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', my: 8 }}><CircularProgress /></Box>;
  }
  if (errorPage) {
    return <Container maxWidth="sm" sx={{mt: 8}}><Alert severity="error">{errorPage}</Alert></Container>;
  }
  if (feedback.type === 'success') {
    return (
        <Container maxWidth="sm" sx={{ textAlign: 'center', mt: 8 }}>
            <Typography variant="h4" gutterBottom>Obrigado!</Typography>
            <Alert severity="success">{feedback.message}</Alert>
        </Container>
    );
  }
  if (isVagaClosed) {
    return (
        <Container maxWidth="sm" sx={{ textAlign: 'center', mt: 8 }}>
            <Typography variant="h4" gutterBottom>Vaga Encerrada</Typography>
            <Alert severity="warning">
              Agradecemos o seu interesse, mas esta vaga já atingiu o número máximo de candidaturas.
            </Alert>
        </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>Candidatura à Vaga</Typography>
        <Typography variant="h6" color="text.secondary">{jobTitle}</Typography>
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 3, borderTop: '1px solid #ddd', pt: 3 }}>
          <TextField name="name" label="Nome Completo" required fullWidth margin="normal" onChange={handleInputChange} />
          <TextField name="preferredName" label="Como prefere ser chamado(a)?" fullWidth margin="normal" onChange={handleInputChange} />
          <TextField name="email" label="Seu melhor e-mail" type="email" required fullWidth margin="normal" onChange={handleInputChange} />
          <TextField name="phone" label="Número de telefone (celular)" type="tel" required fullWidth margin="normal" onChange={handleInputChange} />
          <DatePicker label="Data de Nascimento" sx={{ width: '100%', mt: 2, mb: 1 }} value={formState.birthDate} onChange={handleDateChange} />
          <FormControl fullWidth margin="normal" required><InputLabel id="state-label">Em que estado você mora?</InputLabel><Select labelId="state-label" name="state" value={formState.state} label="Em que estado você mora?" onChange={handleInputChange}>{estados.map(estado => <MenuItem key={estado.sigla} value={estado.sigla}>{estado.nome}</MenuItem>)}</Select></FormControl>
          <TextField name="city" label="Em que cidade você mora?" required fullWidth margin="normal" onChange={handleInputChange} />
          <FormControl component="fieldset" margin="normal" required><FormLabel component="legend">Você já concluiu algum curso de nível superior?</FormLabel><RadioGroup row name="hasGraduated" value={formState.hasGraduated} onChange={handleInputChange}><FormControlLabel value="sim" control={<Radio />} label="Sim, já concluí" /><FormControlLabel value="nao" control={<Radio />} label="Não, estou cursando" /></RadioGroup></FormControl>
          {formState.hasGraduated === 'nao' && (<TextField name="studyPeriod" label="Em que período/ano você está?" fullWidth margin="normal" onChange={handleInputChange} />)}
          {formState.hasGraduated && (<><TextField name="course" label="Qual o curso?" required={!!formState.hasGraduated} fullWidth margin="normal" onChange={handleInputChange} /><TextField name="institution" label="Em qual faculdade/instituição?" required={!!formState.hasGraduated} fullWidth margin="normal" onChange={handleInputChange} />{formState.hasGraduated === 'sim' && ( <TextField name="completionYear" label="Ano de Conclusão" type="number" fullWidth margin="normal" onChange={handleInputChange} />)}</>)}
          {['englishLevel', 'spanishLevel'].map(lang => (<FormControl fullWidth margin="normal" key={lang}><InputLabel>{lang === 'englishLevel' ? 'Nível de Inglês' : 'Nível de Espanhol'}</InputLabel><Select name={lang} value={formState[lang] || ''} label={lang === 'englishLevel' ? 'Nível de Inglês' : 'Nível de Espanhol'} onChange={handleInputChange}><MenuItem value="basico">Básico</MenuItem><MenuItem value="intermediario">Intermediário</MenuItem><MenuItem value="avancado">Avançado</MenuItem><MenuItem value="fluente">Fluente/Nativo</MenuItem></Select></FormControl>))}
          <TextField name="source" label="Como ficou sabendo da vaga?" fullWidth margin="normal" onChange={handleInputChange} />
          <TextField name="motivation" label="Por que você deseja fazer parte do nosso time?" required multiline rows={4} fullWidth margin="normal" onChange={handleInputChange} />
          <TextField name="linkedinProfile" label="Link do seu perfil no LinkedIn" fullWidth margin="normal" onChange={handleInputChange} />
          <TextField name="githubProfile" label="Link do seu perfil no GitHub" fullWidth margin="normal" onChange={handleInputChange} />
          <Button variant="outlined" component="label" sx={{ mt: 2, mb: 1, width: '100%' }}>Anexe o seu currículo (PDF, DOC, DOCX)<input type="file" hidden required accept=".pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFileChange} /></Button>
          {resumeFile && <Typography variant="body2" textAlign="center" color="text.secondary">{resumeFile.name}</Typography>}
          
          {feedback.type && <Alert severity={feedback.type} sx={{ mt: 2 }}>{feedback.message}</Alert>}
          
          <Button type="submit" fullWidth variant="contained" size="large" sx={{ mt: 3, mb: 2 }} disabled={isSubmitting}>{isSubmitting ? <CircularProgress size={24} /> : 'Enviar Candidatura'}</Button>
        </Box>
      </Box>
    </Container>
  );
};

export default ApplyPage;