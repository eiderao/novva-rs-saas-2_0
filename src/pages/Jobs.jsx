import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { Plus, MapPin } from 'lucide-react';
import CreateJobModal from '../components/jobs/CreateJobModal';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    const { data } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
    setJobs(data || []);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Vagas</h1>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nova Vaga
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => (
          <Link key={job.id} to={`/jobs/${job.id}`} className="block p-6 bg-white rounded-lg border hover:shadow-md transition">
            <h3 className="text-lg font-medium text-gray-900">{job.title}</h3>
            <div className="flex items-center mt-2 text-sm text-gray-500">
                <MapPin className="w-4 h-4 mr-1"/>
                {job.location || 'Remoto'}
            </div>
            
            {/* CORREÇÃO AQUI: Verificando se é 'active' */}
            <div className="mt-4">
                <Badge variant={job.status === 'active' ? 'success' : 'secondary'}>
                    {job.status === 'active' ? 'Ativa' : 'Fechada'}
                </Badge>
            </div>
          </Link>
        ))}
      </div>

      <CreateJobModal 
        open={isModalOpen} 
        handleClose={() => setIsModalOpen(false)} 
        onJobCreated={fetchJobs} 
      />
    </div>
  );
}