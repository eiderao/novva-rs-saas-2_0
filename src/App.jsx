import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';

// Páginas existentes (Confirmadas na sua lista)
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import JobDetails from './pages/JobDetails';
import ApplyPage from './pages/ApplyPage';

// Páginas NOVAS (Que acabamos de criar no Passo 1)
import Register from './pages/Register';
import Jobs from './pages/Jobs';
import Candidates from './pages/Candidates';
import CompanySettings from './pages/CompanySettings';
import Evaluation from './pages/Evaluation';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Rotas Públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Rota Pública de Candidatura */}
          <Route path="/vagas/:id/candidatar" element={<ApplyPage />} />

          {/* Rotas Privadas */}
          <Route element={<PrivateRoute />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:id" element={<JobDetails />} />
            
            <Route path="/candidates" element={<Candidates />} />
            <Route path="/settings" element={<CompanySettings />} />
            <Route path="/evaluations/:applicationId" element={<Evaluation />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;