// src/pages/HiredPage.jsx (Versão Corrigida)
import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { format, parseISO } from 'date-fns';
import {
    Container,
    Typography,
    Box,
    AppBar,
    Toolbar,
    Button,
    CircularProgress,
    Alert,
    Paper,
    List,
    ListItem,
    ListItemText,
    Divider,
} from '@mui/material';

const HiredPage = () => {
    const [hiredData, setHiredData] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchHired = async () => {
            setLoading(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) throw new Error("Sessão não encontrada.");
                const response = await fetch('/api/getHiredApplicants', {
                    headers: { 'Authorization': `Bearer ${session.access_token}` },
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || "Não foi possível buscar os candidatos aprovados.");
                }
                const data = await response.json();
                const groupedByJob = (data.hired || []).reduce((acc, application) => {
                    const jobTitle = application.job.title;
                    if (!acc[jobTitle]) {
                        acc[jobTitle] = [];
                    }
                    acc[jobTitle].push(application);
                    return acc;
                }, {});
                setHiredData(groupedByJob);
            } catch (err) {
                console.error("Erro ao buscar aprovados:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchHired();
    }, []);

    const formatPhone = (phone) => {
        if (!phone) return 'Não informado';
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 11) { return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`; }
        if (cleaned.length === 10) { return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 6)}-${cleaned.substring(6)}`; }
        return phone;
    };

    const renderContent = () => {
        if (loading) {
            return <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}><CircularProgress /></Box>;
        }
        if (error) {
            return <Alert severity="error">{error}</Alert>;
        }
        if (Object.keys(hiredData).length === 0) {
            return <Typography sx={{ mt: 3, textAlign: 'center' }}>Nenhum candidato foi marcado como contratado ainda.</Typography>;
        }
        return (
            <Box>
                {Object.entries(hiredData).map(([jobTitle, applications]) => (
                    <Paper key={jobTitle} sx={{ my: 3, p: 2 }}>
                        <Typography variant="h5" gutterBottom>{jobTitle}</Typography>
                        <List>
                            {applications.map((app, index) => (
                                <React.Fragment key={app.id}>
                                    <ListItem>
                                        <ListItemText
                                            primary={app.candidate.name}
                                            secondary={
                                                <>
                                                    <Typography component="span" variant="body2" color="text.primary">
                                                        Email: {app.candidate.email}
                                                    </Typography>
                                                    <br />
                                                    <Typography component="span" variant="body2" color="text.primary">
                                                        Telefone: {formatPhone(app.formData.phone)}
                                                    </Typography>
                                                    <br />
                                                    <Typography component="span" variant="body2" color="text.secondary">
                                                        {/* AQUI ESTÁ A CORREÇÃO DA REGRESSÃO */}
                                                        Aprovado em: {app.hiredAt ? format(parseISO(app.hiredAt), 'dd/MM/yyyy') : 'Data não registrada'}
                                                    </Typography>
                                                </>
                                            }
                                        />
                                    </ListItem>
                                    {index < applications.length - 1 && <Divider />}
                                </React.Fragment>
                            ))}
                        </List>
                    </Paper>
                ))}
            </Box>
        );
    };

    return (
        <Box>
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        Candidatos Aprovados
                    </Typography>
                    <Button color="inherit" component={RouterLink} to="/">
                        Voltar para o Painel
                    </Button>
                </Toolbar>
            </AppBar>
            <Container sx={{ mt: 4 }}>
                {renderContent()}
            </Container>
        </Box>
    );
};

export default HiredPage;