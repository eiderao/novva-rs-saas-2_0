import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import { 
    Dialog, DialogTitle, DialogContent, List, ListItem, 
    ListItemText, ListItemButton, CircularProgress, 
    Typography, Alert, Box 
} from '@mui/material';
import { Copy } from 'lucide-react';

export default function CopyParametersModal({ open, onClose, onSelect }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      fetchJobs();
    }
  }, [open]);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('user_profiles').select('tenantId').eq('id', user.id).single();
      
      if (profile?.tenantId) {
        const { data } = await supabase
          .from('jobs')
          .select('id, title, created_at, parameters')
          .eq('tenantId', profile.tenantId)
          .order('created_at', { ascending: false })
          .limit(20);
        
        setJobs(data || []);
      }
    } catch (err) {
      setError('Erro ao carregar vagas anteriores.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectJob = (job) => {
    if (job.parameters) {
      onSelect(job.parameters);
      onClose();
    } else {
      setError('Esta vaga nÃ£o possui parÃ¢metros salvos.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Copy size={20} />
        Copiar CritÃ©rios de AvaliaÃ§Ã£o
      </DialogTitle>
      <DialogContent dividers>
        {loading && <Box display="flex" justifyContent="center" p={3}><CircularProgress /></Box>}
        
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        {!loading && jobs.length === 0 && (
          <Typography color="text.secondary" align="center" py={4}>
            Nenhuma vaga anterior encontrada.
          </Typography>
        )}

        <List>
          {!loading && jobs.map((job) => (
            <ListItem disablePadding key={job.id} divider>
              <ListItemButton onClick={() => handleSelectJob(job)}>
                <ListItemText 
                  primary={job.title} 
                  secondary={`Criada em: ${new Date(job.created_at).toLocaleDateString()}`} 
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
}