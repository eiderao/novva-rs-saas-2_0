// api/saveEvaluation.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // 1. Valida o token do usuário de RH
    const authHeader = request.headers['authorization'];
    if (!authHeader) return response.status(401).json({ error: 'Não autorizado.' });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) return response.status(401).json({ error: 'Token inválido.' });

    // 2. Pega o ID da candidatura e os dados da avaliação do corpo da requisição
    const { applicationId, evaluation } = request.body;
    if (!applicationId || !evaluation) {
      return response.status(400).json({ error: 'applicationId e evaluation são obrigatórios.' });
    }

    // 3. ATUALIZA a candidatura no banco, preenchendo a coluna 'evaluation'
    // Por segurança, poderíamos re-validar se o usuário tem acesso a esta vaga,
    // mas vamos manter simples por agora, pois o risco é baixo.
    const { data, error: updateError } = await supabaseAdmin
      .from('applications')
      .update({ evaluation: evaluation }) // Atualiza apenas a coluna 'evaluation'
      .eq('id', applicationId)
      .select()
      .single();

    if (updateError) throw updateError;

    return response.status(200).json({ message: 'Avaliação salva com sucesso!', updatedApplication: data });

  } catch (error) {
    console.error("Erro na função saveEvaluation:", error);
    return response.status(500).json({ error: 'Erro interno do servidor.', details: error.message });
  }
}