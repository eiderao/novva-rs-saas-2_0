import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import StateSelect from '../components/inputs/StateSelect';
import { Loader2, UploadCloud, CheckCircle, AlertCircle } from 'lucide-react';

const ApplyPage = () => {
  // CORREÇÃO AQUI: O Router passa 'id', não 'jobId'
  const { id } = useParams(); 
  // Para facilitar, vamos renomear internamente para jobId
  const jobId = id;

  // Estados de controle
  const [jobTitle, setJobTitle] = useState('');
  const [isVagaClosed, setIsVagaClosed] = useState(false);
  const [loadingPage, setLoadingPage] = useState(true);
  const [errorPage, setErrorPage] = useState('');

  // Formulário
  const [formState, setFormState] = useState({
    name: '', preferredName: '', email: '', phone: '', birthDate: '',
    state: '', city: '', hasGraduated: '', studyPeriod: '', course: '',
    institution: '', completionYear: '', englishLevel: '', spanishLevel: '',
    source: '', motivation: '', linkedinProfile: '', githubProfile: ''
  });
  
  const [resumeFile, setResumeFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  useEffect(() => {
    const fetchJobData = async () => {
      if (!jobId) {
        setErrorPage('ID da vaga não especificado.');
        setLoadingPage(false);
        return;
      }
      try {
        const response = await fetch(`/api/getPublicJobData?id=${jobId}`);
        if (!response.ok) throw new Error('Vaga não encontrada.');
        const data = await response.json();
        
        if (data.job) {
          if (data.job.planId === 'freemium' && data.job.candidateCount >= 3) {
            setIsVagaClosed(true);
          }
          setJobTitle(data.job.title);
        } else {
            throw new Error('Dados da vaga não encontrados.');
        }
      } catch (error) {
        setErrorPage(error.message);
      } finally {
        setLoadingPage(false);
      }
    };
    fetchJobData();
  }, [jobId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setResumeFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback({ type: '', message: '' });

    if (!resumeFile) {
      setFeedback({ type: 'error', message: 'Por favor, anexe seu currículo.' });
      setIsSubmitting(false);
      return;
    }

    const formData = new FormData();
    formData.append('jobId', jobId);
    
    Object.keys(formState).forEach(key => {
        if (formState[key]) formData.append(key, formState[key]);
    });
    
    formData.append('resume', resumeFile);

    try {
      const response = await fetch('/api/apply', { method: 'POST', body: formData });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao enviar candidatura.');
      }
      setFeedback({ type: 'success', message: 'Candidatura enviada com sucesso!' });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingPage) return <div className="flex justify-center my-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>;
  
  if (errorPage) return <div className="max-w-md mx-auto mt-10 p-4 bg-red-50 text-red-700 rounded border border-red-200">{errorPage}</div>;
  
  if (feedback.type === 'success') {
    return (
        <div className="max-w-md mx-auto mt-20 text-center p-8 bg-green-50 rounded-lg border border-green-100">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-green-800 mb-2">Sucesso!</h1>
            <p className="text-green-700">{feedback.message}</p>
        </div>
    );
  }
  
  if (isVagaClosed) {
    return (
        <div className="max-w-md mx-auto mt-20 text-center p-8 bg-yellow-50 rounded-lg border border-yellow-100">
            <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-yellow-800 mb-2">Vaga Encerrada</h1>
            <p className="text-yellow-700">Esta vaga já atingiu o limite de candidaturas.</p>
        </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Candidatura à Vaga</h1>
        <p className="text-lg text-blue-600 font-medium mt-1">{jobTitle}</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-100">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <Label htmlFor="name">Nome Completo</Label>
                <Input name="name" id="name" required onChange={handleInputChange} />
            </div>
            <div>
                <Label htmlFor="preferredName">Nome Social / Como prefere ser chamado</Label>
                <Input name="preferredName" id="preferredName" onChange={handleInputChange} />
            </div>
            
            <div>
                <Label htmlFor="email">E-mail</Label>
                <Input name="email" id="email" type="email" required onChange={handleInputChange} />
            </div>
            <div>
                <Label htmlFor="phone">Telefone (Celular)</Label>
                <Input name="phone" id="phone" type="tel" required onChange={handleInputChange} />
            </div>
            
            <div>
                <Label htmlFor="birthDate">Data de Nascimento</Label>
                <Input name="birthDate" id="birthDate" type="date" required value={formState.birthDate} onChange={handleInputChange} />
            </div>
        </div>

        <StateSelect value={formState.state} onChange={handleInputChange} />
        
        <div>
            <Label htmlFor="city">Cidade</Label>
            <Input name="city" id="city" required onChange={handleInputChange} />
        </div>

        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <Label className="mb-3">Você já concluiu curso superior?</Label>
            <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="hasGraduated" value="sim" onChange={handleInputChange} className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-gray-700">Sim, já concluí</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="hasGraduated" value="nao" onChange={handleInputChange} className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-gray-700">Não, estou cursando</span>
                </label>
            </div>
        </div>

        {formState.hasGraduated === 'nao' && (
             <div><Label>Período/Ano</Label><Input name="studyPeriod" onChange={handleInputChange} /></div>
        )}
        
        {formState.hasGraduated && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>Curso</Label><Input name="course" required onChange={handleInputChange} /></div>
                <div><Label>Instituição</Label><Input name="institution" required onChange={handleInputChange} /></div>
                {formState.hasGraduated === 'sim' && ( 
                     <div><Label>Ano de Conclusão</Label><Input name="completionYear" type="number" onChange={handleInputChange} /></div>
                )}
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {['englishLevel', 'spanishLevel'].map(lang => (
                <div key={lang}>
                    <Label>{lang === 'englishLevel' ? 'Inglês' : 'Espanhol'}</Label>
                    <select name={lang} onChange={handleInputChange} className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
                        <option value="">Selecione...</option>
                        <option value="basico">Básico</option>
                        <option value="intermediario">Intermediário</option>
                        <option value="avancado">Avançado</option>
                        <option value="fluente">Fluente/Nativo</option>
                    </select>
                </div>
            ))}
        </div>

        <div>
            <Label htmlFor="motivation">Por que você deseja esta vaga?</Label>
            <Textarea name="motivation" id="motivation" required rows={4} onChange={handleInputChange} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>LinkedIn (Opcional)</Label><Input name="linkedinProfile" onChange={handleInputChange} /></div>
            <div><Label>GitHub (Opcional)</Label><Input name="githubProfile" onChange={handleInputChange} /></div>
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors">
            <Label htmlFor="resume" className="cursor-pointer">
                <div className="flex flex-col items-center gap-2">
                    <UploadCloud className="w-8 h-8 text-gray-400" />
                    <span className="text-sm font-medium text-blue-600">Clique para enviar seu currículo (PDF/DOC)</span>
                    {resumeFile && <span className="text-xs text-green-600 font-bold">Arquivo selecionado: {resumeFile.name}</span>}
                </div>
                <input id="resume" type="file" hidden required accept=".pdf,.doc,.docx" onChange={handleFileChange} />
            </Label>
        </div>

        {feedback.type === 'error' && <div className="text-red-600 text-sm bg-red-50 p-3 rounded">{feedback.message}</div>}

        <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Enviando...</> : 'Enviar Candidatura'}
        </Button>
      </form>
    </div>
  );
};

export default ApplyPage;