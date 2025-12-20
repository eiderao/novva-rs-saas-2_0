import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { Plus } from 'lucide-react';
import CreateJobModal from '../components/jobs/CreateJobModal';

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
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="w-5 h-5 mr-2" /> Nova Vaga
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => (
          <Link key={job.id} to={`/jobs/${job.id}`} className="block p-6 bg-white rounded-lg border hover:shadow-md transition">
            <h3 className="text-lg font-medium text-gray-900">{job.title}</h3>
            <p className="mt-2 text-sm text-gray-500">{job.location || 'Remoto'}</p>
            <span className={`mt-4 inline-block px-2 py-1 text-xs font-semibold rounded-full ${job.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
              {job.status === 'open' ? 'Aberta' : 'Fechada'}
            </span>
          </Link>
        ))}
      </div>

      <CreateJobModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchJobs} 
      />
    </div>
  );
}