import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

const AdminTenantPage = () => {
    return (
        <div className="p-10 text-center">
            <h1 className="text-2xl font-bold mb-4">Gestão de Usuários</h1>
            <p className="mb-6 text-gray-600">
                Módulo em manutenção para atualização de segurança.
            </p>
            <Button asChild>
                <Link to="/admin">Voltar</Link>
            </Button>
        </div>
    );
};

export default AdminTenantPage;