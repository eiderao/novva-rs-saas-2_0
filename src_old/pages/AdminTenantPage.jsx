import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { ArrowLeft, Construction } from 'lucide-react';

const AdminTenantPage = () => {
    return (
        <div className="flex h-screen items-center justify-center bg-gray-50 p-4">
            <Card className="max-w-md w-full text-center">
                <CardHeader>
                    <div className="mx-auto bg-blue-100 p-3 rounded-full w-fit mb-4">
                        <Construction className="h-8 w-8 text-blue-600" />
                    </div>
                    <CardTitle className="text-xl">Gestão de Usuários</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-500 mb-6">
                        Este módulo está sendo atualizado para a nova versão 2.0. 
                        A gestão de usuários retornará em breve.
                    </p>
                    <Button asChild className="w-full">
                        <Link to="/admin">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Admin
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};

export default AdminTenantPage;