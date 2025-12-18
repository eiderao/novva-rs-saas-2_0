// src/pages/Login.jsx
import React, { useState } from 'react';
import { supabase } from '../supabase/client'; // Importa nosso novo cliente Supabase
import { Container, Box, TextField, Button, Typography, CircularProgress, Alert } from '@mui/material';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // A nova função de login do Supabase
            const { error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) throw error;
            // O redirecionamento para o Dashboard é tratado automaticamente pelo AuthContext
        } catch (err) {
            setError('E-mail ou senha inválidos. Por favor, tente novamente.');
            console.error("Erro de autenticação:", err.message);
        } finally {
            setLoading(false);
        }
    };

    // O restante do JSX (a parte visual) continua exatamente o mesmo
    return (
        <Container component="main" maxWidth="xs">
            <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Typography component="h1" variant="h4" sx={{ mb: 3, fontWeight: 'bold' }}>Novva R&S</Typography>
                <Typography component="p" variant="subtitle1" color="text.secondary">Bem-vindo(a)!</Typography>
                <Box component="form" onSubmit={handleLogin} noValidate sx={{ mt: 1 }}>
                    <TextField margin="normal" required fullWidth id="email" label="Endereço de E-mail" name="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
                    <TextField margin="normal" required fullWidth name="password" label="Senha" type="password" id="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    {error && <Alert severity="error" sx={{ mt: 2, width: '100%' }}>{error}</Alert>}
                    <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2, py: 1.5 }} disabled={loading}>
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Entrar'}
                    </Button>
                </Box>
            </Box>
        </Container>
    );
};

export default LoginPage;