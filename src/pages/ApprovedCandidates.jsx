import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { Box, Typography, Paper, Grid, Avatar, IconButton, Tooltip, CircularProgress, Button, Snackbar, Alert, Chip, Divider } from '@mui/material';
import { Phone, Mail, MessageCircle, Copy, Briefcase, MapPin, CheckCircle, ArrowLeft } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { formatPhone } from '../utils/formatters';

export default function ApprovedCandidates() {
  const navigate = useNavigate();
  const [groupedCandidates, setGroupedCandidates] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ open: false, msg: '' });

  useEffect(() => {
    fetchApproved();
  }, []);

  const fetchApproved = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Consome a API existente que já traz os contratados do tenant
      const response = await fetch('/api/getHiredApplicants', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) throw new Error('Erro ao buscar aprovados');
      
      const { hired } = await response.json();

      // Agrupa por Título da Vaga
      const grouped = (hired || []).reduce((acc, app) => {
        const jobTitle = app.job?.title || 'Vaga não identificada';
        if (!acc[jobTitle]) acc[jobTitle] = [];
        
        // Normaliza dados de contato (Candidato vs FormData)
        const contactData = {
          ...app.candidate,
          phone: app.candidate?.phone || app.formData?.phone,
          city: app.candidate?.city || app.formData?.city,
          state: app.candidate?.state || app.formData?.state,
          hiredAt: app.hiredAt
        };

        acc[jobTitle].push(contactData);
        return acc;
      }, {});

      setGroupedCandidates(grouped);
    } catch (err) {
      console.error("Erro:", err);
      setToast({ open: true, msg: 'Erro ao carregar candidatos aprovados.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setToast({ open: true, msg: `${label} copiado!` });
  };

  const getWhatsAppUrl = (phone) => {
    if (!phone) return '#';
    const numbers = phone.replace(/\D/g, '');
    return `https://wa.me/55${numbers}`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const jobKeys = Object.keys(groupedCandidates);

  return (
    <Box sx={{ p: 4, bgcolor: '#f8f9fa', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
            <Button onClick={() => navigate('/')} startIcon={<ArrowLeft size={16}/>} sx={{ mb: 1, color: 'text.secondary', textTransform: 'none' }}>
                Voltar ao Dashboard
            </Button>
            <Typography variant="h4" fontWeight="800" color="#1e293b" sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <CheckCircle size={32} className="text-green-600" /> 
                Candidatos Aprovados
            </Typography>
            <Typography variant="body1" color="text.secondary">
                Lista de profissionais marcados como contratados/aprovados.
            </Typography>
        </Box>
      </Box>

      {jobKeys.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 4, bgcolor: 'white' }} variant="outlined">
            <Briefcase size={48} className="mx-auto text-gray-300 mb-2" />
            <Typography variant="h6" color="text.secondary">Nenhum candidato aprovado ainda.</Typography>
            <Typography variant="body2" color="text.disabled">
                Avalie os candidatos nas vagas e marque a opção "Contratado" para que apareçam aqui.
            </Typography>
        </Paper>
      ) : (
        jobKeys.map((jobTitle) => (
          <Box key={jobTitle} sx={{ mb: 5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, ml: 1 }}>
                <Chip 
                    label={jobTitle} 
                    color="primary" 
                    sx={{ fontWeight: 'bold', fontSize: '1rem', py: 2.5, px: 2, borderRadius: 2 }} 
                    icon={<Briefcase size={18} />} 
                />
                <Typography variant="caption" color="text.secondary" fontWeight="bold">
                    {groupedCandidates[jobTitle].length} {groupedCandidates[jobTitle].length === 1 ? 'Profissional' : 'Profissionais'}
                </Typography>
            </Box>

            <Grid container spacing={3}>
              {groupedCandidates[jobTitle].map((candidate, index) => (
                <Grid item xs={12} md={6} lg={4} key={index}>
                  <Paper 
                      elevation={0}
                      sx={{ 
                          p: 3, 
                          borderRadius: 3, 
                          border: '1px solid #e2e8f0',
                          bgcolor: 'white',
                          transition: 'all 0.2s',
                          '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }
                      }}
                  >
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <Avatar sx={{ width: 56, height: 56, bgcolor: '#e0f2f1', color: '#00695c', fontWeight: 'bold', fontSize: '1.5rem' }}>
                            {candidate.name?.[0]?.toUpperCase()}
                        </Avatar>
                        <Box>
                            <Typography variant="h6" fontWeight="bold" lineHeight={1.2}>
                                {candidate.name}
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', mt: 0.5 }}>
                                <MapPin size={12} /> {candidate.city ? `${candidate.city} - ${candidate.state}` : 'Localização não informada'}
                            </Typography>
                        </Box>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {/* Email */}
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#f8fafc', p: 1.5, borderRadius: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, overflow: 'hidden' }}>
                              <Mail size={18} className="text-gray-400" />
                              <Typography variant="body2" noWrap title={candidate.email} sx={{ fontWeight: 500, color: '#334155' }}>
                                  {candidate.email}
                              </Typography>
                          </Box>
                          <Tooltip title="Copiar E-mail">
                              <IconButton size="small" onClick={() => handleCopy(candidate.email, 'E-mail')}>
                                  <Copy size={16} />
                              </IconButton>
                          </Tooltip>
                      </Box>

                      {/* Telefone */}
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#f8fafc', p: 1.5, borderRadius: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Phone size={18} className="text-gray-400" />
                              <Typography variant="body2" sx={{ fontWeight: 500, color: '#334155' }}>
                                  {formatPhone(candidate.phone)}
                              </Typography>
                          </Box>
                          <Box>
                              <Tooltip title="Copiar Telefone">
                                  <IconButton size="small" onClick={() => handleCopy(candidate.phone, 'Telefone')}>
                                      <Copy size={16} />
                                  </IconButton>
                              </Tooltip>
                              <Tooltip title="Chamar no WhatsApp">
                                  <IconButton size="small" color="success" onClick={() => window.open(getWhatsAppUrl(candidate.phone), '_blank')}>
                                      <MessageCircle size={18} />
                                  </IconButton>
                              </Tooltip>
                          </Box>
                      </Box>
                    </Box>

                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px dashed #e2e8f0' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
                            Aprovado em: {candidate.hiredAt ? format(parseISO(candidate.hiredAt), 'dd/MM/yyyy') : 'Data não registrada'}
                        </Typography>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        ))
      )}
      
      <Snackbar 
        open={toast.open} 
        autoHideDuration={3000} 
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" sx={{ width: '100%' }}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}