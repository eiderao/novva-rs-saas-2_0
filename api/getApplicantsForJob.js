// api/getApplicantsForJob.js (VERSÃO FINAL E CORRIGIDA)
import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  try {
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Validação do usuário (sem alterações)
    const authHeader = request.headers['authorization'];
    if (!authHeader) return response.status(401).json({ error: 'Não autorizado.' });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) return response.status(401).json({ error: 'Token inválido.' });
    const { data: userData } = await supabaseAdmin.from('users').select('tenantId').eq('id', user.id).single();
    if (!userData) return response.status(404).json({ error: 'Perfil de usuário não encontrado.' });
    const tenantId = userData.tenantId;
    const { jobId } = request.query;
    if (!jobId) return response.status(400).json({ error: 'O ID da vaga é obrigatório.' });

    // Busca a vaga e suas candidaturas de uma só vez
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select(`
        id,
        tenantId,
        parameters,
        applications (
          id,
          created_at,
          evaluation,
          isHired,
          candidate:candidates ( id, name, email )
        )
      `)
      .eq('id', Number(jobId))
      .eq('tenantId', tenantId)
      .single();

    if (jobError || !job) {
      return response.status(404).json({ error: 'Vaga não encontrada ou não pertence à sua empresa.' });
    }

    // Prepara os mapas para cálculo (sem alterações)
    const parameters = job.parameters || {};
    const notesMap = new Map((parameters.notas || []).map(note => [note.id, note.valor]));
    const weightsMap = {
      triagem: new Map((parameters.triagem || []).map(c => [c.name, c.weight])),
      cultura: new Map((parameters.cultura || []).map(c => [c.name, c.weight])),
      técnico: new Map((parameters.técnico || []).map(c => [c.name, c.weight])),
    };

    // Calcula as notas para cada candidatura
    const classifiedApplicants = job.applications.map(app => {
      const scores = { notaTriagem: 0, notaCultura: 0, notaTecnico: 0, notaGeral: 0 };
      if (app.evaluation) {
        ['triagem', 'cultura', 'técnico'].forEach(section => {
          let sectionScore = 0;
          const sectionEvaluation = app.evaluation[section];
          if (sectionEvaluation) {
            for (const criterionName in sectionEvaluation) {
              if (criterionName !== 'anotacoes') {
                const noteId = sectionEvaluation[criterionName];
                const noteValue = notesMap.get(noteId) ?? 0;
                const weight = weightsMap[section]?.get(criterionName) ?? 0;
                sectionScore += (noteValue * weight) / 100;
              }
            }
          }
          if (section === 'triagem') scores.notaTriagem = sectionScore;
          if (section === 'cultura') scores.notaCultura = sectionScore;
          if (section === 'técnico') scores.notaTecnico = sectionScore;
        });
        scores.notaGeral = scores.notaTriagem + scores.notaCultura + scores.notaTecnico;
      }

      // A CORREÇÃO ESTÁ AQUI: O campo 'isHired' foi restaurado
      return {
        applicationId: app.id,
        submissionDate: app.created_at,
        isHired: app.isHired,
        candidateName: app.candidate.name,
        candidateEmail: app.candidate.email,
        ...scores
      };
    });
    
    return response.status(200).json({ applicants: classifiedApplicants });

  } catch (error) {
    console.error("Erro na função getApplicantsForJob:", error);
    return response.status(500).json({ error: 'Erro interno do servidor.', details: error.message });
  }
}