import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { format, parseISO } from 'date-fns';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Loader2, ArrowLeft } from 'lucide-react';

const HiredPage = () => {
    const [hiredData, setHiredData] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchHired = async () => {
            setLoading(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return; // AuthContext lida com redirect
       
                const response = await fetch('/api/getHiredApplicants', {
                    headers: { 'Authorization': `Bearer ${session.access_token}` },
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || "Erro ao buscar aprovados.");
                }
                const data = await response.json();
                
                // Agrupa por Vaga
                const groupedByJob = (data.hired || []).reduce((acc, application) => {
                    const jobTitle = application.job.title;
                    if (!acc[jobTitle]) acc[jobTitle] = [];
                    acc[jobTitle].push(application);
                    return acc;
                }, {});
                
                setHiredData(groupedByJob);
            } catch (err) {
                console.error("Erro:", err);
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
        if (cleaned.length === 11) return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
        if (cleaned.length === 10) return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 6)}-${cleaned.substring(6)}`;
        return phone;
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin text-blue-600"/></div>;

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Candidatos Aprovados</h1>
                <Button variant="outline" asChild>
                    <RouterLink to="/"><ArrowLeft className="mr-2 h-4 w-4"/> Voltar ao Painel</RouterLink>
                </Button>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-700 rounded border border-red-200">{error}</div>}

            {Object.keys(hiredData).length === 0 && !error && (
                <div className="text-center py-10 text-gray-500 bg-white rounded border border-dashed">
                    Nenhum candidato aprovado ainda.
                </div>
            )}

            <div className="space-y-6">
                {Object.entries(hiredData).map(([jobTitle, applications]) => (
                    <Card key={jobTitle} className="p-6">
                        <h2 className="text-lg font-semibold border-b pb-2 mb-4 text-gray-800">{jobTitle}</h2>
                        <ul className="space-y-4">
                            {applications.map((app) => (
                                <li key={app.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition">
                                    <div>
                                        <p className="font-medium text-gray-900">{app.candidate.name}</p>
                                        <p className="text-sm text-gray-600">{app.candidate.email} • {formatPhone(app.formData.phone)}</p>
                                    </div>
                                    <div className="mt-2 sm:mt-0 text-sm text-green-700 bg-green-100 px-3 py-1 rounded-full font-medium">
                                        Aprovado em: {app.hiredAt ? format(parseISO(app.hiredAt), 'dd/MM/yyyy') : 'N/A'}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default HiredPage;