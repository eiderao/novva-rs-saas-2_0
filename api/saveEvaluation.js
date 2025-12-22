// api/saveEvaluation.js
import { createClient } from '@supabase/supabase-js';
import { calculateWeightedScore } from './_utils/calculator.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });

  const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  try {
    // Auth
    const token = request.headers['authorization']?.replace('Bearer ', '');
    if (!token) throw new Error('Não autorizado.');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) throw new Error('Token inválido.');

    const { applicationId, scores, notes } = request.body;

    // 1. Busca Parâmetros da Vaga (para calcular a nota corretamente)
    const { data: appData, error: appError } = await supabaseAdmin
        .from('applications')
        .select('job:jobs(parameters)')
        .eq('id', applicationId)
        .single();

    if (appError) throw new Error('Candidatura não encontrada.');

    // 2. Calcula Nota no Backend (Segurança + Regra de Negócio)
    const finalScore = calculateWeightedScore(scores, appData.job.parameters);

    // 3. Salva na tabela EVALUATIONS (Upsert: Atualiza se já existir para este usuário)
    const { error: saveError } = await supabaseAdmin
        .from('evaluations')
        .upsert({
            application_id: applicationId,
            evaluator_id: user.id,
            scores: scores,     // JSON bruto das escolhas
            notes: notes,       // Texto
            final_score: finalScore,
            updated_at: new Date()
        }, { onConflict: 'application_id, evaluator_id' });

    if (saveError) throw saveError;

    return response.status(200).json({ message: 'Salvo!', score: finalScore });

  } catch (error) {
    console.error('Save Error:', error);
    return response.status(500).json({ error: error.message });
  }
}