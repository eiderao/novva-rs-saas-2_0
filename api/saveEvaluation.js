import { createClient } from '@supabase/supabase-js';
// Certifique-se de que o arquivo _utils/calculator.js existe conforme passo anterior
import { calculateWeightedScore } from './_utils/calculator.js'; 

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Método não permitido' });

  const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  try {
    const authHeader = request.headers['authorization'];
    if (!authHeader) throw new Error('Token ausente.');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) throw new Error('Token inválido.');

    const { applicationId, scores, notes } = request.body;

    // 1. Busca Parâmetros da Vaga
    const { data: appData, error: appError } = await supabaseAdmin
        .from('applications')
        .select('job:jobs(parameters)')
        .eq('id', applicationId)
        .single();

    if (appError || !appData) throw new Error('Candidatura não encontrada.');

    // 2. Calcula Nota (Backend)
    // A função calculateWeightedScore deve tratar o 'N/A' ignorando o peso
    const finalScore = calculateWeightedScore(scores, appData.job.parameters);

    // 3. Salva na tabela EVALUATIONS (Confirmada nos metadados)
    const { error: saveError } = await supabaseAdmin
        .from('evaluations')
        .upsert({
            application_id: applicationId,
            evaluator_id: user.id,
            scores: scores,
            notes: notes,
            final_score: finalScore,
            updated_at: new Date()
        }, { onConflict: 'application_id, evaluator_id' });

    if (saveError) throw saveError;

    return response.status(200).json({ message: 'Avaliação salva!', score: finalScore });

  } catch (error) {
    console.error('Save Error:', error);
    return response.status(500).json({ error: error.message });
  }
}