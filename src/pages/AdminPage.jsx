import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

// Placeholder temporário para passar o build enquanto focamos no fluxo principal
const AdminPage = () => {
    return (
        <div className="p-10 text-center">
            <h1 className="text-2xl font-bold mb-4">Painel Administrativo</h1>
            <p className="mb-6 text-gray-600">
                Esta página está passando por uma reformulação visual para o novo Design System V2.0.
                A funcionalidade de gestão de tenants retornará em breve.
            </p>
            <Button asChild>
                <Link to="/">Voltar ao Dashboard</Link>
            </Button>
        </div>
    );
};

export default AdminPage;