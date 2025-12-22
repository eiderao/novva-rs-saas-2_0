import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

const AdminPage = () => {
    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Painel Administrativo</h1>
                    <Button variant="outline" asChild>
                        <Link to="/"><ArrowLeft className="mr-2 h-4 w-4"/> Voltar ao Dashboard</Link>
                    </Button>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-blue-600"/>
                                Gestão de Tenants
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-gray-500 mb-4">Gerencie as empresas e planos do sistema.</p>
                            <div className="p-4 bg-yellow-50 text-yellow-800 rounded-md text-sm border border-yellow-200">
                                Módulo em migração para V2.0
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default AdminPage;