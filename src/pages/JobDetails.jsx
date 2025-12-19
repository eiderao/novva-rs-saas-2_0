import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  ArrowLeft, 
  User, 
  Calendar, 
  MapPin, 
  Briefcase, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Share2,
  Download
} from 'lucide-react';

export default function JobDetails() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details'); // 'details' ou 'candidates'
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    fetchJobDetails();
  }, [id]);

  useEffect(() => {
    // A URL pública para compartilhar a vaga (ApplyPage)
    const url = `${window.location.origin}/vagas/${id}/candidatar`;
    setShareUrl(url);
  }, [id]);

  const fetchJobDetails = async () => {
    try {
      setLoading(true);

      // 1. Busca os detalhes da Vaga
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .single();

      if (jobError) throw jobError;
      setJob(jobData);

      // 2. Busca os Candidatos inscritos nessa vaga
      // Faz o join com a tabela 'candidates' para pegar nome e email
      const { data: appsData, error: appsError } = await supabase
        .from('applications')
        .select(`
          *,
          candidate:candidates (
            name,
            email,
            phone,
            city,
            state,
            resume_url
          )
        `)
        .eq('jobId', id)
        .order('created_at', { ascending: false });

      if (appsError) throw appsError;

      // Se não houver candidatos, appsData será [], o que está correto.
      setCandidates(appsData || []);

    } catch (error) {
      console.error('Erro ao carregar vaga:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    alert('Link copiado para a área de transferência!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Vaga não encontrada</h2>
        <p className="mt-2 text-gray-500">Esta vaga pode ter sido removida ou você não tem permissão para vê-la.</p>
        <Link to="/jobs" className="mt-4 inline-flex items-center text-blue-600 hover:text-blue-500">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para vagas
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Cabeçalho da Vaga */}
      <div className="mb-8">
        <Link to="/jobs" className="inline-flex items-center text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Link>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{job.title}</h1>
            <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center">
                <MapPin className="h-4 w-4 mr-1" />
                {job.location || 'Remoto'}
              </span>
              <span className="flex items-center">
                <Briefcase className="h-4 w-4 mr-1" />
                {job.type || 'Tempo Integral'}
              </span>
              <span className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                Criada em {new Date(job.created_at).toLocaleDateString('pt-BR')}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                job.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {job.status === 'open' ? 'Aberta' : 'Fechada'}
              </span>
            </div>
          </div>
          
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Compartilhar Vaga
          </button>
        </div>
      </div>

      {/* Navegação de Abas */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('details')}
            className={`${
              activeTab === 'details'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Detalhes da Vaga
          </button>
          <button
            onClick={() => setActiveTab('candidates')}
            className={`${
              activeTab === 'candidates'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            Candidatos Inscritos
            <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2.5 rounded-full text-xs">
              {candidates.length}
            </span>
          </button>
        </nav>
      </div>

      {/* Conteúdo das Abas */}
      {activeTab === 'details' ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Descrição</h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500 whitespace-pre-wrap">
              {job.description || 'Sem descrição informada.'}
            </div>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Requisitos</h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500 whitespace-pre-wrap">
              {job.requirements || 'Sem requisitos informados.'}
            </div>
          </div>
        </div>
      ) : (
        /* ABA DE CANDIDATOS */
        <div className="space-y-4">
          {candidates.length === 0 ? (
            /* O FIX ESTÁ AQUI: Mensagem amigável quando lista vazia */
            <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
              <User className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum candidato inscrito ainda</h3>
              <p className="mt-1 text-sm text-gray-500">
                Compartilhe o link desta vaga para começar a receber candidaturas.
              </p>
              <div className="mt-6">
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Share2 className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                  Copiar Link da Vaga
                </button>
              </div>
            </div>
          ) : (
            /* Lista de Candidatos (Grid) */
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {candidates.map((app) => (
                  <li key={app.id}>
                    <div className="px-4 py-4 sm:px-6 hover:bg-gray-50 transition duration-150 ease-in-out">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center min-w-0">
                          <div className="flex-shrink-0">
                            <span className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                              {app.candidate?.name?.charAt(0).toUpperCase() || '?'}
                            </span>
                          </div>
                          <div className="ml-4 truncate">
                            <div className="flex items-center">
                              <p className="text-sm font-medium text-blue-600 truncate">
                                {app.candidate?.name || 'Nome Indisponível'}
                              </p>
                              {app.isHired && (
                                <span className="ml-2 flex-shrink-0 inline-block px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                  Contratado
                                </span>
                              )}
                            </div>
                            <div className="flex text-sm text-gray-500 mt-1">
                              <span className="flex items-center mr-4">
                                <User className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                                {app.candidate?.email}
                              </span>
                              {app.candidate?.city && (
                                <span className="flex items-center mr-4">
                                  <MapPin className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                                  {app.candidate.city}/{app.candidate.state}
                                </span>
                              )}
                              <span className="flex items-center">
                                <Clock className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                                {new Date(app.created_at).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {app.resumeUrl || app.candidate?.resume_url ? (
                             <a 
                               href={app.resumeUrl || app.candidate?.resume_url}
                               target="_blank"
                               rel="noopener noreferrer"
                               className="inline-flex items-center p-2 border border-gray-300 rounded-full text-gray-400 hover:text-gray-600 bg-white hover:bg-gray-50"
                               title="Ver Currículo"
                             >
                               <Download className="h-5 w-5" />
                             </a>
                          ) : null}
                          {/* Botão de ver detalhes da avaliação (placeholder para futuro) */}
                          <button className="ml-2 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200">
                            Avaliar
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}