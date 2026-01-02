import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { Plus, Search, MapPin, Briefcase, DollarSign, Calendar, MoreVertical, Trash2, Edit, ExternalLink, Copy, CheckCircle } from 'lucide-react';

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null); // Para feedback visual de "Copiado!"

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      // Busca o tenant do usuário logado para filtrar as vagas certas
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tenantId')
        .eq('id', session.user.id)
        .single();

      if (profile?.tenantId) {
        const { data, error } = await supabase
          .from('jobs')
          .select('*')
          .eq('tenantId', profile.tenantId) // Garante que só vê vagas da própria empresa
          .order('created_at', { ascending: false });

        if (error) throw error;
        setJobs(data || []);
      }
    } catch (error) {
      console.error('Erro ao buscar vagas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta vaga?')) return;

    try {
      const { error } = await supabase.from('jobs').delete().eq('id', id);
      if (error) throw error;
      setJobs(jobs.filter(job => job.id !== id));
    } catch (error) {
      alert('Erro ao excluir vaga.');
      console.error(error);
    }
  };

  const copyToClipboard = (jobId) => {
    // Monta a URL completa do formulário público
    const link = `${window.location.origin}/apply/${jobId}`;
    
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(jobId);
      // Remove o feedback "Copiado" após 2 segundos
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const filteredJobs = jobs.filter(job => 
    job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans">
      
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vagas</h1>
          <p className="text-gray-500 mt-1">Gerencie suas oportunidades e links de divulgação.</p>
        </div>
        <Link to="/jobs/new" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2 shadow-sm transition-all">
          <Plus size={20} /> Nova Vaga
        </Link>
      </div>

      {/* Barra de Busca */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Buscar por cargo ou localização..." 
          className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Listagem */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Carregando vagas...</div>
      ) : filteredJobs.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <Briefcase className="mx-auto text-gray-400 mb-3" size={48} />
          <h3 className="text-lg font-medium text-gray-900">Nenhuma vaga encontrada</h3>
          <p className="text-gray-500 mb-4">Crie sua primeira oportunidade para começar a recrutar.</p>
          <Link to="/jobs/new" className="text-blue-600 font-medium hover:underline">Criar vaga agora</Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredJobs.map((job) => (
            <div key={job.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex flex-col md:flex-row justify-between gap-4">
              
              {/* Informações da Vaga */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-bold text-gray-800 hover:text-blue-600 transition-colors">
                    <Link to={`/jobs/${job.id}`}>{job.title}</Link>
                  </h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide border ${
                    job.status === 'open' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                  }`}>
                    {job.status === 'open' ? 'Aberta' : 'Fechada'}
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                  {job.location && (
                    <div className="flex items-center gap-1"><MapPin size={14}/> {job.location}</div>
                  )}
                  {job.type && (
                    <div className="flex items-center gap-1"><Briefcase size={14}/> {job.type}</div>
                  )}
                  {job.salary_range && (
                    <div className="flex items-center gap-1"><DollarSign size={14}/> {job.salary_range}</div>
                  )}
                  <div className="flex items-center gap-1">
                    <Calendar size={14}/> Criada em {new Date(job.created_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center gap-3 self-start md:self-center border-t md:border-t-0 pt-4 md:pt-0 w-full md:w-auto mt-2 md:mt-0">
                
                {/* BOTÃO COPIAR LINK */}
                <button 
                  onClick={() => copyToClipboard(job.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                    copiedId === job.id 
                    ? 'bg-green-50 text-green-700 border-green-200' 
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:text-blue-600'
                  }`}
                  title="Copiar Link para Candidatos"
                >
                  {copiedId === job.id ? <CheckCircle size={16}/> : <ExternalLink size={16}/>}
                  {copiedId === job.id ? 'Link Copiado!' : 'Link da Vaga'}
                </button>

                <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block"></div>

                <Link to={`/jobs/${job.id}/edit`} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Editar">
                  <Edit size={18} />
                </Link>
                
                <button onClick={() => handleDelete(job.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors" title="Excluir">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}