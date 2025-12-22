import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { Plus, MapPin, Loader2, AlertCircle } from 'lucide-react';
import CreateJobModal from '../components/jobs/CreateJobModal';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { formatStatus } from '../utils/formatters';

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchJobs = async () => {
    setLoading(true);
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return; 

        // Usa a API que acabamos de blindar
        const response = await fetch('/api/jobs', { 
            headers: { 'Authorization': `Bearer ${session.access_token}` } 
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        
        setJobs(data.jobs || []);
    } catch (err) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => { fetchJobs(); }, []);

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gerenciar Vagas</h1>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nova Vaga
        </Button>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-700 rounded border border-red-200 mb-4">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => (
          <Link key={job.id} to={`/jobs/${job.id}`} className="block p-6 bg-white rounded-lg border hover:shadow-md transition">
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-medium text-gray-900">{job.title}</h3>
                <Badge variant={job.status === 'active' ? 'success' : 'secondary'}>{formatStatus(job.status)}</Badge>
            </div>
            <div className="flex items-center text-sm text-gray-500 mb-2">
                <MapPin className="w-4 h-4 mr-1"/> {job.location_type}
            </div>
            <div className="text-xs text-gray-400 font-medium">{job.deptName}</div>
          </Link>
        ))}
      </div>

      <CreateJobModal open={isModalOpen} handleClose={() => setIsModalOpen(false)} onJobCreated={fetchJobs} />
    </div>
  );
}