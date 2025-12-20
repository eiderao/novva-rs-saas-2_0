import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Importação do Componente de Segurança (Caminho corrigido para src/components/PrivateRoute)
import PrivateRoute from './components/PrivateRoute';

// Importação das Páginas
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Jobs from './pages/Jobs';
import JobDetails from './pages/JobDetails';
import Candidates from './pages/Candidates';
import CompanySettings from './pages/CompanySettings';
import ApplyPage from './pages/ApplyPage';
import Evaluation from './pages/Evaluation';

function App() {
  return (
    <Router>
      <AuthProvider>
        {/* AuthProvider envolve tudo para fornecer o estado de 'user' */}
        <Routes>
          
          {/* --- ROTAS PÚBLICAS (Acessíveis sem login) --- */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Rota para o candidato se inscrever (Ex: site.com/vagas/123/candidatar) */}
          <Route path="/vagas/:id/candidatar" element={<ApplyPage />} />


          {/* --- ROTAS PRIVADAS (Apenas Recrutadores Logados) --- */}
          <Route element={<PrivateRoute />}>
            
            {/* Redireciona a raiz '/' para o Dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/jobs" element={<Jobs />} />
            
            {/* CORREÇÃO CRÍTICA: O parâmetro se chama ':id' para bater com o useParams() do JobDetails */}
            <Route path="/jobs/:id" element={<JobDetails />} />
            
            <Route path="/candidates" element={<Candidates />} />
            <Route path="/settings" element={<CompanySettings />} />
            <Route path="/evaluations/:applicationId" element={<Evaluation />} />
          
          </Route>

          {/* Rota de Erro 404 - Qualquer URL desconhecida vai para Login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
          
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;