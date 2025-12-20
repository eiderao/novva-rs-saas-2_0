import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';

// Importação das Páginas
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Jobs from './pages/Jobs';
import JobDetails from './pages/JobDetails'; // Garante que a página de detalhes está importada
import Candidates from './pages/Candidates';
import CompanySettings from './pages/CompanySettings';
import ApplyPage from './pages/ApplyPage'; // Página pública de candidatura
import Evaluation from './pages/Evaluation'; // Página de avaliação do candidato

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Rotas Públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Rota Pública da Vaga (Candidatura) */}
          <Route path="/vagas/:id/candidatar" element={<ApplyPage />} />

          {/* Rotas Privadas (Área do Recrutador) */}
          <Route element={<PrivateRoute />}>
             {/* Redireciona a raiz para o Dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/jobs" element={<Jobs />} />
            
            {/* AQUI ESTAVA O ERRO: Adicionamos o /:id para capturar o código da vaga */}
            <Route path="/jobs/:id" element={<JobDetails />} />
            
            <Route path="/candidates" element={<Candidates />} />
            <Route path="/settings" element={<CompanySettings />} />
            
            {/* Rota para Avaliação Individual de Candidato */}
            <Route path="/evaluations/:applicationId" element={<Evaluation />} />
          </Route>

          {/* Rota de Catch-all (404) */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;